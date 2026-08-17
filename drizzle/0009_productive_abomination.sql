CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(100) NOT NULL,
	`entity` varchar(100) NOT NULL,
	`entityId` varchar(100),
	`entityName` varchar(500),
	`userId` int,
	`userName` varchar(200),
	`userRole` varchar(50),
	`details` json,
	`ipAddress` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
