import { buildMappedJiraDocumentPlan, buildMappedJiraDomainImport, type JiraDomainApprovedMapping, type JiraDomainSourceIssue } from "./jiraDomainImport";
import { deriveJiraMilestoneObservation } from "./jiraMilestoneSync";

type JsonRecord = Record<string, unknown>;

export interface JiraReconciliationMapping extends JiraDomainApprovedMapping {
  syncDirection?: string | null;
}

export interface RawJiraIssue {
  key: string;
  fields?: {
    summary?: string | null;
    issuetype?: { name?: string | null } | null;
    status?: {
      name?: string | null;
      statusCategory?: { key?: string | null; name?: string | null } | null;
    } | null;
    assignee?: { accountId?: string | null; displayName?: string | null } | null;
    duedate?: string | null;
    resolutiondate?: string | null;
    parent?: { key?: string | null } | null;
  } | null;
}

export interface JiraMilestoneReconciliation {
  sourceKey: string;
  targetEntityId: string | null;
  jiraStatusName: string | null;
  jiraDueDate: string | null;
  jiraClosedDate: string | null;
  semanticStatus: ReturnType<typeof deriveJiraMilestoneObservation>["semanticStatus"];
}

export interface JiraReconciliationException {
  domain: "milestones" | "risks" | "planning" | "documents";
  sourceKey: string;
  reason: string;
}

function normalizedKey(value: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function normalizedText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizedDate(value: unknown) {
  if (typeof value !== "string") return null;
  const candidate = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
}

function previousIssues(value: unknown): JiraDomainSourceIssue[] {
  if (!value || typeof value !== "object") return [];
  return Array.isArray((value as JsonRecord).issues)
    ? (value as JsonRecord).issues as JiraDomainSourceIssue[]
    : [];
}

function statusCategoryValue(issue: RawJiraIssue) {
  return normalizedText(issue.fields?.status?.statusCategory?.key)
    ?? normalizedText(issue.fields?.status?.statusCategory?.name);
}

function statusCategoryKey(value: string | null) {
  const normalized = value?.trim().toLocaleLowerCase("es") ?? "";
  return ["done", "complete", "completed", "completado", "finalizado", "hecho"].some(token => normalized.includes(token))
    ? "done"
    : normalized || null;
}

export function selectApprovedJiraToPmoMappings(mappings: JiraReconciliationMapping[]) {
  return mappings
    .filter(mapping => mapping.status === "approved")
    .filter(mapping => (mapping.syncDirection ?? "jira_to_pmo") === "jira_to_pmo")
    .map(mapping => ({ ...mapping, sourceKey: normalizedKey(mapping.sourceKey) }))
    .filter(mapping => Boolean(mapping.sourceKey) && mapping.targetEntityType !== "ignored")
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
}

export function reconciliationIssueKeys(mappings: JiraReconciliationMapping[]) {
  return Array.from(new Set(selectApprovedJiraToPmoMappings(mappings).map(mapping => mapping.sourceKey))).sort();
}

export function normalizeRawJiraIssue(issue: RawJiraIssue): JiraDomainSourceIssue | null {
  const key = normalizedKey(issue.key);
  if (!key) return null;
  return {
    key,
    summary: normalizedText(issue.fields?.summary),
    issueType: normalizedText(issue.fields?.issuetype?.name),
    statusName: normalizedText(issue.fields?.status?.name),
    statusCategory: statusCategoryValue(issue),
    assigneeAccountId: normalizedText(issue.fields?.assignee?.accountId),
    assigneeName: normalizedText(issue.fields?.assignee?.displayName),
    dueDate: normalizedDate(issue.fields?.duedate),
    resolutionDate: normalizedDate(issue.fields?.resolutiondate),
    parentKey: normalizedKey(issue.fields?.parent?.key) || null,
  };
}

export function mergeRefreshedJiraIssues(input: {
  sourceSnapshot: unknown;
  requestedKeys: string[];
  refreshedIssues: RawJiraIssue[];
  asOf: string;
}) {
  const base = input.sourceSnapshot && typeof input.sourceSnapshot === "object"
    ? { ...(input.sourceSnapshot as JsonRecord) }
    : {};
  const requested = new Set(input.requestedKeys.map(normalizedKey).filter(Boolean));
  const retained = previousIssues(input.sourceSnapshot)
    .filter(issue => !requested.has(normalizedKey(issue.key)));
  const refreshed = input.refreshedIssues
    .map(normalizeRawJiraIssue)
    .filter((issue): issue is JiraDomainSourceIssue => Boolean(issue))
    .filter(issue => requested.has(issue.key));
  const issuesByKey = new Map<string, JiraDomainSourceIssue>();
  for (const issue of [...retained, ...refreshed]) issuesByKey.set(normalizedKey(issue.key), issue);
  return {
    ...base,
    asOf: input.asOf,
    issues: Array.from(issuesByKey.values()).sort((left, right) => normalizedKey(left.key).localeCompare(normalizedKey(right.key))),
  };
}

export function buildJiraReconciliationPlan(input: {
  sourceSnapshot: unknown;
  mappings: JiraReconciliationMapping[];
  now?: Date;
}) {
  const mappings = selectApprovedJiraToPmoMappings(input.mappings);
  const domains = buildMappedJiraDomainImport({ sourceSnapshot: input.sourceSnapshot, mappings });
  const documents = buildMappedJiraDocumentPlan({ sourceSnapshot: input.sourceSnapshot, mappings });
  const issuesByKey = new Map(previousIssues(input.sourceSnapshot).map(issue => [normalizedKey(issue.key), issue] as const));
  const milestones: JiraMilestoneReconciliation[] = [];
  const exceptions: JiraReconciliationException[] = [
    ...domains.exceptions,
    ...documents.exceptions,
  ];

  for (const mapping of mappings.filter(item => item.targetEntityType === "milestone")) {
    const issue = issuesByKey.get(mapping.sourceKey);
    if (!issue) {
      exceptions.push({
        domain: "milestones",
        sourceKey: mapping.sourceKey,
        reason: "El hito aprobado no está presente en la respuesta Jira vigente; la observación anterior no se reutiliza.",
      });
      continue;
    }
    const observation = deriveJiraMilestoneObservation({
      key: issue.key,
      fields: {
        status: {
          name: issue.statusName,
          statusCategory: { key: statusCategoryKey(issue.statusCategory ?? null) },
        },
        duedate: issue.dueDate,
        resolutiondate: issue.resolutionDate,
      },
    }, input.now);
    milestones.push({
      sourceKey: mapping.sourceKey,
      targetEntityId: normalizedText(mapping.targetEntityId),
      ...observation,
    });
  }

  return {
    mappings,
    issueKeys: reconciliationIssueKeys(mappings),
    risks: domains.risks,
    wbsItems: domains.wbsItems,
    documents,
    milestones,
    exceptions,
  };
}
