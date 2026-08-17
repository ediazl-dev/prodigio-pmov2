CREATE TABLE `recurring_service_billing_months` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`monthNumber` int NOT NULL,
	`dueDate` date,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(10) DEFAULT 'USD',
	`status` enum('pendiente','facturado','pagado') NOT NULL DEFAULT 'pendiente',
	`jiraIssueKey` varchar(50),
	`invoiceNumber` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_billing_months_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`docType` enum('propuesta_tecnica','pl','sow','contrato','otro') NOT NULL,
	`fileName` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`fileKey` varchar(500),
	`uploadedBy` int,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_penalties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`penaltyDate` date NOT NULL,
	`description` text NOT NULL,
	`amount` decimal(12,2),
	`currency` varchar(10) DEFAULT 'USD',
	`jiraIssueKey` varchar(50),
	`status` enum('identificada','aplicada','disputada','resuelta') NOT NULL DEFAULT 'identificada',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_penalties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_sla_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`priority` enum('critical','high','medium','low') NOT NULL,
	`firstResponseMinutes` int NOT NULL,
	`resolutionMinutes` int NOT NULL,
	`coverageType` enum('24x7','8x5','personalizado') NOT NULL DEFAULT '8x5',
	`customCoverageDescription` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_sla_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`stageId` enum('inicializacion','plan_trabajo','jira_setup','ejecucion','cierre') NOT NULL,
	`status` enum('locked','in_progress','completed') NOT NULL DEFAULT 'locked',
	`completedAt` timestamp,
	`completedBy` int,
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_service_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_service_work_plan` (
	`id` int AUTO_INCREMENT NOT NULL,
	`serviceId` int NOT NULL,
	`itemType` enum('informe_mensual','facturacion','tarea_programada','sla_definition','coverage_definition') NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`frequency` varchar(100),
	`dueDate` date,
	`monthNumber` int,
	`status` enum('pendiente','en_progreso','completado','vencido') NOT NULL DEFAULT 'pendiente',
	`jiraIssueKey` varchar(50),
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_service_work_plan_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurring_services` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`dealId` varchar(100),
	`serviceName` varchar(255) NOT NULL,
	`serviceType` enum('soporte_incidentes','requerimientos','evolutivos','mixto') NOT NULL,
	`durationMonths` int NOT NULL,
	`estimatedStartDate` date,
	`formalStartDate` date,
	`endDate` date,
	`billingType` enum('cuota_fija','cuotas_variables') NOT NULL,
	`fixedMonthlyAmount` decimal(12,2),
	`currency` varchar(10) DEFAULT 'USD',
	`totalContractAmount` decimal(12,2),
	`status` enum('activo','pausado','completado','cancelado') NOT NULL DEFAULT 'activo',
	`currentStage` enum('inicializacion','plan_trabajo','jira_setup','ejecucion','cierre') NOT NULL DEFAULT 'inicializacion',
	`pipedrivePersonName` varchar(255),
	`pipedrivePersonEmail` varchar(320),
	`pipedrivePersonPhone` varchar(100),
	`pipedriveDealAmount` decimal(12,2),
	`pipedriveDealCreatedAt` date,
	`pipedriveDealClosedAt` date,
	`pipedriveInteractionCount` int,
	`pipedriveAiSummary` text,
	`pipedriveClientConcerns` text,
	`jsmPlatform` enum('prodigio','cliente') DEFAULT 'prodigio',
	`jsmProjectKey` varchar(50),
	`jsmProjectId` varchar(50),
	`jsmPortalUrl` varchar(500),
	`jsmOrganizationId` varchar(50),
	`jsmServiceDeskId` varchar(50),
	`jsmClientPlatformUrl` varchar(500),
	`pmId` int,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurring_services_id` PRIMARY KEY(`id`)
);
