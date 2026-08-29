ALTER TABLE `risks` MODIFY COLUMN `category` enum('tecnico','organizacional','externo','oculto','por_confirmar') NOT NULL;--> statement-breakpoint
ALTER TABLE `risks` MODIFY COLUMN `category` enum('tecnico','organizacional','externo','oculto','por_confirmar') NOT NULL;--> statement-breakpoint
ALTER TABLE `risks` MODIFY COLUMN `probability` enum('alta','media','baja','por_confirmar') NOT NULL;--> statement-breakpoint
ALTER TABLE `risks` MODIFY COLUMN `impact` enum('alto','medio','bajo','por_confirmar') NOT NULL;--> statement-breakpoint
ALTER TABLE `wbs_tasks` MODIFY COLUMN `phase` enum('preparacion','inicio','planificacion','analisis','construccion','cierre','por_confirmar') NOT NULL;--> statement-breakpoint
ALTER TABLE `linked_project_documents` ADD CONSTRAINT `linked_project_documents_project_type_file_unique` UNIQUE(`projectId`,`docType`,`fileKey`);
