import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export const EXPECTED_TABLES = Object.freeze([
  'workspace', 'members', 'finance_transactions', 'journals', 'journal_lines',
  'attachments', 'finance_records', 'finance_audit', 'mutations',
  'laundry_rooms', 'laundry_orders', 'laundry_counters', 'laundry_events',
  'laundry_proofs', 'laundry_mutations', 'staff_sessions', 'auth_limits',
  'laundry_demo_sessions'
]);

// This diagnostic is not imported by the Worker and never changes its backend.
// All requests are GETs. Table probes use limit=0 and never request row counts.
export async function inspectConnection({project, env = process.env, request = fetch}) {
  if (env.CI) throw new Error('Live Supabase checks are disabled in CI. Run the mocked tests instead.');
  if (!/^[a-z]{20}$/.test(project?.projectRef || '') ||
      project.apiUrl !== `https://${project.projectRef}.supabase.co`) {
    throw new Error('Invalid Supabase project configuration.');
  }
  if (env.SUPABASE_URL && env.SUPABASE_URL.replace(/\/$/, '') !== project.apiUrl) {
    throw new Error('SUPABASE_URL does not match the configured Top Hills project.');
  }
  const publishable = env.SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY;
  if (!publishable?.startsWith('sb_publishable_') || !secret?.startsWith('sb_secret_')) {
    throw new Error('Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY in the local process environment.');
  }
  const clean = value => {
    if (typeof value !== 'string') return undefined;
    return value.split(secret).join('[REDACTED]').split(publishable).join('[REDACTED]')
      .replace(/sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g, '[REDACTED]');
  };
  async function get(path, key, accept = 'application/json') {
    try {
      const response = await request(project.apiUrl + path, {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: {apikey: key, Accept: accept, 'User-Agent': 'TopHills-Connection-Check/1.0'}
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) return {ok: false, httpStatus: response.status,
        errorCode: clean(body?.code || body?.error_code),
        // Never echo raw API errors, response bodies, request headers or keys.
        error: 'API request failed'};
      return {ok: true, httpStatus: response.status, body};
    } catch {
      return {ok: false, error: 'Network request failed or timed out'};
    }
  }
  const [auth, schema, storage] = await Promise.all([
    get('/auth/v1/settings', publishable),
    get('/rest/v1/', secret, 'application/openapi+json'),
    get('/storage/v1/bucket', secret)
  ]);
  const summarize = ({body, ...result}) => result;
  if (auth.ok && (!auth.body?.external || typeof auth.body.external !== 'object' || Array.isArray(auth.body.external))) {
    auth.ok = false; auth.error = 'Unexpected Auth settings response';
  }
  if (schema.ok && (!schema.body?.paths || typeof schema.body.paths !== 'object' || Array.isArray(schema.body.paths))) {
    schema.ok = false; schema.error = 'Unexpected Data API schema response';
  }
  if (storage.ok && (!Array.isArray(storage.body) || storage.body.some(b => !b || typeof b !== 'object'))) {
    storage.ok = false; storage.error = 'Unexpected Storage response';
  }
  const paths = schema.ok ? Object.keys(schema.body.paths) : [];
  const tableProbes = [];
  // Do not continue issuing privileged requests after an authentication failure.
  if (schema.ok) {
    for (let i = 0; i < EXPECTED_TABLES.length; i += 4) {
      tableProbes.push(...await Promise.all(EXPECTED_TABLES.slice(i, i + 4).map(async table => {
        const result = await get(`/rest/v1/${table}?select=*&limit=0`, secret);
        if (result.ok && !Array.isArray(result.body)) {
          result.ok = false; result.error = 'Unexpected table response';
        }
        return {table, ...summarize(result)};
      })));
    }
  }
  const observed = {
    auth: {...summarize(auth), ...(auth.ok ? {
      emailEnabled: auth.body.external.email === true,
      signupEnabled: auth.body.disable_signup === false,
      emailConfirmationRequired: auth.body.mailer_autoconfirm === false
    } : {})},
    dataApi: {...summarize(schema), ...(schema.ok ? {
      visibleTablesOrViews: paths.filter(p => p !== '/' && !p.startsWith('/rpc/')).map(p => clean(p.slice(1))).sort(),
      visibleFunctions: paths.filter(p => p.startsWith('/rpc/')).map(p => clean(p.slice(5))).sort(),
      tableProbes
    } : {})},
    storage: {...summarize(storage), ...(storage.ok ? {
      buckets: storage.body.map(b => ({id: clean(b.id), name: clean(b.name), public: b.public === true}))
    } : {})}
  };
  return {
    checkedAt: new Date().toISOString(), projectRef: project.projectRef,
    apiUrl: project.apiUrl, observed,
    connectivityVerified: auth.ok && schema.ok && storage.ok,
    expectedTablesAccessible: tableProbes.length === EXPECTED_TABLES.length && tableProbes.every(t => t.ok),
    migrationVerified: false,
    operationalReady: false,
    limitations: [
      'Only the exposed public Data API schema is inspected; private schemas are not inventoried.',
      'No SQL migrations, customer rows, file bytes, RLS policies, real sign-ins or business flows are tested.',
      'API connectivity does not activate the PostgreSQL/Storage adapter or migrate D1/R2.'
    ]
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const project = JSON.parse(await readFile(new URL('../config/supabase-project.json', import.meta.url), 'utf8'));
    const result = await inspectConnection({project});
    console.log(JSON.stringify(result, null, 2));
    // Exit 2 means connectivity works but the application's tables are not accessible.
    process.exitCode = !result.connectivityVerified ? 1 : result.expectedTablesAccessible ? 0 : 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
