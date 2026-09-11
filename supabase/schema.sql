-- PostgreSQL schema for Top Hills. Source of truth for local tests and the
-- named migration recorded by the Supabase migration service. No business seed.

CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"object_id" text NOT NULL,
	"object_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"hash" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);

CREATE INDEX "proof_object" ON "attachments" ("object_id");
CREATE INDEX "proof_hash" ON "attachments" ("hash");
CREATE TABLE "finance_audit" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"at" text NOT NULL,
	"action" text NOT NULL,
	"object_id" text NOT NULL,
	"data" text NOT NULL
);

CREATE INDEX "audit_date" ON "finance_audit" ("at");
CREATE TABLE "journal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_id" text NOT NULL,
	"account" text NOT NULL,
	"date" text NOT NULL,
	"unit" text NOT NULL,
	"customer" text DEFAULT '' NOT NULL,
	"debit" bigint DEFAULT 0 NOT NULL,
	"credit" bigint DEFAULT 0 NOT NULL,
	"cash_category" text DEFAULT '' NOT NULL
);

CREATE INDEX "lines_account_date_unit" ON "journal_lines" ("account","date","unit");
CREATE INDEX "lines_journal" ON "journal_lines" ("journal_id");
CREATE TABLE "journals" (
	"id" text PRIMARY KEY NOT NULL,
	"transaction_id" text NOT NULL,
	"date" text NOT NULL,
	"unit" text NOT NULL,
	"data" text NOT NULL
);

CREATE UNIQUE INDEX "journal_transaction_unique" ON "journals" ("transaction_id");
CREATE INDEX "journal_date_unit" ON "journals" ("date","unit");
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text NOT NULL,
	"profile" text DEFAULT '' NOT NULL,
	"created_at" text NOT NULL
);

CREATE TABLE "mutations" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"created_at" text NOT NULL,
	"result" text NOT NULL
);

CREATE TABLE "finance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"date" text NOT NULL,
	"data" text NOT NULL
);

CREATE INDEX "records_kind_date" ON "finance_records" ("kind","date");
CREATE TABLE "finance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"source_key" text NOT NULL,
	"kind" text NOT NULL,
	"unit" text NOT NULL,
	"customer" text DEFAULT '' NOT NULL,
	"date" text NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"data" text NOT NULL
);

CREATE UNIQUE INDEX "txn_source_unique" ON "finance_transactions" ("source_key");
CREATE INDEX "txn_date_unit" ON "finance_transactions" ("date","unit");
CREATE INDEX "txn_status" ON "finance_transactions" ("status");
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"data" text NOT NULL,
	"updated_at" text NOT NULL
);

CREATE TABLE "laundry_counters" (
	"id" text PRIMARY KEY NOT NULL,
	"value" bigint NOT NULL
);

CREATE TABLE "laundry_events" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"actor" text NOT NULL,
	"at" text NOT NULL,
	"action" text NOT NULL,
	"data" text NOT NULL
);

CREATE INDEX "laundry_event_order" ON "laundry_events" ("order_id","at");
CREATE TABLE "laundry_mutations" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"hash" text NOT NULL,
	"result" text NOT NULL
);

CREATE TABLE "laundry_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"submission_key" text NOT NULL,
	"revision" bigint DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"created_at" text NOT NULL,
	"data" text NOT NULL
);

CREATE UNIQUE INDEX "laundry_submission_unique" ON "laundry_orders" ("submission_key");
CREATE UNIQUE INDEX "laundry_token_unique" ON "laundry_orders" ("token_hash");
CREATE INDEX "laundry_date_status" ON "laundry_orders" ("created_at","status");
CREATE INDEX "laundry_room" ON "laundry_orders" ("room_id");
CREATE TABLE "laundry_proofs" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"object_key" text NOT NULL,
	"mime" text NOT NULL,
	"capture" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" text NOT NULL
);

CREATE INDEX "laundry_proof_order" ON "laundry_proofs" ("order_id");
CREATE TABLE "laundry_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text,
	"revision" bigint DEFAULT 0 NOT NULL,
	"data" text NOT NULL
);

CREATE UNIQUE INDEX "room_token_unique" ON "laundry_rooms" ("token_hash");
CREATE TABLE "auth_limits" (
	"id" text PRIMARY KEY NOT NULL,
	"count" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);

CREATE TABLE "staff_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"cipher" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"token_expires_at" bigint NOT NULL,
	"lease_until" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"last_seen" bigint NOT NULL,
	"device" text NOT NULL,
	"revoked" bigint DEFAULT 0 NOT NULL
);

CREATE INDEX "session_user" ON "staff_sessions" ("user_id");
CREATE INDEX "session_expiry" ON "staff_sessions" ("expires_at");
CREATE TABLE "laundry_demo_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"revision" bigint DEFAULT 0 NOT NULL,
	"expires_at" bigint NOT NULL,
	"data" text NOT NULL
);

CREATE INDEX "demo_session_expiry" ON "laundry_demo_sessions" ("expires_at");

-- The protected application server enforces membership and order capabilities.
-- Direct browser Data API access is deliberately unavailable.
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.attachments FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO service_role;
ALTER TABLE public.auth_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_limits FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_limits TO service_role;
ALTER TABLE public.finance_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_audit FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_audit TO service_role;
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_records TO service_role;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.finance_transactions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO service_role;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journal_lines FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journal_lines TO service_role;
ALTER TABLE public.journals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.journals FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.journals TO service_role;
ALTER TABLE public.laundry_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_counters FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_counters TO service_role;
ALTER TABLE public.laundry_demo_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_demo_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_demo_sessions TO service_role;
ALTER TABLE public.laundry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_events TO service_role;
ALTER TABLE public.laundry_mutations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_mutations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_mutations TO service_role;
ALTER TABLE public.laundry_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_orders FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_orders TO service_role;
ALTER TABLE public.laundry_proofs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_proofs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_proofs TO service_role;
ALTER TABLE public.laundry_rooms ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.laundry_rooms FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.laundry_rooms TO service_role;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.members FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.members TO service_role;
ALTER TABLE public.mutations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mutations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mutations TO service_role;
ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_sessions FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_sessions TO service_role;
ALTER TABLE public.workspace ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workspace FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace TO service_role;
