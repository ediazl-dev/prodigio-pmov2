import { ENV } from "./_core/env";
import {
  getAllProjects,
  getBillingByProject,
  getExecutiveContractMilestones,
  getExecutiveProjectSource,
  getProjectById,
} from "./db";
import { getFinancialDataForDeal } from "./financialDataFetcher";
import { searchJiraIssues, type JiraIssue } from "./jiraClient";
import {
  getBillingMonths,
  getRecurringServiceById,
  listRecurringServices,
} from "./recurringServicesDb";

export const JIRA_BILLING_STATUS_FIELD_ID = "customfield_11237";
export const JIRA_BILLING_STATUS_FIELD_NAME = "Estado de Facturación";

export type JiraOperationalBillingStatus = "billed" | "not_billed" | "unknown";
export type JiraBillingStatusSource = "jira_custom_field" | "jira_billing_issue_status" | "missing";

export type JiraBillingEvidenceItem = {
  key: string;
  jiraUrl: string;
  code: string;
  title: string;
  monthNumber: number | null;
  amount: number | null;
  currency: string | null;
  amountSource: "billing_schedule" | "billing_milestone" | "sale_weight" | "missing";
  dueDate: string | null;
  jiraDueDate: string | null;
  jiraUpdatedAt: string | null;
  jiraStatusName: string | null;
  jiraStatusCategory: string | null;
  billingStatus: JiraOperationalBillingStatus;
  billingStatusLabel: string;
  billingStatusSource: JiraBillingStatusSource;
  billingFieldValues: string[];
  matchedBy: "jira_issue_key" | "deal_month" | "month" | "jira_only";
  duplicateCandidates: string[];
};

export type JiraBillingEvidence = {
  entityType: "project" | "recurring_service";
  entityId: number;
  dealId: string | null;
  jiraAvailable: boolean;
  loadedAt: string;
  evidenceAt: string | null;
  sourceProjectKeys: string[];
  field: { id: string; name: string };
  summary: {
    totalItems: number;
    billedItems: number;
    notBilledItems: number;
    unknownItems: number;
    duplicateGroups: number;
    amountCoverage: { withAmount: number; total: number };
    billedByCurrency: Array<{ currency: string; amount: number; items: number }>;
    notBilledByCurrency: Array<{ currency: string; amount: number; items: number }>;
  };
  items: JiraBillingEvidenceItem[];
  warnings: string[];
  error?: string;
};

type LocalBillingItem = {
  code: string;
  title: string;
  monthNumber: number | null;
  amount: number | null;
  currency: string | null;
  amountSource: JiraBillingEvidenceItem["amountSource"];
  dueDate: string | null;
  jiraIssueKey: string | null;
};

export type JiraBillingBuildInput = {
  entityType: JiraBillingEvidence["entityType"];
  entityId: number;
  dealId: string | null;
  localItems: LocalBillingItem[];
  jiraIssues: JiraIssue[];
  sourceProjectKeys: string[];
  allowBillingIssueStatusFallback: boolean;
  jiraAvailable: boolean;
  queryWarnings?: string[];
  error?: string;
};

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCurrency(value: unknown): string | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  return normalized || null;
}

function normalizeDeal(value: unknown): string | null {
  const match = String(value ?? "").match(/(?:deal\s*)?(\d{3,})/i);
  return match?.[1] ?? null;
}

function projectDeal(project: { dealId?: string | null; projectName?: string | null }): string | null {
  return normalizeDeal(project.dealId) ?? normalizeDeal(project.projectName);
}

function issueFieldValues(issue: JiraIssue): string[] {
  const raw = issue.fields?.[JIRA_BILLING_STATUS_FIELD_ID];
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: unknown) => typeof item === "string" ? item : String((item as { value?: unknown })?.value ?? ""))
    .map(value => value.trim())
    .filter(Boolean);
}

function issueText(issue: JiraIssue): string {
  const labels = Array.isArray(issue.fields?.labels) ? issue.fields.labels.join(" ") : "";
  return `${issue.fields?.summary ?? ""} ${labels}`.toLowerCase();
}

function isBillingIssue(issue: JiraIssue): boolean {
  const text = issueText(issue);
  return text.includes("factur") || String(issue.fields?.issuetype?.name ?? "").toLowerCase() === "hito pmo";
}

