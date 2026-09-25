CREATE TABLE `financial_billing_item` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(64) NOT NULL,
	`dealId` varchar(100) NOT NULL,
	`projectName` varchar(500),
	`clientName` varchar(255),
	`milestoneName` varchar(500) NOT NULL,
	`plannedDate` date,
	`deliveredAt` date,
	`invoicedAt` date,
	`amount` decimal(18,4),
	`currency` varchar(10),
	`amountUsdSource` decimal(18,4),
	`billingStatus` varchar(50),
	`deliveryStatus` varchar(100),
	`delayCause` text,
	`lineOfBusiness` varchar(100),
	`sourceActive` boolean NOT NULL DEFAULT true,
	`sourceBatchId` int,
	`sourceFirstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`sourceLastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_billing_item_id` PRIMARY KEY(`id`),
	CONSTRAINT `financial_billing_item_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `financial_sync_batch` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workbookSha256` varchar(64) NOT NULL,
	`projectSourceRows` int NOT NULL DEFAULT 0,
	`billingSourceRows` int NOT NULL DEFAULT 0,
	`activeFinancialItems` int NOT NULL DEFAULT 0,
	`activeBillingItems` int NOT NULL DEFAULT 0,
	`financialInserted` int NOT NULL DEFAULT 0,
	`financialUpdated` int NOT NULL DEFAULT 0,
	`financialInactivated` int NOT NULL DEFAULT 0,
	`billingInserted` int NOT NULL DEFAULT 0,
	`billingUpdated` int NOT NULL DEFAULT 0,
	`billingInactivated` int NOT NULL DEFAULT 0,
	`billingPeriodFrom` date,
	`billingPeriodTo` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `financial_sync_batch_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `financial_data` ADD `sourceActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_data` ADD `sourceBatchId` int;--> statement-breakpoint
ALTER TABLE `financial_data` ADD `sourceFirstSeenAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `financial_data` ADD `sourceLastSeenAt` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
CREATE INDEX `financial_billing_item_deal_idx` ON `financial_billing_item` (`dealId`);--> statement-breakpoint
CREATE INDEX `financial_billing_item_invoice_date_idx` ON `financial_billing_item` (`invoicedAt`);--> statement-breakpoint
CREATE INDEX `financial_billing_item_planned_date_idx` ON `financial_billing_item` (`plannedDate`);--> statement-breakpoint
CREATE INDEX `financial_billing_item_source_active_idx` ON `financial_billing_item` (`sourceActive`);--> statement-breakpoint
CREATE INDEX `financial_billing_item_batch_idx` ON `financial_billing_item` (`sourceBatchId`);--> statement-breakpoint
CREATE INDEX `financial_sync_batch_workbook_idx` ON `financial_sync_batch` (`workbookSha256`);--> statement-breakpoint
CREATE INDEX `financial_sync_batch_created_at_idx` ON `financial_sync_batch` (`createdAt`);--> statement-breakpoint
CREATE INDEX `financial_data_source_active_idx` ON `financial_data` (`sourceActive`);--> statement-breakpoint
CREATE INDEX `financial_data_client_idx` ON `financial_data` (`clientName`);--> statement-breakpoint
CREATE INDEX `financial_data_line_idx` ON `financial_data` (`lineaNegocio`);--> statement-breakpoint
CREATE INDEX `financial_data_batch_idx` ON `financial_data` (`sourceBatchId`);