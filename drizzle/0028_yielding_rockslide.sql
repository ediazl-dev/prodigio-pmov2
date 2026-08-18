CREATE TABLE `executive_contract_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int NOT NULL,
	`milestoneCode` varchar(50) NOT NULL,
	`title` varchar(500) NOT NULL,
	`billingWeight` decimal(5,2) NOT NULL,
	`baselineDate` date,
	`jiraIssueKey` varchar(50) NOT NULL,
	`jiraStatusName` varchar(100),
	`jiraDueDate` date,
	`semanticStatus` enum('pending','fulfilled','delayed','blocked') NOT NULL DEFAULT 'pending',
	`isCritical` boolean NOT NULL DEFAULT false,
	`reconciliationNotes` text,
	`lastObservedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executive_contract_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_project_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`dealId` varchar(50) NOT NULL,
	`jiraProjectKey` varchar(50) NOT NULL,
	`contractDocumentId` int,
	`baselineVersion` varchar(50) NOT NULL,
	`contractFileName` varchar(500) NOT NULL,
	`contractFileUrl` varchar(1000) NOT NULL,
	`contractSha256` varchar(64),
	`sourceStatus` enum('draft','approved','superseded') NOT NULL DEFAULT 'draft',
	`approvedAt` timestamp,
	`approvedBy` int,
	`approvedByName` varchar(200),
	`approvalNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executive_project_sources_id` PRIMARY KEY(`id`)
);
