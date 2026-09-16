CREATE TABLE `recurring_service_jsm_issue_type_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`category` enum('work_plan','billing') NOT NULL,
	`issueTypeId` varchar(50) NOT NULL,
	`issueTypeName` varchar(100) NOT NULL,
	`source` enum('selected','detected_default') NOT NULL DEFAULT 'selected',
	`status` enum('active','superseded') NOT NULL DEFAULT 'active',
	`configuredBy` int,
	`configuredByName` varchar(200),
	`configuredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_service_jsm_issue_type_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_jsm_issue_mapping_service_category_uq` UNIQUE(`serviceId`,`category`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_jsm_link_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(191) NOT NULL,
	`serviceId` int NOT NULL,
	`source` enum('preflight','link','revalidate','unlink') NOT NULL,
	`status` enum('running','ready','blocked','linked','unlinked','error') NOT NULL,
	`candidateProjectId` varchar(50),
	`candidateProjectKey` varchar(50),
	`candidateProjectName` varchar(255),
	`candidateServiceDeskId` varchar(50),
	`fingerprint` varchar(64),
	`checks` json,
	`snapshot` json,
	`errorMessage` text,
	`triggeredBy` int,
	`triggeredByName` varchar(200),
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_jsm_link_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_service_jsm_link_runs_runId_unique` UNIQUE(`runId`),
	CONSTRAINT `recurring_jsm_link_service_fingerprint_uq` UNIQUE(`serviceId`,`fingerprint`)
);
--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmLinkSource` enum('created','linked');--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmProjectName` varchar(255);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmAgentUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmLinkHealth` enum('pending','healthy','warning','blocked');--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmLastVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmLinkedAt` timestamp;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmLinkedBy` int;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD CONSTRAINT `recurring_services_jsm_project_key_uq` UNIQUE(`jsmProjectKey`);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD CONSTRAINT `recurring_services_jsm_project_id_uq` UNIQUE(`jsmProjectId`);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD CONSTRAINT `recurring_services_jsm_service_desk_id_uq` UNIQUE(`jsmServiceDeskId`);