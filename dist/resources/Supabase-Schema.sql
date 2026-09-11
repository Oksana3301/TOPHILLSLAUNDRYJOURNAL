-- TOP HILLS: server-only Supabase persistence blueprint, 2026-09-10.
-- PREPARATION ONLY. Not applied to a database; no application adapter is active.
-- Run only after reviewing against a NEW, dedicated Supabase project.
-- Existing objects cause this migration to fail rather than be replaced/dropped.
-- Keep th_private OUT of Supabase's exposed schemas. The public RPCs below are
-- callable only by service_role. Never ship a secret/service key to a browser.
--
-- Trust boundary: Sites authenticates the request; the worker supplies actor_id
-- from trusted identity headers and performs resource-level business validation.
-- RPC read/commit responses contain UNPROJECTED workspace data for the worker.
-- The worker MUST run its role/customer projection before responding to clients.
-- RLS intentionally grants no browser access. service_role bypasses RLS.
--
-- No DROP, TRUNCATE, DELETE, seed data, provider switch, Storage mutation, or
-- Supabase Auth account creation is performed by this file.

begin;

create schema if not exists th_private;
revoke all on schema th_private from public, anon, authenticated;
grant usage on schema th_private to service_role;

create table th_private.workspaces (
  id text primary key check (length(btrim(id)) between 1 and 128),
  owner_id text not null check (length(btrim(owner_id)) between 1 and 512),
  revision bigint not null check (revision between 0 and 9007199254740991),
  imported_from_revision bigint not null check (imported_from_revision >= 0),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now(),
  check (data ? 'ownerId' and data->>'ownerId' = owner_id),
  check (data ? 'operations' and jsonb_typeof(data->'operations') = 'object'),
  check (data ? 'finance' and jsonb_typeof(data->'finance') = 'object')
);

create table th_private.members (
  workspace_id text not null references th_private.workspaces(id),
  id text not null check (length(btrim(id)) between 1 and 512),
  name text not null check (length(btrim(name)) between 1 and 300),
  email text not null default '' check (length(email) <= 500),
  role text not null check (role in ('Owner','Finance','Operator','Konsumen')),
  status text not null check (status in ('Aktif','Nonaktif','Menunggu')),
  profile jsonb not null default '{}'::jsonb
    check (jsonb_typeof(profile) = 'object'),
  access_version bigint not null default 0
    check (access_version between 0 and 9007199254740991),
  created_at timestamptz not null,
  primary key (workspace_id, id)
);

-- Explicit one-active-account-per-profile policy. Resolve existing duplicates
-- before importing; never silently merge identity subjects or match by email.
create unique index th_one_active_operator_profile
  on th_private.members (workspace_id, (profile->>'employeeId'))
  where role = 'Operator' and status = 'Aktif'
    and coalesce(profile->>'employeeId', '') <> '';
create unique index th_one_active_consumer_profile
  on th_private.members (workspace_id, (profile->>'customerId'))
  where role = 'Konsumen' and status = 'Aktif'
    and coalesce(profile->>'customerId', '') <> '';

create table th_private.mutations (
  workspace_id text not null references th_private.workspaces(id),
  id text not null check (length(btrim(id)) between 1 and 512),
  actor_id text not null check (length(btrim(actor_id)) between 1 and 512),
  endpoint text,
  request_hash text,
  legacy_unbound boolean not null default false,
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  committed_revision bigint,
  created_at timestamptz not null default now(),
  primary key (workspace_id, id),
  check (
    (legacy_unbound and endpoint is null and request_hash is null)
    or
    (not legacy_unbound and endpoint is not null
      and request_hash is not null and request_hash ~ '^[0-9a-f]{64}$'
      and committed_revision is not null and committed_revision >= 0)
  )
);

alter table th_private.workspaces enable row level security;
alter table th_private.members enable row level security;
alter table th_private.mutations enable row level security;
-- No allow policies: normal roles are denied even if grants are added later.
revoke all on th_private.workspaces, th_private.members, th_private.mutations
  from public, anon, authenticated;
