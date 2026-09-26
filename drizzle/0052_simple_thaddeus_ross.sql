CREATE TABLE `document_artifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int NOT NULL,
	`requirementCode` varchar(80) NOT NULL,
	`sourceKind` enum('platform_upload','linked_upload','generated','jira_snapshot','legacy_reference','import') NOT NULL,
	`legacySourceTable` varchar(100),
	`legacySourceId` varchar(100),
	`sourceReference` text,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000),
	`fileKey` varchar(1000),
	`mimeType` varchar(150),
	`sizeBytes` int,
	`sha256` varchar(64),
	`version` int NOT NULL DEFAULT 1,
	`artifactStatus` enum('active','superseded','archived','unavailable') NOT NULL DEFAULT 'active',
	`supersedesArtifactId` int,
	`observedAt` timestamp NOT NULL DEFAULT (now()),
	`uploadedBy` int,
	`uploadedByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_artifacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_artifacts_entity_requirement_version_uq` UNIQUE(`entityType`,`entityId`,`requirementCode`,`version`),
	CONSTRAINT `document_artifacts_legacy_source_uq` UNIQUE(`legacySourceTable`,`legacySourceId`)
);
--> statement-breakpoint
CREATE TABLE `document_associations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` int NOT NULL,
	`associationType` enum('project_stage','recurring_stage','sow','gantt','wbs','milestone','jira_project','jira_issue','deal','financial_data','acceptance','closure') NOT NULL,
	`associationId` varchar(150) NOT NULL,
	`metadata` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_associations_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_associations_artifact_type_id_uq` UNIQUE(`artifactId`,`associationType`,`associationId`)
);
--> statement-breakpoint
CREATE TABLE `document_gate_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int NOT NULL,
	`gateCode` varchar(80) NOT NULL,
	`policyVersion` varchar(50) NOT NULL,
	`cutoffDate` date NOT NULL,
	`result` enum('pass','block','observation') NOT NULL,
	`requirementSnapshot` json NOT NULL,
	`createdBy` int,
	`createdByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_gate_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_requirement_catalog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`policyVersion` varchar(50) NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`requirementCode` varchar(80) NOT NULL,
	`label` varchar(200) NOT NULL,
	`description` text NOT NULL,
	`validationProfile` enum('contractual','scope','commercial','financial','work_plan') NOT NULL,
	`mandatory` boolean NOT NULL DEFAULT true,
	`activeFrom` date NOT NULL,
	`activeUntil` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_requirement_catalog_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_requirement_catalog_policy_entity_code_uq` UNIQUE(`policyVersion`,`entityType`,`requirementCode`)
);
--> statement-breakpoint
CREATE TABLE `document_requirement_resolutions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int NOT NULL,
	`requirementCode` varchar(80) NOT NULL,
	`policyVersion` varchar(50) NOT NULL,
	`applicability` enum('required','not_applicable','unconfirmed') NOT NULL DEFAULT 'required',
	`reason` text,
	`evidenceArtifactId` int,
	`decidedBy` int,
	`decidedByName` varchar(200),
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_requirement_resolutions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_validation_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` int NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int NOT NULL,
	`requirementCode` varchar(80) NOT NULL,
	`policyVersion` varchar(50) NOT NULL,
	`decision` enum('pending','valid','rejected','revoked') NOT NULL DEFAULT 'pending',
	`validFrom` date,
	`validUntil` date,
	`openEndedValidity` boolean NOT NULL DEFAULT false,
	`costingStatus` enum('not_applicable','pending','verified','rejected') NOT NULL DEFAULT 'not_applicable',
	`checklist` json,
	`reason` text,
	`decidedBy` int,
	`decidedByName` varchar(200),
	`decidedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_validation_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_work_plan_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`artifactId` int NOT NULL,
	`entityType` varchar(40) NOT NULL,
	`entityId` int NOT NULL,
	`sourceType` enum('gantt','wbs','jira','combined','manual') NOT NULL,
	`sourceReference` text,
	`milestoneCount` int NOT NULL,
	`milestones` json NOT NULL,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int,
	`createdByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_work_plan_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_work_plan_snapshots_artifact_uq` UNIQUE(`artifactId`)
);
--> statement-breakpoint
CREATE INDEX `document_artifacts_entity_requirement_status_idx` ON `document_artifacts` (`entityType`,`entityId`,`requirementCode`,`artifactStatus`);--> statement-breakpoint
CREATE INDEX `document_artifacts_sha256_idx` ON `document_artifacts` (`sha256`);--> statement-breakpoint
CREATE INDEX `document_associations_lookup_idx` ON `document_associations` (`associationType`,`associationId`);--> statement-breakpoint
CREATE INDEX `document_gate_snapshots_entity_gate_created_idx` ON `document_gate_snapshots` (`entityType`,`entityId`,`gateCode`,`createdAt`);--> statement-breakpoint
CREATE INDEX `document_requirement_catalog_active_idx` ON `document_requirement_catalog` (`entityType`,`activeFrom`,`activeUntil`);--> statement-breakpoint
CREATE INDEX `document_requirement_resolutions_entity_requirement_idx` ON `document_requirement_resolutions` (`entityType`,`entityId`,`requirementCode`,`policyVersion`,`active`);--> statement-breakpoint
CREATE INDEX `document_validation_decisions_artifact_idx` ON `document_validation_decisions` (`artifactId`,`decidedAt`);--> statement-breakpoint
CREATE INDEX `document_validation_decisions_entity_requirement_idx` ON `document_validation_decisions` (`entityType`,`entityId`,`requirementCode`,`decidedAt`);--> statement-breakpoint
CREATE INDEX `document_work_plan_snapshots_entity_captured_idx` ON `document_work_plan_snapshots` (`entityType`,`entityId`,`capturedAt`);
--> statement-breakpoint
INSERT INTO `document_requirement_catalog`
  (`policyVersion`, `entityType`, `requirementCode`, `label`, `description`, `validationProfile`, `mandatory`, `activeFrom`)
