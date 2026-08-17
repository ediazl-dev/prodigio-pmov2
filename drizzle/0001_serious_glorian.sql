CREATE TABLE `admin_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(100) NOT NULL,
	`value` text,
	`description` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `admin_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `admin_settings_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `billing_milestones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`milestoneNumber` int NOT NULL,
	`description` varchar(500) NOT NULL,
	`amount` decimal(12,2),
	`percentage` decimal(5,2),
	`currency` varchar(10) DEFAULT 'USD',
	`dueDate` date,
	`status` enum('pendiente','facturado','pagado') DEFAULT 'pendiente',
	`invoiceNumber` varchar(100),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`projectType` enum('apigee','desarrollo','integracion','data','otro') NOT NULL,
	`architectureProposal` text,
	`techStack` json,
	`predefinedActivities` json,
	`planningProposal` text,
	`maxDurationDays` int,
	`aiGenerated` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `design_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lessons_learned` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`category` enum('proceso','tecnico','comunicacion','riesgos','equipo') NOT NULL,
	`whatWorked` text,
	`whatDidntWork` text,
	`frictions` text,
	`improvements` text,
	`platformSuggestions` text,
	`finalScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_learned_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_stages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`stageId` enum('sow','jira','risks','planning','design','closure') NOT NULL,
	`status` enum('locked','in_progress','completed') NOT NULL DEFAULT 'locked',
	`progress` int DEFAULT 0,
	`completedAt` timestamp,
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `project_stages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectName` varchar(255) NOT NULL,
	`clientName` varchar(255) NOT NULL,
	`clientContact` varchar(255),
	`clientEmail` varchar(320),
	`projectType` enum('apigee','desarrollo','integracion','data','otro') DEFAULT 'otro',
	`status` enum('activo','pausado','completado','cancelado') NOT NULL DEFAULT 'activo',
	`currentStage` enum('sow','jira','risks','planning','design','closure') NOT NULL DEFAULT 'sow',
	`pmId` int,
	`pmoId` int,
	`totalAmount` decimal(12,2),
	`currency` varchar(10) DEFAULT 'USD',
	`startDate` date,
	`endDate` date,
	`jiraProjectKey` varchar(50),
	`jiraProjectUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `risks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`riskCode` varchar(20),
	`description` text NOT NULL,
	`category` enum('tecnico','organizacional','externo','oculto') NOT NULL,
	`type` enum('riesgo','riesgo_oculto','supuesto_no_validado','dependencia_externa') NOT NULL,
	`probability` enum('alta','media','baja') NOT NULL,
	`impact` enum('alto','medio','bajo') NOT NULL,
	`mitigation` text,
	`owner` varchar(255),
	`status` enum('abierto','mitigado','cerrado') DEFAULT 'abierto',
	`jiraTaskId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `risks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sow_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('draft','review','approved') NOT NULL DEFAULT 'draft',
	`introText` text,
	`startDate` varchar(50),
	`generalObjective` text,
	`specificObjectives` json,
	`activitiesIncluded` json,
	`deliverables` json,
	`limitations` json,
	`assumptions` json,
	`clientDependencies` json,
	`risks` json,
	`prerequisites` json,
	`milestones` json,
	`meetingFrequency` text,
	`communicationChannel` text,
	`prodigioTeam` json,
	`clientTeam` json,
	`totalAmount` decimal(12,2),
	`currency` varchar(10) DEFAULT 'USD',
	`billingMilestones` json,
	`sourcePdfUrl` varchar(1000),
	`aiExtracted` boolean DEFAULT false,
	`finalDocUrl` varchar(1000),
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sow_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`uploadedBy` int,
	`fileName` varchar(500) NOT NULL,
	`fileKey` varchar(1000) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(100),
	`fileSize` int,
	`purpose` enum('sow_source','sow_final','design_doc','other') DEFAULT 'other',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `uploaded_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wbs_tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`taskCode` varchar(20),
	`taskName` varchar(500) NOT NULL,
	`phase` enum('preparacion','inicio','planificacion','analisis','construccion','cierre') NOT NULL,
	`optimistic` decimal(6,1),
	`pessimistic` decimal(6,1),
	`probable` decimal(6,1),
	`expected` decimal(6,1),
	`isCritical` boolean DEFAULT false,
	`dependencies` varchar(255),
	`assignee` varchar(255),
	`jiraTaskId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `wbs_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','pmo','pm','consulta') NOT NULL DEFAULT 'consulta';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('activo','invitado','desactivado') DEFAULT 'invitado' NOT NULL;