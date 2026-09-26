ALTER TABLE `recurring_service_penalties` ADD `evidenceFileName` varchar(255);--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceFileUrl` text;--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceFileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceMimeType` varchar(150);--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceFileSize` int;--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceSha256` varchar(64);--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceUploadedAt` timestamp;--> statement-breakpoint
ALTER TABLE `recurring_service_penalties` ADD `evidenceUploadedBy` int;