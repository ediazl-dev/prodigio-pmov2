CREATE TABLE `deadline_notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`notificationType` enum('warning_75','overdue') NOT NULL,
	`sentTo` varchar(500) NOT NULL,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deadline_notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stage_deadline_extensions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`type` enum('pause','resume','extend') NOT NULL,
	`extraDays` int DEFAULT 0,
	`reason` text NOT NULL,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stage_deadline_extensions_id` PRIMARY KEY(`id`)
);
