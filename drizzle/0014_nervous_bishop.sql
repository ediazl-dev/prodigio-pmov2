ALTER TABLE `wbs_tasks` ADD `issueLevel` enum('epic','story','task','milestone') DEFAULT 'task';--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `epicCode` varchar(20);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `storyCode` varchar(20);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `jiraIssueKey` varchar(50);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `jiraParentKey` varchar(50);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `acceptanceCriteria` text;--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `storyPoints` int;