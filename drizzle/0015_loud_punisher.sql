CREATE TABLE `gantt_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`parsedRows` int DEFAULT 0,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `gantt_uploads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `billing_milestones` ADD `responsableName` varchar(255);--> statement-breakpoint
ALTER TABLE `billing_milestones` ADD `responsableEmail` varchar(320);--> statement-breakpoint
ALTER TABLE `billing_milestones` ADD `jiraIssueKey` varchar(50);--> statement-breakpoint
ALTER TABLE `billing_milestones` ADD `jiraIssueId` varchar(50);