import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {PostgresDatabase} from '../server/postgres-db.mjs';

// The same API scenarios run against isolated SQLite and PostgreSQL databases.
// This fixture never reads connection URLs, credentials, or production data.
export async function createTestDatabase() {
  if (process.env.TOP_HILLS_TEST_DATABASE === 'postgres') {
    const {PGlite} = await import('@electric-sql/pglite');
    const pg = new PGlite();
    await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
    await pg.exec(readFileSync('supabase/schema.sql', 'utf8'));
    const DB = new PostgresDatabase(callback => pg.transaction(tx => callback({query: (q, p) => tx.query(q, p)})));
    const sql = {prepare(query) { return {
      get: (...p) => DB.prepare(query).bind(...p).first(),
      all: async (...p) => (await DB.prepare(query).bind(...p).all()).results,
      run: async (...p) => ({changes: (await DB.prepare(query).bind(...p).run()).meta.changes})
    }; }};
    return {DB, sql, close: () => pg.close()};
  }
  const sql = new DatabaseSync(':memory:');
  for (const f of readdirSync('drizzle').filter(f => f.endsWith('.sql')).sort()) {
    for (const s of readFileSync('drizzle/' + f, 'utf8').split('--> statement-breakpoint')) if (s.trim()) sql.exec(s);
  }
  const DB = {prepare(query) { return {values: [], bind(...p) {this.values = p; return this;},
    async first() {return sql.prepare(query).get(...this.values) || null;},
    async all() {return {results: sql.prepare(query).all(...this.values)};},
    async run() {return {meta: {changes: Number(sql.prepare(query).run(...this.values).changes)}};}
  }; }, async batch(items) {
    sql.exec('BEGIN');
    try {const results = []; for (const s of items) results.push(await s.run()); sql.exec('COMMIT'); return results;}
    catch (e) {sql.exec('ROLLBACK'); throw e;}
  }};
  return {DB, sql, close: () => sql.close()};
}
