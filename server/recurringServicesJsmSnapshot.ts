import { createHash } from "node:crypto";
import { getJsmRequestSlas, searchJiraIssues, type JiraIssue, type JsmSlaInformation, type JsmSlaPage } from "./jiraClient";

export type SnapshotSource = "manual" | "scheduled";
export type SnapshotStatus = "success" | "partial" | "error" | "not_configured";

export type RecurringJsmServiceIdentity = {
  id: number;
  jsmProjectKey?: string | null;
  jsmServiceDeskId?: string | null;
};

export type RecurringJsmSnapshotDraft = {
  serviceId: number;
  serviceDeskId: string | null;
  projectKey: string | null;
  capturedAt: Date;
  source: SnapshotSource;
  status: SnapshotStatus;
  incidentCount: number | null;
  openIncidentCount: number | null;
  criticalOpenCount: number | null;
  overdueIncidentCount: number | null;
  unresolvedOver30DaysCount: number | null;
  firstResponseMeasuredCount: number | null;
  firstResponseMetCount: number | null;
  firstResponseCompliancePct: string | null;
  resolutionMeasuredCount: number | null;
  resolutionMetCount: number | null;
  resolutionCompliancePct: string | null;
  priorityBreakdown: Record<string, number> | null;
  issueTypeBreakdown: Record<string, number> | null;
  dataFingerprint: string;
  errorCode: string | null;
  errorMessage: string | null;
  triggeredBy: number | null;
};

export type RecurringJsmSnapshotAdapter = {
  searchIssues: typeof searchJiraIssues;
  getRequestSlas: typeof getJsmRequestSlas;
};

const DEFAULT_ADAPTER: RecurringJsmSnapshotAdapter = {
  searchIssues: searchJiraIssues,
  getRequestSlas: getJsmRequestSlas,
};

const CRITICAL_PRIORITIES = new Set(["highest", "critical", "crítica", "critica", "p1"]);
const FIRST_RESPONSE_PATTERN = /(first\s*response|primera\s*respuesta|respuesta\s*inicial)/i;
const RESOLUTION_PATTERN = /(resolution|resoluci[oó]n|resolver)/i;

function normalizedLabel(value: string | null | undefined, fallback: string): string {
  return value?.trim().toLocaleLowerCase("es") || fallback;
}

function isDone(issue: JiraIssue): boolean {
  return issue.fields.status?.statusCategory?.key?.toLowerCase() === "done";
}

