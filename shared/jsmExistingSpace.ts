import { z } from "zod";

export const JSM_LINK_SOURCE_VALUES = ["created", "linked"] as const;
export const JSM_LINK_HEALTH_VALUES = ["pending", "healthy", "warning", "blocked"] as const;
export const JSM_LINK_RUN_SOURCE_VALUES = ["preflight", "link", "revalidate", "unlink"] as const;
export const JSM_LINK_RUN_STATUS_VALUES = ["running", "ready", "blocked", "linked", "unlinked", "error"] as const;
export const JSM_ISSUE_MAPPING_CATEGORY_VALUES = ["work_plan", "billing"] as const;
export const JSM_ISSUE_MAPPING_SOURCE_VALUES = ["selected", "detected_default"] as const;
export const JSM_ISSUE_MAPPING_STATUS_VALUES = ["active", "superseded"] as const;

export const jsmLinkSourceSchema = z.enum(JSM_LINK_SOURCE_VALUES);
export const jsmLinkHealthSchema = z.enum(JSM_LINK_HEALTH_VALUES);
export const jsmLinkRunSourceSchema = z.enum(JSM_LINK_RUN_SOURCE_VALUES);
export const jsmLinkRunStatusSchema = z.enum(JSM_LINK_RUN_STATUS_VALUES);
export const jsmIssueMappingCategorySchema = z.enum(JSM_ISSUE_MAPPING_CATEGORY_VALUES);

export type JsmLinkSource = z.infer<typeof jsmLinkSourceSchema>;
export type JsmLinkHealth = z.infer<typeof jsmLinkHealthSchema>;
export type JsmLinkRunSource = z.infer<typeof jsmLinkRunSourceSchema>;
export type JsmLinkRunStatus = z.infer<typeof jsmLinkRunStatusSchema>;
export type JsmIssueMappingCategory = z.infer<typeof jsmIssueMappingCategorySchema>;