function supportsBillingStatusFallback(issue: JiraIssue): boolean {
  const labels = Array.isArray(issue.fields?.labels) ? issue.fields.labels.map(value => String(value).toLowerCase()) : [];
  return labels.includes("facturacion") || (
    String(issue.fields?.issuetype?.name ?? "").toLowerCase() !== "hito pmo"
    && issueText(issue).includes("factur")
  );
}

function issueMonth(issue: JiraIssue): number | null {
  const labels = Array.isArray(issue.fields?.labels) ? issue.fields.labels : [];
  for (const label of labels) {
    const match = String(label).match(/^mes[-_ ]?(\d+)$/i);
    if (match) return Number(match[1]);
  }
  const text = String(issue.fields?.summary ?? "").replace(/_/g, " ");
  const month = text.match(/\bmes[-_ ]?(\d+)\b/i);
  if (month) return Number(month[1]);
  const milestone = text.match(/\bH(?:ito)?[-_ ]?(\d+)\b/i);
  return milestone ? Number(milestone[1]) : null;
}

function issueDeal(issue: JiraIssue): string | null {
  const text = `${issue.fields?.summary ?? ""} ${plainText(issue.fields?.description)}`;
  const explicit = text.match(/\bDeal\s*[-_ ]?(\d{3,})(?!\d)/i);
  return explicit?.[1] ?? null;
}

function plainText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join(" ");
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return [object.text, object.content].map(plainText).filter(Boolean).join(" ");
  }
  return "";
}

function statusForIssue(issue: JiraIssue, allowFallback: boolean): {
  status: JiraOperationalBillingStatus;
  label: string;
  source: JiraBillingStatusSource;
  values: string[];
} {
  const values = issueFieldValues(issue);
  const normalized = values.map(value => value.toLowerCase());
  if (normalized.some(value => value.includes("no facturado"))) {
    return { status: "not_billed", label: "No facturado según Jira", source: "jira_custom_field", values };
  }
  if (normalized.some(value => value.includes("facturado"))) {
    return { status: "billed", label: "Facturado según Jira", source: "jira_custom_field", values };
  }
  if (allowFallback && supportsBillingStatusFallback(issue)) {
    if (String(issue.fields?.status?.statusCategory?.key ?? "").toLowerCase() === "done") {
      return { status: "billed", label: "Facturado según ticket Jira", source: "jira_billing_issue_status", values };
    }
    return { status: "not_billed", label: "Pendiente según ticket Jira", source: "jira_billing_issue_status", values };
  }
  return { status: "unknown", label: "Estado de facturación N/D", source: "missing", values };
}

function scoreServiceCandidate(issue: JiraIssue, local: LocalBillingItem, dealId: string | null): number {
  const labels = Array.isArray(issue.fields?.labels) ? issue.fields.labels.map(value => String(value).toLowerCase()) : [];
  const description = plainText(issue.fields?.description).toUpperCase();
  let score = 0;
  if (local.jiraIssueKey === issue.key) score += 1000;
  if (issueFieldValues(issue).length > 0) score += 300;
  if (dealId && issueDeal(issue) === dealId) score += 160;
  if (labels.includes("facturacion")) score += 100;
  if (local.monthNumber != null && issueMonth(issue) === local.monthNumber) score += 70;
  if (local.amount != null && description.includes(String(local.amount.toFixed(2)))) score += 35;
  if (local.currency && description.includes(local.currency)) score += 25;
  if (local.currency && local.currency !== "USD" && description.includes("USD") && !description.includes(local.currency)) score -= 240;
  if (local.currency && local.currency !== "UF" && description.includes("UF") && !description.includes(local.currency)) score -= 240;
  if (local.dueDate && issue.fields?.duedate === local.dueDate) score += 20;
  if (String(issue.fields?.status?.statusCategory?.key ?? "").toLowerCase() === "done") score += 8;
  return score;
}

