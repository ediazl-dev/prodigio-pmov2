ALTER TABLE `invitations` MODIFY COLUMN `role` enum('admin','pmo','consulta') NOT NULL DEFAULT 'pmo';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('admin','pmo','consulta') NOT NULL DEFAULT 'consulta';--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);