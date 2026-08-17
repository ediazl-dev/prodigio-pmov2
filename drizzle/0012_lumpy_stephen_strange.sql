CREATE TABLE `risk_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` varchar(20) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(1000) NOT NULL,
	`riskCount` int DEFAULT 0,
	`notes` text,
	`createdBy` int NOT NULL,
	`createdByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `risk_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `risks` ADD `contingency` text;--> statement-breakpoint
ALTER TABLE `risks` ADD `dueDate` varchar(20);--> statement-breakpoint
ALTER TABLE `risks` ADD `estimatedCost` varchar(100);--> statement-breakpoint
ALTER TABLE `risks` ADD `jiraIssueKey` varchar(50);