// Temporary, server-authenticated, read-only export. Inactive unless enabled.
export const MIGRATION_TABLES = Object.freeze(['attachments','auth_limits','finance_audit','finance_records','finance_transactions','journal_lines','journals','laundry_counters','laundry_demo_sessions','laundry_events','laundry_mutations','laundry_orders','laundry_proofs','laundry_rooms','members','mutations','staff_sessions','workspace']);
const digest = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
async function equals(a, b) { const [x, y] = await Promise.all([digest(a), digest(b)]); let diff = 0; for (let i=0; i<x.length; i++) diff |= x[i] ^ y[i]; return diff === 0; }
export async function migrationExport(req, env) {
  const expires = Date.parse(env.TOP_HILLS_MIGRATION_EXPIRES || '');
  const supplied = req.headers.get('X-Top-Hills-Migration') || '';
  if (req.method !== 'GET' || env.TOP_HILLS_MIGRATION_MODE !== 'export' ||
      !Number.isFinite(expires) || Date.now() >= expires ||
      !/^[a-f0-9]{64}$/.test(env.TOP_HILLS_MIGRATION_TOKEN || '') ||
      !/^[a-f0-9]{64}$/.test(supplied) || !await equals(supplied, env.TOP_HILLS_MIGRATION_TOKEN)) {
    return Response.json({error: 'Akses migrasi tidak tersedia.'}, {status: 403});
  }
  const u = new URL(req.url), table = u.searchParams.get('table');
  const headers = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'};
  if (u.searchParams.get('object')) {
    const object = await env.BUCKET.get(u.searchParams.get('object'));
    return object ? new Response(object.body, {headers}) : new Response(null, {status:404, headers});
  }
  if (u.searchParams.has('objects')) {
    return Response.json(await env.BUCKET.list({limit:100, ...(u.searchParams.get('cursor') ? {cursor:u.searchParams.get('cursor')} : {})}), {headers});
  }
  if (!table) return Response.json({tables:MIGRATION_TABLES, mode:'read-only', writesPaused:true}, {headers});
  if (!MIGRATION_TABLES.includes(table)) return Response.json({error:'Tabel tidak tersedia.'}, {status:400,headers});
  const after = u.searchParams.get('after') || '';
  const rows = (await env.DB.prepare(`SELECT * FROM ${table} WHERE id>? ORDER BY id LIMIT 26`).bind(after).all()).results;
  const page = rows.slice(0,25);
  return Response.json({table,rows:page,next:rows.length>25?page.at(-1).id:null}, {headers});
}
