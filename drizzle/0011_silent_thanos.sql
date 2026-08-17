CREATE TABLE `jira_spaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`spaceName` varchar(255) NOT NULL,
	`jiraProjectKey` varchar(50),
	`jiraProjectId` varchar(50),
	`jiraProjectName` varchar(255),
	`jiraProjectUrl` varchar(1000),
	`status` enum('created','pending_permissions','linked') NOT NULL DEFAULT 'pending_permissions',
	`templateKey` varchar(50) DEFAULT 'PBTISD1',
	`boards` json,
	`issueTypes` json,
	`workflows` json,
	`createdBy` int NOT NULL,
	`createdByName` varchar(200),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jira_spaces_id` PRIMARY KEY(`id`)
);
