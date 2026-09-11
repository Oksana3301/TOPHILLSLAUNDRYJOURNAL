import postgres from 'npm:postgres@3.4.9';
import worker, {runScheduled} from '../../../server/worker.mjs';
import {PostgresDatabase} from '../../../server/postgres-db.mjs';
import {SupabaseStorage} from '../../../server/supabase-storage.mjs';
import {backendRequest} from '../../../server/supabase-gateway.mjs';
import config from '../../../config/supabase-backend.json' with {type: 'json'};

let database;
function DB() {
  if (!database) {
    const url = Deno.env.get('SUPABASE_DB_URL');
    if (!url) throw new Error('Database connection unavailable');
    const client = postgres(url, {prepare: false, max: 1, connect_timeout: 10, idle_timeout: 20,
      types: {bigint: {to: 20, from: [20], serialize: String, parse: BigInt}, numeric: {to: 1700, from: [1700], serialize: String, parse: Number}}});
    database = new PostgresDatabase(callback => client.begin(async tx => {
      await tx.unsafe("SET LOCAL ROLE service_role; SET LOCAL search_path=public; SET LOCAL statement_timeout='20s'");
      return callback({query: async (sql, values) => {const rows = await tx.unsafe(sql, values); return {rows: [...rows], rowCount: rows.count};}});
    }));
  }
  return database;
}
function namedKey(name, fallback) {
  try {return JSON.parse(Deno.env.get(name) || '{}').default || Deno.env.get(fallback) || '';}
  catch {throw new Error('Supabase key configuration unavailable');}
}
Deno.serve(async req => {
  const trusted = await backendRequest(req, config);
  if (!trusted) return Response.json({error: 'Unauthorized'}, {status: 401});
  try {
    const env = {DATA_BACKEND: 'postgres', DB: DB(), AUTH_SESSION_KEY: trusted.sessionKey,
      SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
      SUPABASE_PUBLISHABLE_KEY: namedKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')};
    env.BUCKET = new SupabaseStorage({url: env.SUPABASE_URL, key: namedKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY'), DB: env.DB});
    const path = new URL(trusted.request.url).pathname;
    if (path === '/api/__backend/health') {
      const row = await env.DB.prepare('SELECT revision FROM workspace WHERE id=?').bind('main').first();
      const bucket = await env.DB.prepare('SELECT public FROM storage.buckets WHERE id=?').bind('top-hills-evidence').first();
      return Response.json({ok: true, database: 'postgres', workspacePresent: !!row, revision: row?.revision ?? null, privateStorage: bucket?.public === 0});
    }
    if (path.startsWith('/api/__backend/')) {
      if (path !== '/api/__backend/scheduled' || !trusted.internal || req.method !== 'POST') return new Response(null, {status: 404});
      return Response.json(await runScheduled(env));
    }
    return await worker.fetch(trusted.request, env);
  } catch (error) {
    // Do not log SQL parameters, connection strings, request headers, or data.
    console.error('Top Hills backend failure', error?.code || error?.name || 'unknown');
    return Response.json({error: 'Penyimpanan belum tersedia. Coba lagi sebentar.'}, {status: 503, headers: {'Cache-Control': 'no-store'}});
  }
});
