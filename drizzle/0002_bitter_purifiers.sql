CREATE TABLE `auth_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cipher` text NOT NULL,
	`expires_at` integer NOT NULL,
	`token_expires_at` integer NOT NULL,
	`lease_until` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen` integer NOT NULL,
	`device` text NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_user` ON `staff_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expiry` ON `staff_sessions` (`expires_at`);