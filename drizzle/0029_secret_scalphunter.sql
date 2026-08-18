CREATE TABLE `executive_commitments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`minuteId` int,
	`title` varchar(500) NOT NULL,
	`ownerName` varchar(200),
	`dueDate` date,
	`commitmentStatus` enum('open','fulfilled','cancelled') NOT NULL DEFAULT 'open',
	`closureEvidenceUrl` varchar(1000),
	`closedAt` timestamp,
	`closedBy` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executive_commitments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_dashboard_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int NOT NULL,
	`financialSnapshotId` int,
	`cutoffDate` date NOT NULL,
	`snapshotKind` enum('fixture','production') NOT NULL DEFAULT 'production',
	`governanceState` enum('VERDE','AMARILLO','NARANJO','ROJO','CRITICO','POR_CONFIRMAR') NOT NULL,
	`metrics` json NOT NULL,
	`inputFingerprint` varchar(64) NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_dashboard_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_financial_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int,
	`dealId` varchar(50) NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`sourceLabel` varchar(200) NOT NULL,
	`dataFingerprint` varchar(64),
	`financialData` json NOT NULL,
	`createdBy` int,
	CONSTRAINT `executive_financial_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_governance_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int,
	`governanceRole` enum('pm','delivery_manager','portfolio_owner') NOT NULL,
	`personName` varchar(200) NOT NULL,
	`userId` int,
	`active` boolean NOT NULL DEFAULT true,
	`assignedAt` timestamp NOT NULL DEFAULT (now()),
	`assignedBy` int,
	`notes` text,
	CONSTRAINT `executive_governance_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_meeting_minutes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int,
	`meetingDate` date NOT NULL,
	`isoWeek` varchar(10) NOT NULL,
	`title` varchar(500) NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileSha256` varchar(64),
	`reviewStatus` enum('received','reviewed','incomplete') NOT NULL DEFAULT 'received',
	`reviewedAt` timestamp,
	`reviewedBy` int,
	`uploadedBy` int NOT NULL,
	`uploadedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_meeting_minutes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_milestone_acceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int NOT NULL,
	`milestoneId` int NOT NULL,
	`acceptedAt` date NOT NULL,
	`evidenceFileName` varchar(500) NOT NULL,
	`evidenceUrl` varchar(1000) NOT NULL,
	`evidenceSha256` varchar(64),
	`acceptanceStatus` enum('accepted','revoked') NOT NULL DEFAULT 'accepted',
	`notes` text,
	`recordedBy` int NOT NULL,
	`recordedByName` varchar(200),
	`revokedAt` timestamp,
	`revokedBy` int,
	`revokeReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_milestone_acceptances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_recovery_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int,
	`version` varchar(50) NOT NULL,
	`recoveryStatus` enum('draft','vigente','closed','superseded') NOT NULL DEFAULT 'draft',
	`dueDate` date,
	`approvedAt` timestamp,
	`approvedBy` int,
	`approvedByName` varchar(200),
	`fileName` varchar(500),
	`fileUrl` varchar(1000),
	`fileSha256` varchar(64),
	`summary` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executive_recovery_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `executive_requirements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceId` int,
	`requirementCode` varchar(50) NOT NULL,
	`priority` enum('P0','P1','P2') NOT NULL,
	`title` varchar(500) NOT NULL,
	`rationale` text NOT NULL,
	`ownerName` varchar(200) NOT NULL,
	`dueDate` date NOT NULL,
	`requirementStatus` enum('open','in_progress','closed','waived') NOT NULL DEFAULT 'open',
	`acceptanceCriteria` text NOT NULL,
	`consequence` text NOT NULL,
	`closureEvidenceUrl` varchar(1000),
	`closedAt` timestamp,
	`closedBy` int,
	`closureNotes` text,
	`waivedAt` timestamp,
	`waivedBy` int,
	`waiverReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `executive_requirements_id` PRIMARY KEY(`id`)
);
