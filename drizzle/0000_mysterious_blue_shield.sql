CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`object_id` text NOT NULL,
	`object_key` text NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`hash` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `proof_object` ON `attachments` (`object_id`);--> statement-breakpoint
CREATE INDEX `proof_hash` ON `attachments` (`hash`);--> statement-breakpoint
CREATE TABLE `finance_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`object_id` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_date` ON `finance_audit` (`at`);--> statement-breakpoint
CREATE TABLE `journal_lines` (
	`id` text PRIMARY KEY NOT NULL,
	`journal_id` text NOT NULL,
	`account` text NOT NULL,
	`date` text NOT NULL,
	`unit` text NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`debit` integer DEFAULT 0 NOT NULL,
	`credit` integer DEFAULT 0 NOT NULL,
	`cash_category` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `lines_account_date_unit` ON `journal_lines` (`account`,`date`,`unit`);--> statement-breakpoint
CREATE INDEX `lines_journal` ON `journal_lines` (`journal_id`);--> statement-breakpoint
CREATE TABLE `journals` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`date` text NOT NULL,
	`unit` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_transaction_unique` ON `journals` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `journal_date_unit` ON `journals` (`date`,`unit`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`status` text NOT NULL,
	`profile` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `finance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_kind_date` ON `finance_records` (`kind`,`date`);--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`source_key` text NOT NULL,
	`kind` text NOT NULL,
	`unit` text NOT NULL,
	`customer` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`created_by` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `txn_source_unique` ON `finance_transactions` (`source_key`);--> statement-breakpoint
CREATE INDEX `txn_date_unit` ON `finance_transactions` (`date`,`unit`);--> statement-breakpoint
CREATE INDEX `txn_status` ON `finance_transactions` (`status`);--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`updated_at` text NOT NULL
);