function aggregateByCurrency(items: JiraBillingEvidenceItem[], status: JiraOperationalBillingStatus) {
  const buckets = new Map<string, { currency: string; amount: number; items: number }>();
  for (const item of items) {
    if (item.billingStatus !== status || item.amount == null || !item.currency) continue;
    const current = buckets.get(item.currency) ?? { currency: item.currency, amount: 0, items: 0 };
    current.amount += item.amount;
    current.items += 1;
    buckets.set(item.currency, current);
  }
  return Array.from(buckets.values()).sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildJiraBillingEvidence(input: JiraBillingBuildInput): JiraBillingEvidence {
  const issuesByKey = new Map(input.jiraIssues.map(issue => [issue.key, issue]));
  const usedKeys = new Set<string>();
  const items: JiraBillingEvidenceItem[] = [];
  const warnings = [...(input.queryWarnings ?? [])];

  const localItems = input.localItems.length > 0 ? input.localItems : input.jiraIssues
    .filter(issue => isBillingIssue(issue) && (input.entityType === "project" || !input.dealId || issueDeal(issue) === input.dealId))
    .map(issue => ({
      code: issue.key,
      title: issue.fields?.summary ?? issue.key,
      monthNumber: issueMonth(issue),
      amount: null,
      currency: null,
      amountSource: "missing" as const,
      dueDate: issue.fields?.duedate ?? null,
      jiraIssueKey: issue.key,
    }));

  for (const local of localItems) {
    let candidates: JiraIssue[] = [];
    if (local.jiraIssueKey && issuesByKey.has(local.jiraIssueKey)) {
      candidates = [issuesByKey.get(local.jiraIssueKey)!];
    } else if (input.entityType === "recurring_service" && local.monthNumber != null) {
      candidates = input.jiraIssues.filter(issue => {
        if (!isBillingIssue(issue) || issueMonth(issue) !== local.monthNumber) return false;
        const deal = issueDeal(issue);
        return !deal || !input.dealId || deal === input.dealId;
      });
    }

    const ranked = candidates
      .map(issue => ({ issue, score: scoreServiceCandidate(issue, local, input.dealId) }))
      .sort((a, b) => b.score - a.score || a.issue.key.localeCompare(b.issue.key, undefined, { numeric: true }));
    const selected = ranked[0]?.issue ?? (local.jiraIssueKey ? issuesByKey.get(local.jiraIssueKey) : undefined);
    if (!selected) {
      items.push({
        key: local.jiraIssueKey ?? `local-${local.code}`,
        jiraUrl: local.jiraIssueKey ? `${ENV.jiraBaseUrl}/browse/${encodeURIComponent(local.jiraIssueKey)}` : "",
        code: local.code,
        title: local.title,
        monthNumber: local.monthNumber,
        amount: local.amount,
        currency: local.currency,
        amountSource: local.amountSource,
        dueDate: local.dueDate,
        jiraDueDate: null,
        jiraUpdatedAt: null,
        jiraStatusName: null,
        jiraStatusCategory: null,
        billingStatus: "unknown",
        billingStatusLabel: "Sin hito Jira asociado",
        billingStatusSource: "missing",
        billingFieldValues: [],
        matchedBy: local.jiraIssueKey ? "jira_issue_key" : "month",
        duplicateCandidates: [],
      });
      continue;
    }

    usedKeys.add(selected.key);
    const status = statusForIssue(selected, input.allowBillingIssueStatusFallback);
    const duplicateCandidates = ranked.slice(1).map(candidate => candidate.issue.key);
    if (duplicateCandidates.length > 0) {
      warnings.push(`${local.code}: ${duplicateCandidates.length} candidato(s) Jira adicional(es) no sumados (${duplicateCandidates.join(", ")}).`);
    }
    items.push({
      key: selected.key,
      jiraUrl: `${ENV.jiraBaseUrl}/browse/${encodeURIComponent(selected.key)}`,
      code: local.code,
      title: local.title || selected.fields?.summary || selected.key,
      monthNumber: local.monthNumber ?? issueMonth(selected),
      amount: local.amount,
      currency: local.currency,
      amountSource: local.amountSource,
      dueDate: local.dueDate,
      jiraDueDate: selected.fields?.duedate ?? null,
      jiraUpdatedAt: selected.fields?.updated ?? null,
      jiraStatusName: selected.fields?.status?.name ?? null,
      jiraStatusCategory: selected.fields?.status?.statusCategory?.key ?? null,
      billingStatus: status.status,
      billingStatusLabel: status.label,
      billingStatusSource: status.source,
      billingFieldValues: status.values,
      matchedBy: local.jiraIssueKey ? "jira_issue_key" : input.dealId && issueDeal(selected) === input.dealId ? "deal_month" : "month",
      duplicateCandidates,
    });
  }

  if (input.entityType === "recurring_service") {
    for (const issue of input.jiraIssues) {
      if (usedKeys.has(issue.key) || !isBillingIssue(issue) || (input.dealId && issueDeal(issue) && issueDeal(issue) !== input.dealId)) continue;
      const monthNumber = issueMonth(issue);
      if (monthNumber != null && items.some(item => item.monthNumber === monthNumber)) continue;
      const status = statusForIssue(issue, input.allowBillingIssueStatusFallback);
      items.push({
        key: issue.key,
        jiraUrl: `${ENV.jiraBaseUrl}/browse/${encodeURIComponent(issue.key)}`,
        code: issue.key,
        title: issue.fields?.summary ?? issue.key,
        monthNumber,
        amount: null,
        currency: null,
        amountSource: "missing",
        dueDate: issue.fields?.duedate ?? null,
        jiraDueDate: issue.fields?.duedate ?? null,
        jiraUpdatedAt: issue.fields?.updated ?? null,
        jiraStatusName: issue.fields?.status?.name ?? null,
        jiraStatusCategory: issue.fields?.status?.statusCategory?.key ?? null,
        billingStatus: status.status,
        billingStatusLabel: status.label,
        billingStatusSource: status.source,
        billingFieldValues: status.values,
        matchedBy: "jira_only",
        duplicateCandidates: [],
      });
    }
  }

  items.sort((a, b) => (a.monthNumber ?? Number.MAX_SAFE_INTEGER) - (b.monthNumber ?? Number.MAX_SAFE_INTEGER) || a.code.localeCompare(b.code));
  const evidenceAt = items.map(item => item.jiraUpdatedAt).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const duplicateGroups = items.filter(item => item.duplicateCandidates.length > 0).length;
  const amountCoverage = items.filter(item => item.amount != null).length;
  if (amountCoverage < items.length) warnings.push(`Monto contractual disponible para ${amountCoverage} de ${items.length} hito(s); los demás permanecen N/D.`);
  if (items.some(item => item.billingStatusSource === "jira_billing_issue_status")) {
    warnings.push("Algunos servicios no usan el campo Estado de Facturación; se aplicó fallback sólo a tickets inequívocos de facturación.");
  }

  return {
    entityType: input.entityType,
    entityId: input.entityId,
    dealId: input.dealId,
    jiraAvailable: input.jiraAvailable,
    loadedAt: new Date().toISOString(),
    evidenceAt,
    sourceProjectKeys: Array.from(new Set(input.sourceProjectKeys)).sort(),
    field: { id: JIRA_BILLING_STATUS_FIELD_ID, name: JIRA_BILLING_STATUS_FIELD_NAME },
    summary: {
      totalItems: items.length,
      billedItems: items.filter(item => item.billingStatus === "billed").length,
      notBilledItems: items.filter(item => item.billingStatus === "not_billed").length,
      unknownItems: items.filter(item => item.billingStatus === "unknown").length,
      duplicateGroups,
      amountCoverage: { withAmount: amountCoverage, total: items.length },
      billedByCurrency: aggregateByCurrency(items, "billed"),
      notBilledByCurrency: aggregateByCurrency(items, "not_billed"),
    },
    items,
    warnings: Array.from(new Set(warnings)),
    ...(input.error ? { error: input.error } : {}),
  };
}

async function searchAllIssues(jql: string): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await searchJiraIssues(jql, {
      maxResults: 100,
      nextPageToken,
      fields: [
        "summary",
        "status",
        "issuetype",
        "labels",
        "duedate",
        "created",
        "updated",
        "description",
        JIRA_BILLING_STATUS_FIELD_ID,
      ],
    });
    issues.push(...page.issues);
    nextPageToken = page.nextPageToken;
  } while (nextPageToken && issues.length < 2000);
  return issues;
}

