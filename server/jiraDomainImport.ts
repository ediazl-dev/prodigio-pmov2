type JsonRecord = Record<string, unknown>;

export interface JiraDomainSourceIssue {
  key: string;
  summary?: string | null;
  issueType?: string | null;
  statusName?: string | null;
  statusCategory?: string | null;
  assigneeAccountId?: string | null;
  assigneeName?: string | null;
  dueDate?: string | null;
  resolutionDate?: string | null;
  parentKey?: string | null;
}

export interface JiraDomainApprovedMapping {
  sourceKey: string;
  targetEntityType: string;
  targetEntityId?: string | null;
  status: string;
}

export interface JiraImportedRisk {
  riskCode: string;
  description: string;
  category: "por_confirmar";
  type: "riesgo";
  probability: "por_confirmar";
  impact: "por_confirmar";
  mitigation: null;
  owner: string;
  contingency: null;
  dueDate: string | null;
  estimatedCost: null;
  confirmed: false;
  jiraTaskId: string;
  jiraIssueKey: string;
  jiraStatusName: string | null;
  jiraStatusCategory: string | null;
  jiraAssigneeId: string | null;
}

export interface JiraImportedWbsItem {
  taskCode: string;
  taskName: string;
  phase: "por_confirmar";
  optimistic: null;
  pessimistic: null;
  probable: null;
  expected: null;
  isCritical: false;
  dependencies: null;
  assignee: string;
  jiraTaskId: string;
  issueLevel: "epic" | "story" | "task";
  epicCode: string | null;
  storyCode: string | null;
  jiraIssueKey: string;
  jiraParentKey: string | null;
  jiraStatusName: string | null;
  jiraStatusCategory: string | null;
  jiraAssigneeId: string | null;
  acceptanceCriteria: null;
  storyPoints: null;
}

