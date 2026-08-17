ALTER TABLE `recurring_services` ADD `pipedriveOrgName` varchar(255);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveOrgAddress` varchar(500);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveDealStatus` varchar(50);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveDealCurrency` varchar(10);--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveEmailsCount` int;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveNotesCount` int;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveNotesRaw` text;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveFlowSummary` text;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `pipedriveSyncedAt` timestamp;