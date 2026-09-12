import postgres from 'npm:postgres@3.4.9';
import {backendRequest} from '../../../server/supabase-gateway.mjs';
import config from '../../../config/supabase-backend.json' with {type: 'json'};

// Temporary, explicitly authorized invitation for the existing ChatGPT Owner.
// This function never accepts an email/role, grants membership, or reveals a login link.
const OPERATION = 'owner-email-20260912';
const EXPIRES_AT = Date.parse('2026-09-12T14:00:00Z');
const EMAIL_HASH = 'c6057bdb8d0cb067ef5330bbb48f4320c21b3d0ae75c11b042b3121010f74db5';
const ORIGIN = 'https://tophillslaundryjournal.vercel.app';
const SOURCE_PATH = '/api/__backend/owner-invite';
const REDIRECT_TO = ORIGIN + '/login';
const SUPABASE_URL = 'https://dkiqgwziefazwrcieavq.supabase.co';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const reply = (value, status = 200) => Response.json(value, {
  status, headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}
});
let database;
function db() {
  if (!database) {
    const url = Deno.env.get('SUPABASE_DB_URL');
    if (!url) throw new Error('Database unavailable');
    database = postgres(url, {prepare: false, max: 1, connect_timeout: 10, idle_timeout: 20});
  }
  return database;
}
function profileOf(value) {
  const profile = JSON.parse(value || '{}');
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) throw new Error('Invalid profile');
  return profile;
}
async function digest(value) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
}
async function transaction(callback) {
  return db().begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE service_role; SET LOCAL search_path=public; SET LOCAL statement_timeout='10s'");
    return callback(tx);
  });
}
async function claim() {
  return transaction(async tx => {
    const owners = await tx.unsafe(
      "SELECT id,email,profile FROM public.members WHERE role='Owner' AND status='Aktif' AND id NOT LIKE 'sb:%' FOR UPDATE"
    );
    const matches = [];
    for (const row of owners) {
      const email = normalizeEmail(row.email);
      if (await digest(email) === EMAIL_HASH) matches.push({...row, email});
    }
    if (matches.length !== 1) return null;
    const owner = matches[0], profile = profileOf(owner.profile);
    if (profile.ownerEmailInvitation) return {owner, previous: profile.ownerEmailInvitation};
    const marker = {operation: OPERATION, state: 'processing', updatedAt: new Date().toISOString()};
    profile.ownerEmailInvitation = marker;
    await tx.unsafe('UPDATE public.members SET profile=$1 WHERE id=$2', [JSON.stringify(profile), owner.id]);
    return {owner};
  });
}
async function transition(ownerId, expected, state, fields = {}) {
  return transaction(async tx => {
    const rows = await tx.unsafe('SELECT profile FROM public.members WHERE id=$1 FOR UPDATE', [ownerId]);
    if (rows.length !== 1) throw new Error('Owner unavailable');
    const profile = profileOf(rows[0].profile), current = profile.ownerEmailInvitation;
    if (!current || current.operation !== OPERATION || current.state !== expected) {
      throw new Error('Invitation state changed');
    }
    profile.ownerEmailInvitation = {...current, ...fields, state, updatedAt: new Date().toISOString()};
    await tx.unsafe('UPDATE public.members SET profile=$1 WHERE id=$2', [JSON.stringify(profile), ownerId]);
  });
}
function previousResponse(marker) {
  const safe = UUID.test(marker?.userId || '') ? {userId: marker.userId} : {};
  if (marker?.operation !== OPERATION) return reply({code: 'invite_operation_conflict'}, 409);
  if (marker.state === 'sent') return reply({code: 'invitation_sent', ...safe, redirectReady: true});
  if (marker.state === 'blocked') {
    return reply({code: marker.code === 'invite_expired' ? 'invite_expired' : 'invite_redirect_not_allowed',
      ...safe, redirectReady: false}, 409);
  }
  if (['processing', 'prepared', 'sending'].includes(marker.state)) {
    return reply({code: 'invite_processing', ...safe}, 202);
  }
  return reply({code: 'invite_previous_attempt_failed', ...safe}, 409);
}
function secretKey() {
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || keys.default || '';
  if (typeof key !== 'string' || !key || Deno.env.get('SUPABASE_URL') !== SUPABASE_URL) throw new Error('Auth unavailable');
  return key;
}
function providerCode(data) {
  const code = data?.error_code || data?.code;
  return ['over_email_send_rate_limit', 'over_request_rate_limit', 'email_address_not_authorized',
    'email_provider_disabled', 'signup_disabled', 'user_already_exists', 'email_exists',
    'not_admin', 'bad_jwt', 'unexpected_failure'].includes(code) ? code : undefined;
}
async function auth(path, payload) {
  const key = secretKey();
  const response = await fetch(SUPABASE_URL + '/auth/v1' + path, {
    method: 'POST',
    headers: {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'},
    body: JSON.stringify(payload), redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  return {ok: response.ok, status: response.status, data: await response.json().catch(() => null)};
}
async function bodyOf(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const parts = [];
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 256) {await reader.cancel(); return null;}
      parts.push(chunk.value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {bytes.set(part, offset); offset += part.byteLength;}
  try {return JSON.parse(new TextDecoder().decode(bytes));} catch {return null;}
}
Deno.serve(async request => {
  if (request.method !== 'POST') return reply({code: 'not_found'}, 404);
  let ownerId = '', userId = '', state = '';
  const fail = async (code, status = 503, authCode) => {
    if (ownerId && state) {
      try {
        await transition(ownerId, state, 'failure', {code, ...(authCode ? {providerCode: authCode} : {}), ...(userId ? {userId} : {})});
      } catch { /* A processing/sending marker still prevents automatic retries. */ }
    }
    return reply({code, ...(authCode ? {providerCode: authCode} : {}), ...(userId ? {userId} : {})}, status);
  };
  try {
    const trusted = await backendRequest(request, config);
    if (!trusted || trusted.request.url !== ORIGIN + SOURCE_PATH) return reply({code: 'unauthorized'}, 401);
    if (Date.now() >= EXPIRES_AT) return reply({code: 'invite_expired'}, 410);
    const payload = await bodyOf(trusted.request);
    if (!payload || Object.keys(payload).length !== 1 || payload.operation !== OPERATION) {
      return reply({code: 'invalid_operation'}, 400);
    }
    // Validate runtime configuration before claiming an operation.
    secretKey();
    const claimed = await claim();
    if (!claimed) return reply({code: 'owner_not_found'}, 409);
    if (claimed.previous) return previousResponse(claimed.previous);
    ownerId = claimed.owner.id;
    state = 'processing';

    const generated = await auth('/admin/generate_link', {
      type: 'invite', email: claimed.owner.email, redirect_to: REDIRECT_TO
    });
    if (!generated.ok) return fail('invite_preparation_failed', generated.status === 429 ? 429 : 503, providerCode(generated.data));
    if (!UUID.test(generated.data?.id || '') ||
        normalizeEmail(generated.data?.email) !== claimed.owner.email ||
        generated.data?.email_confirmed_at) {
      return fail('invite_identity_mismatch');
    }
    userId = generated.data.id;
    await transition(ownerId, state, 'prepared', {userId});
    state = 'prepared';

    // Supabase returns its validated destination, including Site URL fallback.
    // Keep all invitation tokens and URLs inside this runtime and never return them.
    if (generated.data.redirect_to !== REDIRECT_TO) {
      await transition(ownerId, state, 'blocked', {code: 'invite_redirect_not_allowed'});
      state = '';
      return reply({code: 'invite_redirect_not_allowed', userId, redirectReady: false}, 409);
    }
    if (Date.now() >= EXPIRES_AT) {
      await transition(ownerId, state, 'blocked', {code: 'invite_expired'});
      state = '';
      return reply({code: 'invite_expired', userId, redirectReady: false}, 410);
    }
    // Commit before the mail request. Any uncertain result requires explicit review.
    await transition(ownerId, state, 'sending');
    state = 'sending';
    const sent = await auth('/invite?redirect_to=' + encodeURIComponent(REDIRECT_TO), {
      email: claimed.owner.email
    });
    if (!sent.ok) return fail('invite_send_failed', sent.status === 429 ? 429 : 503, providerCode(sent.data));
    if (sent.data?.id !== userId || normalizeEmail(sent.data?.email) !== claimed.owner.email) {
      return fail('invite_send_result_mismatch');
    }
    await transition(ownerId, state, 'sent', {sentAt: new Date().toISOString()});
    state = '';
    return reply({code: 'invitation_sent', userId, redirectReady: true});
  } catch {
    // Deliberately omit exception text, email, keys, provider bodies and action links.
    return fail('invite_operation_failed');
  }
});