function dueDate(issue: JiraIssue): string | null {
  const value = issue.fields.duedate;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function percentage(met: number, measured: number): string | null {
  if (measured <= 0) return null;
  return ((met / measured) * 100).toFixed(2);
}

function slaCycles(record: JsmSlaInformation) {
  const completed = record.completedCycles ?? [];
  const ongoingBreached = record.ongoingCycle?.breached ? [record.ongoingCycle] : [];
  return [...completed, ...ongoingBreached];
}

function summarizeSla(recordsByIssue: Map<string, JsmSlaInformation[]>) {
  let firstResponseMeasured = 0;
  let firstResponseMet = 0;
  let resolutionMeasured = 0;
  let resolutionMet = 0;

  for (const records of Array.from(recordsByIssue.values())) {
    for (const record of records) {
      const cycles = slaCycles(record);
      if (FIRST_RESPONSE_PATTERN.test(record.name)) {
        firstResponseMeasured += cycles.length;
        firstResponseMet += cycles.filter(cycle => cycle.breached === false).length;
      }
      if (RESOLUTION_PATTERN.test(record.name)) {
        resolutionMeasured += cycles.length;
        resolutionMet += cycles.filter(cycle => cycle.breached === false).length;
      }
    }
  }

  return {
    firstResponseMeasured,
    firstResponseMet,
    resolutionMeasured,
    resolutionMet,
  };
}

function stableFingerprint(payload: Record<string, unknown>): string {
  const sorted = Object.fromEntries(Object.entries(payload).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

export function buildRecurringJsmSnapshot(input: {
  service: RecurringJsmServiceIdentity;
  issues: JiraIssue[];
  slaRecordsByIssue: Map<string, JsmSlaInformation[]>;
  slaFailureCount: number;
  capturedAt: Date;
  source: SnapshotSource;
  triggeredBy?: number | null;
}): RecurringJsmSnapshotDraft {
  const { service, issues, slaRecordsByIssue, slaFailureCount, capturedAt, source } = input;
  const openIssues = issues.filter(issue => !isDone(issue));
  const cutOffDate = capturedAt.toISOString().slice(0, 10);
  const thirtyDaysAgo = capturedAt.getTime() - 30 * 24 * 60 * 60 * 1000;
  const priorityBreakdown: Record<string, number> = {};
  const issueTypeBreakdown: Record<string, number> = {};

  for (const issue of issues) {
    const priority = normalizedLabel(issue.fields.priority?.name, "sin prioridad");
    const issueType = normalizedLabel(issue.fields.issuetype?.name, "sin tipo");
    priorityBreakdown[priority] = (priorityBreakdown[priority] ?? 0) + 1;
    issueTypeBreakdown[issueType] = (issueTypeBreakdown[issueType] ?? 0) + 1;
  }

  const sla = summarizeSla(slaRecordsByIssue);
  const status: SnapshotStatus = slaFailureCount === 0 ? "success" : "partial";
  const snapshotBody = {
    issues: issues.map(issue => ({
      key: issue.key,
      status: issue.fields.status?.statusCategory?.key ?? null,
      priority: issue.fields.priority?.name ?? null,
      issueType: issue.fields.issuetype?.name ?? null,
      created: issue.fields.created,
      updated: issue.fields.updated,
      dueDate: dueDate(issue),
    })),
    sla: Array.from(slaRecordsByIssue.entries()).map(([key, records]) => ({
      key,
      records: records.map(record => ({
        name: record.name,
        completed: (record.completedCycles ?? []).map(cycle => ({ breached: cycle.breached ?? null, stop: cycle.stopTime?.epochMillis ?? null })),
        ongoingBreached: record.ongoingCycle?.breached ?? null,
      })),
    })),
    slaFailureCount,
  };

  return {
    serviceId: service.id,
    serviceDeskId: service.jsmServiceDeskId ?? null,
    projectKey: service.jsmProjectKey ?? null,
    capturedAt,
    source,
    status,
    incidentCount: issues.length,
    openIncidentCount: openIssues.length,
    criticalOpenCount: openIssues.filter(issue => CRITICAL_PRIORITIES.has(normalizedLabel(issue.fields.priority?.name, ""))).length,
    overdueIncidentCount: openIssues.filter(issue => {
      const due = dueDate(issue);
      return due !== null && due < cutOffDate;
    }).length,
    unresolvedOver30DaysCount: openIssues.filter(issue => new Date(issue.fields.created).getTime() < thirtyDaysAgo).length,
    firstResponseMeasuredCount: sla.firstResponseMeasured,
    firstResponseMetCount: sla.firstResponseMet,
    firstResponseCompliancePct: percentage(sla.firstResponseMet, sla.firstResponseMeasured),
    resolutionMeasuredCount: sla.resolutionMeasured,
    resolutionMetCount: sla.resolutionMet,
    resolutionCompliancePct: percentage(sla.resolutionMet, sla.resolutionMeasured),
    priorityBreakdown,
    issueTypeBreakdown,
    dataFingerprint: stableFingerprint(snapshotBody),
    errorCode: slaFailureCount > 0 ? "JSM_SLA_PARTIAL" : null,
    errorMessage: slaFailureCount > 0 ? `${slaFailureCount} solicitudes no pudieron aportar métricas SLA.` : null,
    triggeredBy: input.triggeredBy ?? null,
  };
}

async function listAllIssues(projectKey: string, adapter: RecurringJsmSnapshotAdapter): Promise<JiraIssue[]> {
  const issues: JiraIssue[] = [];
  let nextPageToken: string | undefined;
  do {
    const page = await adapter.searchIssues(`project="${projectKey.replaceAll('"', '\\"')}" ORDER BY created ASC`, {
      maxResults: 100,
      nextPageToken,
      fields: ["summary", "status", "issuetype", "priority", "created", "updated", "duedate"],
    });
    issues.push(...page.issues);
    nextPageToken = page.isLast === false ? page.nextPageToken : undefined;
  } while (nextPageToken);
  return issues;
}

async function listAllSlas(issueKey: string, adapter: RecurringJsmSnapshotAdapter): Promise<JsmSlaInformation[]> {
  const values: JsmSlaInformation[] = [];
  let start = 0;
  let page: JsmSlaPage;
  do {
    page = await adapter.getRequestSlas(issueKey, start, 50);
    values.push(...(page.values ?? []));
    start += page.limit ?? 50;
  } while (page.isLastPage === false);
  return values;
}

export async function collectRecurringJsmSnapshot(input: {
  service: RecurringJsmServiceIdentity;
  source: SnapshotSource;
  triggeredBy?: number | null;
  capturedAt?: Date;
  adapter?: RecurringJsmSnapshotAdapter;
}): Promise<RecurringJsmSnapshotDraft> {
  const capturedAt = input.capturedAt ?? new Date();
  const service = input.service;
  if (!service.jsmProjectKey || !service.jsmServiceDeskId) {
    const fingerprint = stableFingerprint({ status: "not_configured", projectKey: service.jsmProjectKey ?? null, serviceDeskId: service.jsmServiceDeskId ?? null });
    return {
      serviceId: service.id,
      serviceDeskId: service.jsmServiceDeskId ?? null,
      projectKey: service.jsmProjectKey ?? null,
      capturedAt,
      source: input.source,
      status: "not_configured",
      incidentCount: null,
      openIncidentCount: null,
      criticalOpenCount: null,
      overdueIncidentCount: null,
      unresolvedOver30DaysCount: null,
      firstResponseMeasuredCount: null,
      firstResponseMetCount: null,
      firstResponseCompliancePct: null,
      resolutionMeasuredCount: null,
      resolutionMetCount: null,
      resolutionCompliancePct: null,
      priorityBreakdown: null,
      issueTypeBreakdown: null,
      dataFingerprint: fingerprint,
      errorCode: "JSM_NOT_CONFIGURED",
      errorMessage: "El servicio no tiene un Service Desk JSM confirmado.",
      triggeredBy: input.triggeredBy ?? null,
    };
  }

  const adapter = input.adapter ?? DEFAULT_ADAPTER;
  try {
    const issues = await listAllIssues(service.jsmProjectKey, adapter);
    const slaRecordsByIssue = new Map<string, JsmSlaInformation[]>();
    let slaFailureCount = 0;

    for (let offset = 0; offset < issues.length; offset += 10) {
      const batch = issues.slice(offset, offset + 10);
      const results = await Promise.allSettled(batch.map(issue => listAllSlas(issue.key, adapter)));
      results.forEach((result, index) => {
        if (result.status === "fulfilled") slaRecordsByIssue.set(batch[index].key, result.value);
        else slaFailureCount += 1;
      });
    }

    return buildRecurringJsmSnapshot({
      service,
      issues,
      slaRecordsByIssue,
      slaFailureCount,
      capturedAt,
      source: input.source,
      triggeredBy: input.triggeredBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      serviceId: service.id,
      serviceDeskId: service.jsmServiceDeskId,
      projectKey: service.jsmProjectKey,
      capturedAt,
      source: input.source,
      status: "error",
      incidentCount: null,
      openIncidentCount: null,
      criticalOpenCount: null,
      overdueIncidentCount: null,
      unresolvedOver30DaysCount: null,
      firstResponseMeasuredCount: null,
      firstResponseMetCount: null,
      firstResponseCompliancePct: null,
      resolutionMeasuredCount: null,
      resolutionMetCount: null,
      resolutionCompliancePct: null,
      priorityBreakdown: null,
      issueTypeBreakdown: null,
      dataFingerprint: stableFingerprint({ status: "error", message }),
      errorCode: "JSM_COLLECTION_FAILED",
      errorMessage: message.slice(0, 2000),
      triggeredBy: input.triggeredBy ?? null,
    };
  }
}
