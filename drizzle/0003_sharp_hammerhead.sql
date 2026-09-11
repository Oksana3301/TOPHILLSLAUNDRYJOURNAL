CREATE TABLE `laundry_demo_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `demo_session_expiry` ON `laundry_demo_sessions` (`expires_at`);