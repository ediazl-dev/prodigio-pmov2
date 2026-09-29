ALTER TABLE `recurring_services` ADD `jsmWorkPlanSyncMode` enum('create_in_linked_space','external_reference') DEFAULT 'create_in_linked_space' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmBillingSyncMode` enum('create_in_linked_space','external_reference') DEFAULT 'create_in_linked_space' NOT NULL;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmSyncPolicyReason` text;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmSyncPolicyUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `recurring_services` ADD `jsmSyncPolicyUpdatedBy` int;