async function safeIssueSearch(jql: string, label: string) {
  try {
    return { issues: await searchAllIssues(jql), warning: null as string | null };
  } catch (error) {
    return { issues: [] as JiraIssue[], warning: `${label}: ${error instanceof Error ? error.message.slice(0, 180) : "Jira no disponible"}` };
  }
}

export async function loadProjectJiraBillingEvidence(projectId: number): Promise<JiraBillingEvidence> {
  const project = await getProjectById(projectId);
  if (!project) throw new Error("Proyecto no encontrado");
  const dealId = projectDeal(project);
  const source = await getExecutiveProjectSource(projectId);
  const [executiveMilestones, billingMilestones, financial] = await Promise.all([
    source ? getExecutiveContractMilestones(projectId, source.id) : Promise.resolve([]),
    getBillingByProject(projectId),
    dealId ? getFinancialDataForDeal(dealId) : Promise.resolve({ projectFinancial: null }),
  ]);
  const saleUf = numeric(financial.projectFinancial?.valorVentaUF);
  const localItems: LocalBillingItem[] = executiveMilestones.length > 0
    ? executiveMilestones.map(milestone => {
        const weight = numeric(milestone.billingWeight);
        return {
          code: milestone.milestoneCode,
          title: milestone.title,
          monthNumber: null,
          amount: saleUf != null && weight != null ? saleUf * weight / 100 : null,
          currency: saleUf != null ? "UF" : null,
          amountSource: saleUf != null && weight != null ? "sale_weight" as const : "missing" as const,
          dueDate: milestone.jiraDueDate ?? milestone.baselineDate ?? null,
          jiraIssueKey: milestone.jiraIssueKey,
        };
      })
    : billingMilestones.map(milestone => ({
        code: `H${String(milestone.milestoneNumber).padStart(2, "0")}`,
        title: milestone.description,
        monthNumber: milestone.milestoneNumber,
        amount: numeric(milestone.amount),
        currency: normalizeCurrency(milestone.currency),
        amountSource: "billing_milestone" as const,
        dueDate: milestone.dueDate ?? null,
        jiraIssueKey: milestone.jiraIssueKey ?? null,
      }));

  if (!project.jiraProjectKey) {
    return buildJiraBillingEvidence({ entityType: "project", entityId: projectId, dealId, localItems, jiraIssues: [], sourceProjectKeys: [], allowBillingIssueStatusFallback: false, jiraAvailable: false, error: "Proyecto sin vínculo Jira." });
  }
  const result = await safeIssueSearch(`project=${project.jiraProjectKey} AND issuetype="Hito PMO" ORDER BY key`, project.jiraProjectKey);
  return buildJiraBillingEvidence({
    entityType: "project",
    entityId: projectId,
    dealId,
    localItems,
    jiraIssues: result.issues,
    sourceProjectKeys: [project.jiraProjectKey],
    allowBillingIssueStatusFallback: false,
    jiraAvailable: !result.warning,
    queryWarnings: result.warning ? [result.warning] : [],
    ...(result.warning ? { error: result.warning } : {}),
  });
}

