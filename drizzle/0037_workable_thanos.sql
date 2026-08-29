ALTER TABLE `risks` ADD CONSTRAINT `risks_project_jira_issue_unique` UNIQUE(`projectId`,`jiraIssueKey`);--> statement-breakpoint
ALTER TABLE `risks` ADD CONSTRAINT `risks_project_jira_issue_unique` UNIQUE(`projectId`,`jiraIssueKey`);
--> statement-breakpoint
ALTER TABLE `wbs_tasks` ADD CONSTRAINT `wbs_project_jira_issue_unique` UNIQUE(`projectId`,`jiraIssueKey`);
