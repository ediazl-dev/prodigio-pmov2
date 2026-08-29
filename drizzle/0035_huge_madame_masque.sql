ALTER TABLE `stage_closures` ADD `closureMode` enum('native','homologated') DEFAULT 'native' NOT NULL;--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `closureMode` enum('native','homologated') DEFAULT 'native' NOT NULL;--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `onboardingId` int;--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `evidenceSource` varchar(100);--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `evidenceReference` varchar(1000);--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `evidenceDate` date;--> statement-breakpoint
ALTER TABLE `stage_closures` ADD `homologationMetadata` json;