type RecurringServiceRow = NonNullable<Awaited<ReturnType<typeof getRecurringServiceById>>>;
type RecurringBillingContext = {
  global: Awaited<ReturnType<typeof safeIssueSearch>>;
  projects: Awaited<ReturnType<typeof getAllProjects>>;
};

async function loadRecurringBillingContext(): Promise<RecurringBillingContext> {
  const [global, projects] = await Promise.all([
    safeIssueSearch('issuetype="Hito PMO" ORDER BY project,key', "Hitos PMO globales"),
    getAllProjects(),
  ]);
  return { global, projects };
}

async function buildRecurringServiceEvidence(
  service: RecurringServiceRow,
  schedule: Awaited<ReturnType<typeof getBillingMonths>>,
  context: RecurringBillingContext,
): Promise<JiraBillingEvidence> {
  const localItems: LocalBillingItem[] = schedule.map(month => ({
    code: `M${String(month.monthNumber).padStart(2, "0")}`,
    title: `Cuota mes ${month.monthNumber}`,
    monthNumber: month.monthNumber,
    amount: numeric(month.amount),
    currency: normalizeCurrency(month.currency ?? service.currency),
    amountSource: "billing_schedule",
    dueDate: month.dueDate ?? null,
    jiraIssueKey: month.jiraIssueKey ?? null,
  }));
  const sourceProjectKeys: string[] = [];
  const issueMap = new Map<string, JiraIssue>();
  const warnings: string[] = [];
  const normalizedDealId = normalizeDeal(service.dealId);

  const global = context.global;
  if (global.warning) warnings.push(global.warning);
  const globalByKey = new Map(global.issues.map(issue => [issue.key, issue]));
  for (const issue of global.issues) {
    if (normalizedDealId && issueDeal(issue) === normalizedDealId) issueMap.set(issue.key, issue);
  }

  if (normalizedDealId) {
    const relatedProjects = context.projects.filter(project => project.jiraProjectKey && projectDeal(project) === normalizedDealId);
    for (const project of relatedProjects) {
      sourceProjectKeys.push(project.jiraProjectKey!);
      const source = await getExecutiveProjectSource(project.id);
      const milestones = source ? await getExecutiveContractMilestones(project.id, source.id) : [];
      for (const milestone of milestones) {
        if (!milestone.jiraIssueKey) continue;
        const issue = globalByKey.get(milestone.jiraIssueKey);
        if (!issue) continue;
        const explicitDeal = issueDeal(issue);
        if (!explicitDeal || explicitDeal === normalizedDealId) issueMap.set(issue.key, issue);
      }
    }
  }

  if (service.jsmProjectKey) {
    sourceProjectKeys.push(service.jsmProjectKey);
    const direct = await safeIssueSearch(`project=${service.jsmProjectKey} ORDER BY created ASC`, service.jsmProjectKey);
    if (direct.warning) warnings.push(direct.warning);
    for (const issue of direct.issues) if (isBillingIssue(issue)) issueMap.set(issue.key, issue);
  }

  for (const issue of Array.from(issueMap.values())) {
    const key = issue.fields?.project?.key;
    if (key) sourceProjectKeys.push(key);
    else {
      const projectKey = issue.key.split("-")[0];
      if (projectKey) sourceProjectKeys.push(projectKey);
    }
  }
  const jiraAvailable = !global.warning || Boolean(service.jsmProjectKey && !warnings.some(warning => warning.startsWith(`${service.jsmProjectKey}:`)));
  return buildJiraBillingEvidence({
    entityType: "recurring_service",
    entityId: service.id,
    dealId: normalizedDealId,
    localItems,
    jiraIssues: Array.from(issueMap.values()),
    sourceProjectKeys,
    allowBillingIssueStatusFallback: true,
    jiraAvailable,
    queryWarnings: warnings,
    ...(!jiraAvailable ? { error: warnings.join(" · ") || "Jira no disponible" } : {}),
  });
}

