CREATE TABLE `life_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
