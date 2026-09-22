ALTER TABLE `executive_evidence_uploads` ADD `discardedAt` timestamp;--> statement-breakpoint
ALTER TABLE `executive_evidence_uploads` ADD `discardedBy` int;--> statement-breakpoint
ALTER TABLE `executive_evidence_uploads` ADD `discardedByName` varchar(200);--> statement-breakpoint
ALTER TABLE `executive_evidence_uploads` ADD `discardReason` text;