grant select, insert, update on th_private.workspaces, th_private.members
  to service_role;
grant select, insert on th_private.mutations to service_role;

create function th_private.assert_state(p_state jsonb, p_owner_id text)
returns void language plpgsql immutable security invoker set search_path = ''
as $$
declare
  v_key text;
  v_rows jsonb;
begin
  if p_state is null or jsonb_typeof(p_state) is distinct from 'object'
    or octet_length(p_state::text) > 8000000
    or p_state->>'ownerId' is distinct from p_owner_id
    or jsonb_typeof(p_state->'operations') is distinct from 'object'
    or jsonb_typeof(p_state->'finance') is distinct from 'object'
    or jsonb_typeof(p_state#>'{operations,settings}') is distinct from 'object'
    or jsonb_typeof(p_state#>'{finance,policies}') is distinct from 'object'
  then
    raise sqlstate 'PT400' using message = 'Invalid workspace structure';
  end if;
  foreach v_key in array array[
    'orders','invoices','reports','evaluations','settlements','requests',
    'tenants','employees','audit'
  ] loop
    v_rows := p_state->'operations'->v_key;
    if jsonb_typeof(v_rows) is distinct from 'array' then
      raise sqlstate 'PT400' using message = 'Missing operations array: ' || v_key;
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_rows) e
      where jsonb_typeof(e) is distinct from 'object'
        or jsonb_typeof(e->'id') is distinct from 'string'
        or length(btrim(e->>'id')) = 0
    ) or (select count(*) from jsonb_array_elements(v_rows)) <>
      (select count(distinct e->>'id') from jsonb_array_elements(v_rows) e)
    then
      raise sqlstate 'PT400' using message = 'Invalid or duplicate operations IDs: ' || v_key;
    end if;
  end loop;
  foreach v_key in array array[
    'transactions','journals','attachments','bankRows','periods',
    'snapshots','budgets','insights','audit'
  ] loop
    v_rows := p_state->'finance'->v_key;
    if jsonb_typeof(v_rows) is distinct from 'array' then
      raise sqlstate 'PT400' using message = 'Missing finance array: ' || v_key;
    end if;
    if exists (
      select 1 from jsonb_array_elements(v_rows) e
      where jsonb_typeof(e) is distinct from 'object'
        or jsonb_typeof(e->'id') is distinct from 'string'
        or length(btrim(e->>'id')) = 0
    ) or (select count(*) from jsonb_array_elements(v_rows)) <>
      (select count(distinct e->>'id') from jsonb_array_elements(v_rows) e)
    then
      raise sqlstate 'PT400' using message = 'Invalid or duplicate finance IDs: ' || v_key;
    end if;
  end loop;
end;
$$;

create function th_private.member_access_version()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.workspace_id is distinct from old.workspace_id
    or new.created_at is distinct from old.created_at
  then
    raise sqlstate 'PT403' using message = 'Identity subject and creation time are immutable';
  end if;
  if exists (
    select 1 from th_private.workspaces w
    where w.id = old.workspace_id and w.owner_id = old.id
  ) and (new.role <> 'Owner' or new.status <> 'Aktif') then
    raise sqlstate 'PT403' using message = 'Primary Owner must remain active Owner';
  end if;
  if old.access_version >= 9007199254740991 then
    raise sqlstate 'PT409' using message = 'Membership version limit reached';
  end if;
  new.access_version := old.access_version + 1;
  return new;
end;
$$;

create trigger th_member_access_version
before update on th_private.members
for each row execute function th_private.member_access_version();

-- Canonical hash is calculated inside PostgreSQL, not accepted from the client.
-- It binds the endpoint, workspace, actor, revision, membership version, and
-- original validated request. Keep the ORIGINAL request/IDs on ambiguous retry.
-- Do not include generated IDs/timestamps/next_state in p_request on retries.
create function th_private.mutation_hash(
  p_workspace_id text, p_actor_id text, p_endpoint text,
  p_expected_revision bigint, p_access_version bigint, p_request jsonb
)
returns text language sql immutable security invoker set search_path = ''
as $$
  select encode(sha256(convert_to(jsonb_build_array(
    'top-hills-mutation-v1', p_workspace_id, p_actor_id, p_endpoint,
    p_expected_revision, p_access_version, p_request
  )::text, 'UTF8')), 'hex');
