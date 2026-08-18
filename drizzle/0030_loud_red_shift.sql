CREATE TABLE `executive_verdict_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`verdictId` int NOT NULL,
	`reviewStatus` enum('PENDING','VALIDATED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`reviewNote` text,
	`reviewedBy` int,
	`reviewedByName` varchar(200),
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_verdict_reviews_id` PRIMARY KEY(`id`)
);
