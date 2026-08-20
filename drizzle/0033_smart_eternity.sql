CREATE TABLE `project_health_snapshot` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`cutoffDate` timestamp NOT NULL,
	`ige` int,
	`estado` varchar(20),
	`gatillos` text,
	`ufEnRiesgo` int,
	`hitosVencidos` int,
	`hitosExigibles` int,
	`p0Vencidas` int,
	`planesRecuperacionVencidos` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_health_snapshot_id` PRIMARY KEY(`id`)
);
