ALTER TABLE `risks` ADD `jiraStatusName` varchar(120);--> statement-breakpoint
ALTER TABLE `risks` ADD `jiraStatusCategory` varchar(80);--> statement-breakpoint
ALTER TABLE `risks` ADD `jiraAssigneeId` varchar(120);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `jiraStatusName` varchar(120);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `jiraStatusCategory` varchar(80);--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD `jiraAssigneeId` varchar(120);