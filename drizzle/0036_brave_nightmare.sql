ALTER TABLE `executive_contract_milestones` ADD CONSTRAINT `executive_milestone_source_issue_uq` UNIQUE(`sourceId`,`jiraIssueKey`);--> statement-breakpoint
ALTER TABLE `executive_project_sources` ADD CONSTRAINT `executive_source_project_version_uq` UNIQUE(`projectId`,`baselineVersion`);
--> statement-breakpoint
ALTER TABLE `executive_contract_milestones` ADD CONSTRAINT `executive_milestone_source_issue_uq` UNIQUE(`sourceId`,`jiraIssueKey`);
