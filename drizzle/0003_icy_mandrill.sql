CREATE TABLE `sow_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` varchar(20) NOT NULL,
	`redactor` varchar(200) NOT NULL,
	`redactorRole` varchar(200),
	`fileName` varchar(500) NOT NULL,
	`url` text NOT NULL,
	`fileSize` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sow_versions_id` PRIMARY KEY(`id`)
);
