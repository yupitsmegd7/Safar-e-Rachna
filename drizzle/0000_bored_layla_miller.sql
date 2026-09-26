CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post` text NOT NULL,
	`user` text NOT NULL,
	`name` text NOT NULL,
	`body` text NOT NULL,
	`date` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_comments_post` ON `comments` (`post`);--> statement-breakpoint
CREATE TABLE `likes` (
	`post` text NOT NULL,
	`user` text NOT NULL,
	PRIMARY KEY(`post`, `user`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`excerpt` text NOT NULL,
	`body` text NOT NULL,
	`tags` text NOT NULL,
	`image` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`data` text NOT NULL
);
