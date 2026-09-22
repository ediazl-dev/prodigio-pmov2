CREATE TABLE `executive_evidence_uploads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptToken` varchar(64) NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int NOT NULL,
	`documentType` enum('minute','acceptance','recovery_plan') NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(1000) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSha256` varchar(64) NOT NULL,
	`mimeType` varchar(150) NOT NULL,
	`sizeBytes` int NOT NULL,
	`uploadStatus` enum('pending','attached') NOT NULL DEFAULT 'pending',
	`attachedEntityType` enum('minute','acceptance','recovery_plan'),
	`attachedEntityId` int,
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`attachedAt` timestamp,
	CONSTRAINT `executive_evidence_uploads_id` PRIMARY KEY(`id`),
	CONSTRAINT `executive_evidence_uploads_receipt_uq` UNIQUE(`receiptToken`),
	CONSTRAINT `executive_evidence_uploads_file_key_uq` UNIQUE(`fileKey`)
);
--> statement-breakpoint
CREATE INDEX `executive_evidence_uploads_project_status_idx` ON `executive_evidence_uploads` (`projectId`,`uploadStatus`);