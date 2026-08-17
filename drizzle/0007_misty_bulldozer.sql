CREATE TABLE `stage_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(1000) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`notes` text,
	`uploadedBy` int NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	CONSTRAINT `stage_approvals_id` PRIMARY KEY(`id`)
);
