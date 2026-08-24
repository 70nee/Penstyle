CREATE TABLE `user_workspaces` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`object_key` text NOT NULL,
	`updated_at` integer NOT NULL
);
