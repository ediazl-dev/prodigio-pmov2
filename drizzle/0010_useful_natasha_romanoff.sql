CREATE TABLE `stage_closures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`closedBy` int NOT NULL,
	`closedByName` varchar(200),
	`confirmationText` text NOT NULL,
	`notes` text,
	`closedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stage_closures_id` PRIMARY KEY(`id`)
);