export async function loadRecurringServiceJiraBillingEvidence(serviceId: number): Promise<JiraBillingEvidence> {
  const [service, schedule, context] = await Promise.all([
    getRecurringServiceById(serviceId),
    getBillingMonths(serviceId),
    loadRecurringBillingContext(),
  ]);
  if (!service) throw new Error("Servicio recurrente no encontrado");
  return buildRecurringServiceEvidence(service, schedule, context);
}

export async function loadRecurringServicesJiraBillingPortfolio(serviceIds?: number[]) {
  const [allServices, context] = await Promise.all([listRecurringServices(), loadRecurringBillingContext()]);
  const services = allServices.filter(service => !serviceIds || serviceIds.includes(service.id));
  const results = await Promise.all(services.map(async service => {
    const schedule = await getBillingMonths(service.id);
    return buildRecurringServiceEvidence(service, schedule, context);
  }));
  return Object.fromEntries(results.map(result => [result.entityId, result]));
}

export async function listProjectDealJiraCandidates(dealId: string) {
  const normalized = normalizeDeal(dealId);
  if (!normalized) return [];
  return (await getAllProjects())
    .filter(project => project.jiraProjectKey && projectDeal(project) === normalized)
    .map(project => ({ id: project.id, jiraProjectKey: project.jiraProjectKey!, projectName: project.projectName }));
}