export interface JiraDomainImportException {
  domain: "risks" | "planning";
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

function sourceIssues(value: unknown): JiraDomainSourceIssue[] {
  if (!value || typeof value !== "object") return [];
  const issues = (value as JsonRecord).issues;
  return Array.isArray(issues) ? issues as JiraDomainSourceIssue[] : [];
}

function issueLevel(mapping: JiraDomainApprovedMapping, issue: JiraDomainSourceIssue) {
  if (mapping.targetEntityType === "epic") return "epic" as const;
  const observedType = normalizedText(issue.issueType)?.toLocaleLowerCase("es") ?? "";
  return observedType.includes("story") || observedType.includes("historia")
    ? "story" as const
    : "task" as const;
}

export function buildMappedJiraDomainImport(input: {
  sourceSnapshot: unknown;
  mappings: JiraDomainApprovedMapping[];
}) {
  const issues = sourceIssues(input.sourceSnapshot);
  const issuesByKey = new Map(
    issues
      .map(issue => [normalizedKey(issue.key), issue] as const)
      .filter(([key]) => Boolean(key)),
  );
  const approvedMappings = input.mappings
    .filter(mapping => mapping.status === "approved")
    .map(mapping => ({ ...mapping, sourceKey: normalizedKey(mapping.sourceKey) }))
    .filter(mapping => Boolean(mapping.sourceKey))
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey));
  const wbsMappingsByKey = new Map(
    approvedMappings
      .filter(mapping => mapping.targetEntityType === "epic" || mapping.targetEntityType === "task")
      .map(mapping => [mapping.sourceKey, mapping] as const),
  );
  const levelsByKey = new Map<string, "epic" | "story" | "task">();
  for (const [key, mapping] of Array.from(wbsMappingsByKey.entries())) {
    const issue = issuesByKey.get(key);
    if (issue) levelsByKey.set(key, issueLevel(mapping, issue));
  }

  const risks: JiraImportedRisk[] = [];
  const wbsItems: JiraImportedWbsItem[] = [];
  const exceptions: JiraDomainImportException[] = [];

  for (const mapping of approvedMappings) {
    if (!["risk", "epic", "task"].includes(mapping.targetEntityType)) continue;
    const issue = issuesByKey.get(mapping.sourceKey);
    const domain = mapping.targetEntityType === "risk" ? "risks" as const : "planning" as const;
    if (!issue) {
      exceptions.push({
        domain,
        sourceKey: mapping.sourceKey,
        reason: "El issue aprobado no está presente en el snapshot Jira vigente.",
      });
      continue;
    }

    const summary = normalizedText(issue.summary) ?? "[POR CONFIRMAR]";
    const assigneeName = normalizedText(issue.assigneeName) ?? "[POR CONFIRMAR]";
    const jiraStatusName = normalizedText(issue.statusName);
    const jiraStatusCategory = normalizedText(issue.statusCategory);
    const jiraAssigneeId = normalizedText(issue.assigneeAccountId);

    if (mapping.targetEntityType === "risk") {
      risks.push({
        riskCode: normalizedText(mapping.targetEntityId) ?? mapping.sourceKey,
        description: summary,
        category: "por_confirmar",
        type: "riesgo",
        probability: "por_confirmar",
        impact: "por_confirmar",
        mitigation: null,
        owner: assigneeName,
        contingency: null,
        dueDate: normalizedDate(issue.dueDate),
        estimatedCost: null,
        confirmed: false,
        jiraTaskId: mapping.sourceKey,
        jiraIssueKey: mapping.sourceKey,
        jiraStatusName,
        jiraStatusCategory,
        jiraAssigneeId,
      });
      continue;
    }

    const level = levelsByKey.get(mapping.sourceKey) ?? "task";
    const parentKey = normalizedKey(issue.parentKey) || null;
    const parentLevel = parentKey ? levelsByKey.get(parentKey) ?? null : null;
    const parentIssue = parentKey ? issuesByKey.get(parentKey) : null;
    const grandParentKey = parentIssue ? normalizedKey(parentIssue.parentKey) || null : null;
    const grandParentLevel = grandParentKey ? levelsByKey.get(grandParentKey) ?? null : null;
    let epicCode: string | null = level === "epic" ? mapping.sourceKey : null;
    let storyCode: string | null = level === "story" ? mapping.sourceKey : null;
    if (level === "story" && parentLevel === "epic") epicCode = parentKey;
    if (level === "task" && parentLevel === "epic") epicCode = parentKey;
    if (level === "task" && parentLevel === "story") {
      storyCode = parentKey;
      if (grandParentLevel === "epic") epicCode = grandParentKey;
    }

    wbsItems.push({
      taskCode: normalizedText(mapping.targetEntityId) ?? mapping.sourceKey,
      taskName: summary,
      phase: "por_confirmar",
      optimistic: null,
      pessimistic: null,
      probable: null,
      expected: null,
      isCritical: false,
      dependencies: null,
      assignee: assigneeName,
      jiraTaskId: mapping.sourceKey,
      issueLevel: level,
      epicCode,
      storyCode,
      jiraIssueKey: mapping.sourceKey,
      jiraParentKey: parentKey,
      jiraStatusName,
      jiraStatusCategory,
      jiraAssigneeId,
      acceptanceCriteria: null,
      storyPoints: null,
    });

    if (level !== "epic" && !parentKey) {
      exceptions.push({
        domain: "planning",
        sourceKey: mapping.sourceKey,
        reason: "Jira no informa una clave de padre; la jerarquía permanece [POR CONFIRMAR].",
      });
    } else if (parentKey && !parentIssue) {
      exceptions.push({
        domain: "planning",
        sourceKey: mapping.sourceKey,
        reason: `El padre Jira ${parentKey} no está presente en el snapshot vigente; la jerarquía permanece [POR CONFIRMAR].`,
      });
    } else if (parentKey && !wbsMappingsByKey.has(parentKey)) {
      exceptions.push({
        domain: "planning",
        sourceKey: mapping.sourceKey,
        reason: `El padre Jira ${parentKey} no tiene un mapeo WBS aprobado; la jerarquía permanece [POR CONFIRMAR].`,
      });
    }
  }

  return { risks, wbsItems, exceptions };
}