VALUES
  ('2026-09-26.v1', 'recurring_service', 'contract', 'Contrato', 'Acuerdo contractual firmado o formalmente aprobado, asociado a la entidad correcta.', 'contractual', true, '2026-09-26'),
  ('2026-09-26.v1', 'recurring_service', 'sow', 'SoW', 'Statement of Work aprobado que identifica alcance, obligaciones y entregables.', 'scope', true, '2026-09-26'),
  ('2026-09-26.v1', 'recurring_service', 'technical_economic_proposal', 'Propuesta técnico-económica', 'Propuesta aprobada que contiene alcance técnico y condiciones económicas.', 'commercial', true, '2026-09-26'),
  ('2026-09-26.v1', 'recurring_service', 'costed_pnl', 'P&L con costeo', 'Documento financiero con ingreso o presupuesto, costo, margen, moneda y fecha de corte verificables.', 'financial', true, '2026-09-26'),
  ('2026-09-26.v1', 'project', 'contract', 'Contrato', 'Acuerdo contractual firmado o formalmente aprobado, asociado a la entidad correcta.', 'contractual', true, '2026-09-26'),
  ('2026-09-26.v1', 'project', 'sow', 'SoW', 'Statement of Work aprobado que identifica alcance, obligaciones y entregables.', 'scope', true, '2026-09-26'),
  ('2026-09-26.v1', 'project', 'technical_economic_proposal', 'Propuesta técnico-económica', 'Propuesta aprobada que contiene alcance técnico y condiciones económicas.', 'commercial', true, '2026-09-26'),
  ('2026-09-26.v1', 'project', 'costed_pnl', 'P&L con costeo', 'Documento financiero con ingreso o presupuesto, costo, margen, moneda y fecha de corte verificables.', 'financial', true, '2026-09-26'),
  ('2026-09-26.v1', 'project', 'work_plan_milestones', 'Plan de trabajo con hitos', 'Artefacto versionado que identifica el plan, su fuente y un conjunto trazable de hitos.', 'work_plan', true, '2026-09-26')
ON DUPLICATE KEY UPDATE
  `label` = VALUES(`label`),
  `description` = VALUES(`description`),
  `validationProfile` = VALUES(`validationProfile`),
  `mandatory` = VALUES(`mandatory`),
  `activeFrom` = VALUES(`activeFrom`),
  `activeUntil` = NULL;
