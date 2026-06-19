CREATE TABLE `deadlines` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`due_at` integer,
	`type` text,
	`link` text,
	`source_url` text
);
--> statement-breakpoint
CREATE TABLE `perks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`provider` text,
	`value` text,
	`how_to_claim` text,
	`eligibility` text,
	`link` text,
	`expires_at` integer,
	`source_url` text
);
--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_unique` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_id` text,
	`target_kind` text,
	`fire_at` integer,
	`label` text,
	`sent` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`day` text,
	`day_number` integer,
	`day_theme` text,
	`starts_at` integer,
	`ends_at` integer,
	`start_time_label` text,
	`end_time_label` text,
	`venue_id` text,
	`partner` text,
	`track` text,
	`type` text,
	`tone` text,
	`description` text,
	`speakers` text,
	`requirements` text,
	`registration_url` text,
	`tags` text,
	`quality_level` text,
	`source_url` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`google_sub` text NOT NULL,
	`preferences` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_sub_unique` ON `users` (`google_sub`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`lat` real,
	`lng` real,
	`map_url` text,
	`image_url` text
);
