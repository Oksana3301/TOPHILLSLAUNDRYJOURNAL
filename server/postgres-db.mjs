// Server-only compatibility for the application's parameterized SQLite queries.
// No route accepts SQL from a caller. Each D1-style batch is one PG transaction.
const booleanPaths = new Set(['simulation', 'custody']);
const numberPaths = new Set(['bags', 'received', 'pay.received', 'ref.settlementAdjustment.cashReturned']);
const cache = new Map();
function jsonPath(path) {
  if (!/^\$\.[A-Za-z0-9_.]+$/.test(path)) throw new Error('Unsupported JSON path');
  return path.slice(2);
}
export function postgresQuery(input) {
  if (cache.has(input)) return cache.get(input);
  if (typeof input !== 'string' || !/^\s*(SELECT|INSERT|UPDATE|DELETE)\b/i.test(input)) throw new Error('Unsupported application query');
  let sql = input.trim();
  const ignore = /^INSERT OR IGNORE\b/i.test(sql);
  sql = sql.replace(/^INSERT OR IGNORE\b/i, 'INSERT');
  sql = sql.replace(/json_extract\(\s*([^,()]+)\s*,\s*'([^']+)'\s*\)/gi, (_, source, path) => {
    const field = jsonPath(path), text = `((${source.trim()})::jsonb #>> '{${field.split('.').join(',')}}')`;
    if (booleanPaths.has(field)) return `(${text}::boolean)::integer`;
    if (numberPaths.has(field)) return `(${text})::numeric`;
    return text;
  });
  sql = sql.replace(/json_each\(\s*([^,()]+)\s*,\s*'([^']+)'\s*\)/gi, (_, source, path) =>
    `jsonb_array_elements((${source.trim()})::jsonb #> '{${jsonPath(path).split('.').join(',')}}')`);
  sql = sql.replace(/\bMAX\(0,/gi, 'GREATEST(0,').replace(/\bLIKE\b/gi, 'ILIKE');
  sql = sql.replace(/\bAS ([a-zA-Z_]*[A-Z][a-zA-Z_]*)\b/g, 'AS "$1"');
  sql = sql.replace(/SET value=value\+1\b/g, 'SET value=laundry_counters.value+1')
    .replace(/SET count=count\+1\b/g, 'SET count=auth_limits.count+1');
  let quoted = false, result = '', count = 0;
  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    if (char === "'") {
      result += char;
      if (quoted && sql[i + 1] === "'") { result += sql[++i]; continue; }
      quoted = !quoted;
    } else if (char === '?' && !quoted) result += '$' + (++count);
    else result += char;
  }
  result = result.replace(/(\$\d+) IS NULL\b/g, '$1::text IS NULL');
  if (ignore) result = result.replace(/;?$/, ' ON CONFLICT DO NOTHING');
  const compiled = {sql: result, parameters: count};
  if (cache.size >= 256) cache.clear();
  cache.set(input, compiled);
  return compiled;
}

function scalar(value) {
  if (typeof value === 'bigint') {
    const n = Number(value);
    if (!Number.isSafeInteger(n)) throw new Error('Database integer exceeds the supported range');
    return n;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}
class Statement {
  constructor(db, sql, parameters = []) { this.db = db; this.query = postgresQuery(sql); this.parameters = parameters; }
  bind(...parameters) {
    if (parameters.some(p => p !== null && !['string', 'number', 'boolean'].includes(typeof p))) throw new Error('Unsupported bound value');
    const bound = Object.create(Statement.prototype);
    Object.assign(bound, this, {parameters: parameters.map(scalar)});
    return bound;
  }
  async run() { return (await this.db.batch([this]))[0]; }
  async all() { return this.run(); }
  async first(column) {
    const row = (await this.all()).results[0];
    return row ? (column ? row[column] : row) : null;
  }
}
export class PostgresDatabase {
  constructor(transaction) { this.transaction = transaction; }
  prepare(sql) { return new Statement(this, sql); }
  async batch(statements) {
    if (!statements.length) return [];
    for (const s of statements) {
      if (!(s instanceof Statement) || s.db !== this || s.parameters.length !== s.query.parameters) throw new Error('Invalid statement or parameter count');
    }
    return this.transaction(async connection => {
      const results = [];
      for (const s of statements) {
        const value = await connection.query(s.query.sql, s.parameters);
        const rows = (value.rows || []).map(row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, scalar(v)])));
        results.push({success: true, results: rows, meta: {changes: value.rowCount ?? value.affectedRows ?? rows.length}});
      }
      return results;
    });
  }
}
