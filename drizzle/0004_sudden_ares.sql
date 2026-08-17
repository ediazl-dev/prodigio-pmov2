CREATE TABLE `holidays` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` date NOT NULL,
	`name` varchar(200) NOT NULL,
	`year` int NOT NULL,
	`source` varchar(100) DEFAULT 'feriados.cl',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `holidays_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stage_deadlines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`maxBusinessDays` int NOT NULL DEFAULT 10,
	`label` varchar(100) NOT NULL,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `stage_deadlines_id` PRIMARY KEY(`id`),
	CONSTRAINT `stage_deadlines_stageId_unique` UNIQUE(`stageId`)
);
--> statement-breakpoint
CREATE TABLE `stage_openings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`openedBy` int NOT NULL,
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stage_openings_id` PRIMARY KEY(`id`)
);
