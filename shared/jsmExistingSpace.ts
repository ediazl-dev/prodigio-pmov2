import { z } from "zod";

export const JSM_LINK_SOURCE_VALUES = ["created", "linked"] as const;
export const JSM_LINK_HEALTH_VALUES = ["pending", "healthy", "warning", "blocked"] as const;
export const JSM_LINK_RUN_SOURCE_VALUES = ["preflight", "link", "revalidate", "unlink"] as const;
export const JSM_LINK_RUN_STATUS_VALUES = ["running", "ready", "blocked", "linked", "unlinked", "error"] as const;
export const JSM_ISSUE_MAPPING_CATEGORY_VALUES = ["work_plan", "billing"] as const;
export const JSM_ISSUE_MAPPING_SOURCE_VALUES = ["selected", "detected_default"] as const;
export const JSM_ISSUE_MAPPING_STATUS_VALUES = ["active", "superseded"] as const;
export const JSM_PREFLIGHT_STATUS_VALUES = [
  "ready",
  "already_linked_same_service",
  "linked_to_other_service",
  "not_service_desk",
  "service_desk_not_accessible",
  "missing_create_issue_permission",
  "missing_issue_type_mapping",
  "archived_or_inactive",
  "identity_changed",
  "error",
] as const;

export const jsmLinkSourceSchema = z.enum(JSM_LINK_SOURCE_VALUES);
export const jsmLinkHealthSchema = z.enum(JSM_LINK_HEALTH_VALUES);
export const jsmLinkRunSourceSchema = z.enum(JSM_LINK_RUN_SOURCE_VALUES);
export const jsmLinkRunStatusSchema = z.enum(JSM_LINK_RUN_STATUS_VALUES);
export const jsmIssueMappingCategorySchema = z.enum(JSM_ISSUE_MAPPING_CATEGORY_VALUES);
export const jsmPreflightStatusSchema = z.enum(JSM_PREFLIGHT_STATUS_VALUES);

export type JsmLinkSource = z.infer<typeof jsmLinkSourceSchema>;
export type JsmLinkHealth = z.infer<typeof jsmLinkHealthSchema>;
export type JsmLinkRunSource = z.infer<typeof jsmLinkRunSourceSchema>;
export type JsmLinkRunStatus = z.infer<typeof jsmLinkRunStatusSchema>;
export type JsmIssueMappingCategory = z.infer<typeof jsmIssueMappingCategorySchema>;
export type JsmPreflightStatus = z.infer<typeof jsmPreflightStatusSchema>;

export interface JsmIssueTypeSnapshot {
  id: string;
  name: string;
  description?: string;
  subtask: boolean;
}

export interface JsmExistingSpaceSnapshot {
  serviceDeskId: string;
  projectId: string;
  projectKey: string;
  projectName: string;
  projectTypeKey: string;
  archived: boolean;
  canBrowseProject: boolean;
  canCreateIssues: boolean;
  issueTypes: JsmIssueTypeSnapshot[];
  agentUrl: string;
  portalUrl: string;
  inspectedAt: string;
}

export interface JsmExistingSpacePreflight {
  status: JsmPreflightStatus;
  canLink: boolean;
  blockers: string[];
  warnings: string[];
  snapshot: JsmExistingSpaceSnapshot;
}
