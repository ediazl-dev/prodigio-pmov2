CREATE TABLE `financial_sync_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`status` enum('applied','error') NOT NULL,
	`inputDeals` int NOT NULL DEFAULT 0,
	`insertCount` int NOT NULL DEFAULT 0,
	`updateCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`triggeredBy` varchar(20) NOT NULL DEFAULT 'cron',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_sync_log_id` PRIMARY KEY(`id`)
);