$$;

-- Returns whole state to the trusted worker, NEVER directly to the browser.
-- One SQL statement reads member + workspace from a consistent snapshot.
create function public.th_read_state(p_workspace_id text, p_actor_id text)
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare v_result jsonb;
begin
  select jsonb_build_object('workspace', to_jsonb(w), 'member', to_jsonb(m))
    into v_result
  from th_private.workspaces w
  join th_private.members m on m.workspace_id = w.id
  where w.id = p_workspace_id and m.id = p_actor_id and m.status = 'Aktif';
  if v_result is null then
    raise sqlstate 'PT403' using message = 'Active workspace membership required';
  end if;
  return v_result;
end;
$$;

-- General business-state CAS. The worker MUST enforce domain transitions,
-- resource ownership, accounting invariants, field-level permissions, request
-- size limits, and projection. This RPC adds coarse endpoint-role gating and
-- rechecks the exact membership version under the workspace lock.
create function public.th_commit_state(
  p_workspace_id text, p_actor_id text, p_expected_revision bigint,
  p_access_version bigint, p_mutation_id text, p_endpoint text,
  p_request jsonb, p_next_state jsonb, p_result jsonb
)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_w th_private.workspaces%rowtype;
  v_m th_private.members%rowtype;
  v_previous th_private.mutations%rowtype;
  v_hash text;
  v_link text;
  v_allowed boolean := false;
