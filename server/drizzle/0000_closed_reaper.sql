CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`data` text NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `usage_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`operation` text NOT NULL,
	`provider` text,
	`model` text,
	`funding_source` text NOT NULL,
	`execution_mode` text NOT NULL,
	`status` text NOT NULL,
	`provider_request_id` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`image_count` integer,
	`platform_credits_reserved` integer,
	`platform_credits_charged` integer,
	`error_code` text,
	`created_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`name` text NOT NULL,
	`is_verified` integer DEFAULT false NOT NULL,
	`verification_code` text,
	`verification_code_expires_at` integer,
	`credits` integer DEFAULT 0 NOT NULL,
	`created_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);