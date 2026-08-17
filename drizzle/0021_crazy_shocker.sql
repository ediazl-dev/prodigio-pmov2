CREATE TABLE `linked_project_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`docType` enum('sow','gantt') NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(1000) NOT NULL,
	`fileSize` int,
	`mimeType` varchar(100),
	`notes` text,
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `linked_project_documents_id` PRIMARY KEY(`id`)
);