begin
  if p_expected_revision is null or p_access_version is null
    or p_expected_revision < 0 or p_access_version < 0
    or p_mutation_id is null or length(btrim(p_mutation_id)) not between 1 and 512
    or jsonb_typeof(p_request) is distinct from 'object'
    or octet_length(p_request::text) > 8000000
    or jsonb_typeof(p_result) is distinct from 'object'
    or octet_length(p_result::text) > 64000
  then raise sqlstate 'PT400' using message = 'Invalid mutation envelope'; end if;

  select * into v_w from th_private.workspaces
    where id = p_workspace_id for update;
  if not found then raise sqlstate 'PT404' using message = 'Workspace not initialized'; end if;
  select * into v_m from th_private.members
    where workspace_id = p_workspace_id and id = p_actor_id for share;
  if not found or v_m.status <> 'Aktif' then
    raise sqlstate 'PT403' using message = 'Active workspace membership required';
  end if;
  if p_endpoint = any(array[
    '/api/operations','/api/transactions','/api/post','/api/proof','/api/scan',
    '/api/reverse','/api/policies','/api/snapshot','/api/period','/api/bank-import',
    '/api/match','/api/insight','/api/budget','/api/cash-closing','/api/migration',
    '/internal/snapshot-catchup'
  ]) then
    v_allowed := v_m.role = 'Owner'
      or (v_m.role = 'Finance' and p_endpoint = any(array[
        '/api/transactions','/api/post','/api/proof','/api/scan','/api/reverse',
        '/api/snapshot','/api/bank-import','/api/match','/api/insight',
        '/api/cash-closing','/internal/snapshot-catchup'
      ]))
      or (v_m.role = 'Operator' and p_endpoint = any(array[
        '/api/operations','/api/transactions','/api/post','/api/proof','/api/cash-closing'
      ]))
      or (v_m.role = 'Konsumen' and p_endpoint = '/api/operations');
  end if;
  if not coalesce(v_allowed, false) then
    raise sqlstate 'PT403' using message = 'Endpoint not permitted for current role';
  end if;

  if v_m.role = 'Operator' then
    v_link := nullif(v_m.profile->>'employeeId', '');
    if v_link is null or not exists (
      select 1 from jsonb_array_elements(v_w.data#>'{operations,employees}') e
      where e->>'id' = v_link and e->'active' = 'true'::jsonb
    ) then raise sqlstate 'PT403' using message = 'Link an active employee before writing'; end if;
  elsif v_m.role = 'Konsumen' then
    v_link := nullif(v_m.profile->>'customerId', '');
    if v_link is null or not exists (
      select 1 from jsonb_array_elements(v_w.data#>'{operations,tenants}') t
      where t->>'id' = v_link and t->>'status' = 'Aktif'
    ) then raise sqlstate 'PT403' using message = 'Link an active tenant before writing'; end if;
  end if;

  v_hash := th_private.mutation_hash(p_workspace_id, p_actor_id, p_endpoint,
    p_expected_revision, p_access_version, p_request);
  select * into v_previous from th_private.mutations
    where workspace_id = p_workspace_id and id = p_mutation_id;
  if found then
    if v_previous.legacy_unbound
      or v_previous.actor_id is distinct from p_actor_id
      or v_previous.endpoint is distinct from p_endpoint
      or v_previous.request_hash is distinct from v_hash
    then raise sqlstate 'PT409' using message = 'Mutation ID is bound to a different or legacy request'; end if;
    return jsonb_build_object('workspace', to_jsonb(v_w), 'member', to_jsonb(v_m),
      'result', v_previous.result, 'replayed', true);
  end if;
  if v_m.access_version <> p_access_version then
    raise sqlstate 'PT409' using message = 'Membership changed; refresh and revalidate';
  end if;
  if v_w.revision <> p_expected_revision then
    raise sqlstate 'PT409' using message = 'Workspace changed; refresh and revalidate';
  end if;
  if v_w.revision >= 9007199254740991 then
    raise sqlstate 'PT409' using message = 'Workspace revision limit reached';
  end if;
  perform th_private.assert_state(p_next_state, v_w.owner_id);

  update th_private.workspaces
    set data = p_next_state, revision = revision + 1, updated_at = clock_timestamp()
    where id = p_workspace_id and revision = p_expected_revision returning * into v_w;
  if not found then raise sqlstate 'PT409' using message = 'Workspace changed'; end if;
  insert into th_private.mutations
    (workspace_id,id,actor_id,endpoint,request_hash,result,committed_revision)
    values (p_workspace_id,p_mutation_id,p_actor_id,p_endpoint,v_hash,p_result,v_w.revision);
  return jsonb_build_object('workspace',to_jsonb(v_w),'member',to_jsonb(v_m),
    'result',p_result,'replayed',false);
end;
$$;

-- Atomic Owner-only account access update, CAS, audit, and mutation insertion.
-- p_request uses existing /api/member fields: id, role, status, employeeId,
-- customerId. Identity subjects, names, emails, and created_at are preserved.
-- Empty profile links are allowed for setup after reset, but business writes
-- by unlinked Operators/Konsumen are denied by th_commit_state above.
create function public.th_change_member(
  p_workspace_id text, p_actor_id text, p_expected_revision bigint,
  p_access_version bigint, p_mutation_id text, p_request jsonb
)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_w th_private.workspaces%rowtype;
  v_actor th_private.members%rowtype;
  v_target th_private.members%rowtype;
  v_before th_private.members%rowtype;
  v_previous th_private.mutations%rowtype;
  v_hash text;
  v_profile jsonb;
  v_state jsonb;
  v_audit jsonb;
  v_result jsonb;
begin
  if p_expected_revision is null or p_access_version is null
    or p_expected_revision < 0 or p_access_version < 0
    or p_mutation_id is null or length(btrim(p_mutation_id)) not between 1 and 512
    or jsonb_typeof(p_request) is distinct from 'object'
    or octet_length(p_request::text) > 64000
  then raise sqlstate 'PT400' using message = 'Invalid member mutation envelope'; end if;

  select * into v_w from th_private.workspaces where id = p_workspace_id for update;
  if not found then raise sqlstate 'PT404' using message = 'Workspace not initialized'; end if;
  select * into v_actor from th_private.members
    where workspace_id = p_workspace_id and id = p_actor_id for share;
  if not found or v_actor.role <> 'Owner' or v_actor.status <> 'Aktif' then
    raise sqlstate 'PT403' using message = 'Active Owner required';
  end if;
  v_hash := th_private.mutation_hash(p_workspace_id,p_actor_id,'/api/member',
    p_expected_revision,p_access_version,p_request);
  select * into v_previous from th_private.mutations
    where workspace_id = p_workspace_id and id = p_mutation_id;
  if found then
    if v_previous.legacy_unbound or v_previous.actor_id is distinct from p_actor_id
      or v_previous.endpoint is distinct from '/api/member'
      or v_previous.request_hash is distinct from v_hash
    then raise sqlstate 'PT409' using message = 'Mutation ID is bound to a different or legacy request'; end if;
    return jsonb_build_object('workspace',to_jsonb(v_w),'member',to_jsonb(v_actor),
      'result',v_previous.result,'replayed',true);
  end if;
  if v_actor.access_version <> p_access_version then
    raise sqlstate 'PT409' using message = 'Membership changed; refresh and revalidate';
  end if;
  if v_w.revision <> p_expected_revision or v_w.revision >= 9007199254740991 then
    raise sqlstate 'PT409' using message = 'Workspace changed; refresh and revalidate';
  end if;
  if jsonb_typeof(p_request->'id') is distinct from 'string'
    or nullif(p_request->>'id','') is null
    or coalesce(p_request->>'role','') not in ('Owner','Finance','Operator','Konsumen')
    or coalesce(p_request->>'status','') not in ('Aktif','Nonaktif','Menunggu')
    or (p_request ? 'employeeId' and jsonb_typeof(p_request->'employeeId') is distinct from 'string')
    or (p_request ? 'customerId' and jsonb_typeof(p_request->'customerId') is distinct from 'string')
  then raise sqlstate 'PT400' using message = 'Invalid member access fields'; end if;

  select * into v_target from th_private.members
    where workspace_id = p_workspace_id and id = p_request->>'id' for update;
  if not found then raise sqlstate 'PT404' using message = 'Account must already exist'; end if;
  if v_target.id = v_w.owner_id
    and (p_request->>'role' <> 'Owner' or p_request->>'status' <> 'Aktif') then
    raise sqlstate 'PT403' using message = 'Primary Owner must remain active Owner';
  end if;
  v_before := v_target;
  v_profile := v_target.profile || jsonb_build_object(
    'employeeId',coalesce(p_request->>'employeeId',''),
    'customerId',coalesce(p_request->>'customerId',''));
  if nullif(v_profile->>'employeeId','') is not null and not exists (
    select 1 from jsonb_array_elements(v_w.data#>'{operations,employees}') e
    where e->>'id' = v_profile->>'employeeId'
      and (p_request->>'role' <> 'Operator' or p_request->>'status' <> 'Aktif'
        or e->'active' = 'true'::jsonb)
  ) then raise sqlstate 'PT400' using message = 'Employee link is invalid'; end if;
  if nullif(v_profile->>'customerId','') is not null and not exists (
    select 1 from jsonb_array_elements(v_w.data#>'{operations,tenants}') t
    where t->>'id' = v_profile->>'customerId'
      and (p_request->>'role' <> 'Konsumen' or p_request->>'status' <> 'Aktif'
        or t->>'status' = 'Aktif')
  ) then raise sqlstate 'PT400' using message = 'Tenant link is invalid'; end if;

  update th_private.members set role = p_request->>'role',
    status = p_request->>'status', profile = v_profile
    where workspace_id = p_workspace_id and id = v_target.id returning * into v_target;
  v_audit := jsonb_build_object('id',gen_random_uuid()::text,'actor',v_actor.id,
    'actorName',v_actor.name,'at',clock_timestamp(),'action','Ubah akses anggota',
    'objectId',v_target.id,
    'before',jsonb_build_object('role',v_before.role,'status',v_before.status,'profile',v_before.profile),
    'after',jsonb_build_object('role',v_target.role,'status',v_target.status,'profile',v_target.profile));
  v_state := jsonb_set(v_w.data,'{finance,audit}',
    jsonb_build_array(v_audit) || (v_w.data#>'{finance,audit}'));
  perform th_private.assert_state(v_state,v_w.owner_id);
  update th_private.workspaces set data = v_state, revision = revision + 1,
    updated_at = clock_timestamp() where id = p_workspace_id returning * into v_w;
  v_result := jsonb_build_object('objectId',v_target.id,'accessVersion',v_target.access_version);
  insert into th_private.mutations
    (workspace_id,id,actor_id,endpoint,request_hash,result,committed_revision)
    values (p_workspace_id,p_mutation_id,p_actor_id,'/api/member',v_hash,v_result,v_w.revision);
  -- A secondary Owner can change their own role/status; return its NEW value.
  select * into v_actor from th_private.members
    where workspace_id = p_workspace_id and id = p_actor_id;
  return jsonb_build_object('workspace',to_jsonb(v_w),'member',to_jsonb(v_actor),
    'result',v_result,'replayed',false);
end;
$$;

-- One-time import into an ABSENT workspace, called only from trusted migration
-- tooling. The owner is explicitly supplied from the source, never first login.
-- p_members accepts existing D1 profile JSON strings or normalized JSON objects.
-- created_at and identity IDs are retained. Target revision = source + 1 fences
-- old, in-flight D1 writes, including when no legacy mutations are imported.
-- Legacy mutation IDs/results can be retained, but are marked non-replayable:
-- D1 hashes were not bound to endpoints and cannot safely become trusted hashes.
-- Re-running an import into any existing workspace always fails without changes.
create function public.th_bootstrap_import(
  p_workspace_id text, p_owner_id text, p_source_revision bigint,
  p_state jsonb, p_members jsonb, p_legacy_mutations jsonb default '[]'::jsonb
)
returns jsonb language plpgsql volatile security invoker set search_path = ''
as $$
declare
  v_item jsonb;
  v_profile jsonb;
  v_result jsonb;
  v_inserted text;
begin
  if p_workspace_id is null or length(btrim(p_workspace_id)) not between 1 and 128
    or p_owner_id is null or length(btrim(p_owner_id)) not between 1 and 512
    or p_source_revision is null or p_source_revision not between 0 and 9007199254740990
    or jsonb_typeof(p_members) is distinct from 'array'
    or jsonb_typeof(p_legacy_mutations) is distinct from 'array'
  then raise sqlstate 'PT400' using message = 'Invalid import envelope'; end if;
  perform th_private.assert_state(p_state,p_owner_id);
  if not exists (select 1 from jsonb_array_elements(p_members) m
    where m->>'id' = p_owner_id and m->>'role' = 'Owner' and m->>'status' = 'Aktif') then
    raise sqlstate 'PT400' using message = 'Source must contain the exact active primary Owner';
  end if;

  insert into th_private.workspaces(id,owner_id,revision,imported_from_revision,data)
    values (p_workspace_id,p_owner_id,p_source_revision+1,p_source_revision,p_state)
    on conflict (id) do nothing returning id into v_inserted;
  if v_inserted is null then
    raise sqlstate 'PT409' using message = 'Workspace already exists; import will not overwrite it';
  end if;

  for v_item in select value from jsonb_array_elements(p_members) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item->'id') is distinct from 'string'
      or jsonb_typeof(v_item->'name') is distinct from 'string'
      or jsonb_typeof(v_item->'role') is distinct from 'string'
      or jsonb_typeof(v_item->'status') is distinct from 'string'
      or nullif(v_item->>'created_at','') is null
    then raise sqlstate 'PT400' using message = 'Invalid source member'; end if;
    v_profile := case when jsonb_typeof(v_item->'profile') = 'string'
      then (v_item->>'profile')::jsonb else coalesce(v_item->'profile','{}'::jsonb) end;
    insert into th_private.members
      (workspace_id,id,name,email,role,status,profile,access_version,created_at)
      values (p_workspace_id,v_item->>'id',v_item->>'name',coalesce(v_item->>'email',''),
        v_item->>'role',v_item->>'status',v_profile,0,(v_item->>'created_at')::timestamptz);
  end loop;

  for v_item in select value from jsonb_array_elements(p_legacy_mutations) loop
    if jsonb_typeof(v_item) is distinct from 'object'
      or jsonb_typeof(v_item->'id') is distinct from 'string'
      or jsonb_typeof(v_item->'actor') is distinct from 'string'
      or nullif(v_item->>'created_at','') is null
    then raise sqlstate 'PT400' using message = 'Invalid source mutation'; end if;
    v_result := case when jsonb_typeof(v_item->'result') = 'string'
      then (v_item->>'result')::jsonb else v_item->'result' end;
    insert into th_private.mutations
      (workspace_id,id,actor_id,endpoint,request_hash,legacy_unbound,result,created_at)
      values (p_workspace_id,v_item->>'id',v_item->>'actor',null,null,true,
        v_result,(v_item->>'created_at')::timestamptz);
  end loop;
  return jsonb_build_object('workspaceId',p_workspace_id,'ownerId',p_owner_id,
    'sourceRevision',p_source_revision,'revision',p_source_revision+1,
    'memberCount',jsonb_array_length(p_members),
    'legacyMutationCount',jsonb_array_length(p_legacy_mutations));
end;
$$;

-- Explicit, signature-specific grants. No unrelated public RPCs are changed.
-- Functions are created and restricted in this one transaction, avoiding an
-- intermediate deployment window with their default PUBLIC execute privilege.
revoke all on function th_private.assert_state(jsonb,text) from public,anon,authenticated;
revoke all on function th_private.member_access_version() from public,anon,authenticated;
revoke all on function th_private.mutation_hash(text,text,text,bigint,bigint,jsonb) from public,anon,authenticated;
revoke all on function public.th_read_state(text,text) from public,anon,authenticated;
revoke all on function public.th_commit_state(text,text,bigint,bigint,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.th_change_member(text,text,bigint,bigint,text,jsonb) from public,anon,authenticated;
revoke all on function public.th_bootstrap_import(text,text,bigint,jsonb,jsonb,jsonb) from public,anon,authenticated;

grant execute on function th_private.assert_state(jsonb,text) to service_role;
grant execute on function th_private.member_access_version() to service_role;
grant execute on function th_private.mutation_hash(text,text,text,bigint,bigint,jsonb) to service_role;
grant execute on function public.th_read_state(text,text) to service_role;
grant execute on function public.th_commit_state(text,text,bigint,bigint,text,text,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.th_change_member(text,text,bigint,bigint,text,jsonb) to service_role;
grant execute on function public.th_bootstrap_import(text,text,bigint,jsonb,jsonb,jsonb) to service_role;

commit;

-- Integration gates before activation:
-- * Apply and execute acceptance tests on a disposable Postgres/Supabase project.
-- * Confirm th_private is not exposed and anon/authenticated cannot call RPCs.
-- * Preserve authenticated Sites actor identity; never take actor_id from JSON.
-- * Treat members.profile as JSONB (the current worker expects a JSON string).
-- * Keep revision + access_version from the state used for business validation.
-- * Map PT409 to HTTP 409 and preserve the original request on ambiguous retry.
-- * Project all raw state responses; an unlinked consumer gets zero records.
-- * Add bounded Owner-only membership listing and pending-user enrollment RPCs
--   before adapting /api/members/bootstrap. Do not grant a new login Owner.
-- * Current scheduled synthetic identity needs an explicitly authorized job
--   principal/RPC. Do not silently bypass membership checks for cron.
-- * R2/Supabase Storage, deletion outbox, reset, migration of object bytes, and
--   provider selection are deliberately absent from this non-destructive draft.
-- * Full accounting validation still belongs to the trusted worker. Coarse SQL
--   endpoint checks alone do not validate a financial posting or consumer edit.
