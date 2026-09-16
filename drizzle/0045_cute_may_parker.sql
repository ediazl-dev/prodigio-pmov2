CREATE TABLE `recurring_service_document_controls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`documentId` int NOT NULL,
	`validationStatus` enum('pending','valid','expired','rejected') NOT NULL DEFAULT 'pending',
	`validFrom` date,
	`validUntil` date,
	`validatedAt` timestamp,
	`validatedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_service_document_controls_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_document_controls_document_uq` UNIQUE(`documentId`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_financial_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`billingMonthId` int,
	`evidenceType` enum('invoice','payment','credit_note','other') NOT NULL,
	`status` enum('pending_validation','confirmed','void') NOT NULL DEFAULT 'pending_validation',
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(10) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`referenceNumber` varchar(191),
	`evidenceDocumentId` int,
	`source` enum('manual','financial_sync','import') NOT NULL DEFAULT 'manual',
	`sourceReference` varchar(191),
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_service_financial_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_financial_evidence_source_ref_uq` UNIQUE(`source`,`sourceReference`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_jsm_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`serviceDeskId` varchar(50),
	`projectKey` varchar(50),
	`capturedAt` timestamp NOT NULL,
	`source` enum('manual','scheduled') NOT NULL,
	`status` enum('success','partial','error','not_configured') NOT NULL,
	`incidentCount` int,
	`openIncidentCount` int,
	`criticalOpenCount` int,
	`overdueIncidentCount` int,
	`unresolvedOver30DaysCount` int,
	`firstResponseMeasuredCount` int,
	`firstResponseMetCount` int,
	`firstResponseCompliancePct` decimal(5,2),
	`resolutionMeasuredCount` int,
	`resolutionMetCount` int,
	`resolutionCompliancePct` decimal(5,2),
	`priorityBreakdown` json,
	`issueTypeBreakdown` json,
	`dataFingerprint` varchar(64),
	`errorCode` varchar(100),
	`errorMessage` text,
	`triggeredBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_jsm_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_jsm_snapshots_service_fingerprint_uq` UNIQUE(`serviceId`,`dataFingerprint`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_report_evidence` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`workPlanItemId` int,
	`periodStart` date NOT NULL,
	`periodEnd` date NOT NULL,
	`dueDate` date NOT NULL,
	`status` enum('pending','delivered','accepted','rejected','waived') NOT NULL DEFAULT 'pending',
	`deliveredAt` timestamp,
	`acceptedAt` timestamp,
	`evidenceDocumentId` int,
	`source` enum('manual','jsm','import') NOT NULL DEFAULT 'manual',
	`notes` text,
	`recordedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_service_report_evidence_id` PRIMARY KEY(`id`),
	CONSTRAINT `recurring_report_evidence_service_period_uq` UNIQUE(`serviceId`,`periodStart`,`periodEnd`)
);
--> statement-breakpoint
CREATE INDEX `recurring_document_controls_service_status_idx` ON `recurring_service_document_controls` (`serviceId`,`validationStatus`);--> statement-breakpoint
CREATE INDEX `recurring_financial_evidence_service_occurred_idx` ON `recurring_service_financial_evidence` (`serviceId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `recurring_financial_evidence_billing_month_idx` ON `recurring_service_financial_evidence` (`billingMonthId`);--> statement-breakpoint
CREATE INDEX `recurring_jsm_snapshots_service_captured_idx` ON `recurring_service_jsm_snapshots` (`serviceId`,`capturedAt`);--> statement-breakpoint
CREATE INDEX `recurring_report_evidence_service_due_idx` ON `recurring_service_report_evidence` (`serviceId`,`dueDate`);--> statement-breakpoint
CREATE INDEX `recurring_report_evidence_work_plan_idx` ON `recurring_service_report_evidence` (`workPlanItemId`);