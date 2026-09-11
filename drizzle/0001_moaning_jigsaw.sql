CREATE TABLE `laundry_counters` (
	`id` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `laundry_events` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`actor` text NOT NULL,
	`at` text NOT NULL,
	`action` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `laundry_event_order` ON `laundry_events` (`order_id`,`at`);--> statement-breakpoint
CREATE TABLE `laundry_mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`hash` text NOT NULL,
	`result` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `laundry_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`submission_key` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `laundry_submission_unique` ON `laundry_orders` (`submission_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `laundry_token_unique` ON `laundry_orders` (`token_hash`);--> statement-breakpoint
CREATE INDEX `laundry_date_status` ON `laundry_orders` (`created_at`,`status`);--> statement-breakpoint
CREATE INDEX `laundry_room` ON `laundry_orders` (`room_id`);--> statement-breakpoint
CREATE TABLE `laundry_proofs` (
	`id` text PRIMARY KEY NOT NULL,
	`order_id` text NOT NULL,
	`object_key` text NOT NULL,
	`mime` text NOT NULL,
	`capture` text NOT NULL,
	`actor` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `laundry_proof_order` ON `laundry_proofs` (`order_id`);--> statement-breakpoint
CREATE TABLE `laundry_rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `room_token_unique` ON `laundry_rooms` (`token_hash`);