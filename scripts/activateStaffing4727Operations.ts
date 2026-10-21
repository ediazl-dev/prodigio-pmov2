import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  recurringServiceBillingMonths,
  recurringServiceDocuments,
  recurringServiceFinancialEvidence,
  recurringServiceJsmIssueTypeMappings,
  recurringServiceReportEvidence,
  recurringServiceSlaConfig,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { getJiraRuntimeCredentials } from "../server/jiraClient";
import {
  buildStaffing4727OperationalPlan,
  isApprovalControl,
  isSupplementalDefinition,
  STAFFING4727_EXISTING_CONTROL_IDS,
  STAFFING4727_MATRIX_VERSION,
  STAFFING4727_SERVICE_ID,
  STAFFING4727_SUPPLEMENTAL_KEYS,
  type Staffing4727OperationalItem,
} from "../server/staffing4727OperationalPlan";

/**
 * Activación operacional de Staffing4727.
 *
 * Seguridad operacional:
 * - dry-run es el modo predeterminado y sólo hace SELECT/GET más artefactos locales;
 * - --apply es el único modo que escribe PMO/Jira;
 * - no se crea ni modifica facturación, documentos, report evidence o stages;
 * - no se cierra ninguna etapa;
 * - todos los POST tienen intent persistido y receipt inmediato;
 * - una respuesta incierta se prueba por label/GET y detiene la corrida si no hay
 *   artefacto demostrable: jamás se reintenta a ciegas.
 */

const TARGET_PROJECT_KEY = "CONSALOP02" as const;
const TARGET_PROJECT_ID = "13114" as const;
const TARGET_SERVICE_DESK_ID = "399" as const;
const STAFFING_ISSUE_TYPE_ID = "12980" as const;
const STAFFING_ISSUE_TYPE_NAME = "Tarea de Staffing" as const;
const FINANCIAL_ISSUE_TYPE_ID = "12979" as const;
const SERVICE_LABEL = "pmo-service-2070001" as const;
const JOURNAL_ROOT =
  process.env.STAFFING4727_JOURNAL_DIR ??
  "/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-activation";
const APPLY = process.argv.includes("--apply");
const RUN_ID =
  process.env.STAFFING4727_RUN_ID ??
  `staffing4727-${new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 17)}`;

const PERIODS = [1, 2, 3, 4, 5, 6] as const;
const EXPECTED_BILLING = 6;
const EXPECTED_PLAN_CONTROLS = 24;

class StopActivationError extends Error {
  constructor(message: string) {
    super(`STOP: ${message}`);
    this.name = "StopActivationError";
  }
}

type JiraIssue = {
  id: string;
  key: string;
  self?: string;
  fields?: {
    project?: { id?: string; key?: string };
    issuetype?: { id?: string; name?: string };
    summary?: string;
    labels?: string[];
    issuelinks?: Array<{
      id?: string;
      type?: { id?: string; name?: string };
      inwardIssue?: { key?: string };
      outwardIssue?: { key?: string };
    }>;
    [key: string]: unknown;
  };
};

type JiraSearchResponse = {
  issues?: JiraIssue[];
  total?: number;
  isLast?: boolean;
  nextPageToken?: string;
};

type JiraLinkType = {
  id: string;
  name: string;
  inward?: string;
  outward?: string;
};

type JournalIntent = {
  kind: "create_issue" | "link_issue";
  intentKey: string;
  createdAt: string;
  payloadFingerprint: string;
  payload: Record<string, unknown>;
  status: "planned" | "posted" | "recovered" | "verified" | "uncertain";
};

type JournalReceipt = {
  kind: JournalIntent["kind"];
  intentKey: string;
  recordedAt: string;
  key?: string;
  id?: string;
  self?: string;
  recovered?: boolean;
  verified?: boolean;
};

type Journal = {
  version: 1;
  runId: string;
  serviceId: number;
  matrixVersion: string;
  createdAt: string;
  updatedAt: string;
  intents: Record<string, JournalIntent>;
  receipts: Record<string, JournalReceipt>;
};

type PlanRow = typeof recurringServiceWorkPlan.$inferSelect;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonForHash(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested instanceof Date) return nested.toISOString();
    return nested;
  });
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(JOURNAL_ROOT, { recursive: true, mode: 0o700 });
  chmodSync(JOURNAL_ROOT, 0o700);
  const temporary = `${path}.tmp-${process.pid}`;
  const text = `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(temporary, text, { mode: 0o600 });
  renameSync(temporary, path);
  chmodSync(path, 0o600);
}

function saveJournal(journal: Journal): void {
  journal.updatedAt = new Date().toISOString();
  const path = join(JOURNAL_ROOT, "journal.json");
  writeJsonAtomic(path, journal);
  writeFileSync(
    join(JOURNAL_ROOT, "journal.json.sha256"),
    `${sha256(readFileSync(path))}  journal.json\n`,
    {
      mode: 0o600,
    }
  );
}

function loadJournal(): Journal {
  const path = join(JOURNAL_ROOT, "journal.json");
  if (!existsSync(path)) {
    return {
      version: 1,
      runId: RUN_ID,
      serviceId: STAFFING4727_SERVICE_ID,
      matrixVersion: STAFFING4727_MATRIX_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      intents: {},
      receipts: {},
    };
  }
  const journal = JSON.parse(readFileSync(path, "utf8")) as Journal;
  if (journal.version !== 1 || journal.serviceId !== STAFFING4727_SERVICE_ID) {
    throw new StopActivationError(
      "journal existente incompatible con Staffing4727; no sobrescribirlo"
    );
  }
  return journal;
}

function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "error desconocido";
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new StopActivationError(message);
}

async function jiraRequest<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const credentials = getJiraRuntimeCredentials();
  assert(credentials.baseUrl, "JIRA_BASE_URL no está configurado");
  const headers = new Headers(init.headers);
  headers.set("Authorization", credentials.authorization);
  headers.set("Accept", "application/json");
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${credentials.baseUrl}${path}`, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    // Never include response body or credentials in logs; a POST failure is uncertain.
    throw new Error(
      `Jira ${init.method ?? "GET"} ${path} respondió HTTP ${response.status}`
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  return contentType.includes("application/json")
    ? ((await response.json()) as T)
    : ({} as T);
}

async function jiraGet<T>(path: string): Promise<T> {
  return jiraRequest<T>(path, { method: "GET" });
}

async function jiraSearch(
  jql: string,
  fields: string[] = ["summary", "labels", "project", "issuetype", "issuelinks"]
): Promise<JiraIssue[]> {
  const result = await jiraRequest<JiraSearchResponse>(
    "/rest/api/3/search/jql",
    {
      method: "POST",
      body: JSON.stringify({ jql, maxResults: 100, fields }),
    }
  );
  return result.issues ?? [];
}

async function getIssue(key: string): Promise<JiraIssue> {
  return jiraGet<JiraIssue>(
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,labels,project,issuetype,issuelinks`
  );
}

function adfDescription(description: string): Record<string, unknown> {
  return {
    type: "doc",
    version: 1,
    content: description.split("\n").map(text => ({
      type: "paragraph",
      content: text ? [{ type: "text", text }] : [],
    })),
  };
}

function issueFieldsFor(
  item: Staffing4727OperationalItem,
  workPlanId: number
): Record<string, unknown> {
  const fields: Record<string, unknown> = {
    project: { id: TARGET_PROJECT_ID },
    issuetype: { id: STAFFING_ISSUE_TYPE_ID },
    summary: item.title,
    description: adfDescription(item.description),
    labels: [
      SERVICE_LABEL,
      `pmo-wp-${workPlanId}`,
      `pmo-rs-${STAFFING4727_SERVICE_ID}-work-plan-${workPlanId}`,
    ],
  };
  // Approval tasks have no baseline date because formal receipt is unknown. Other
  // observed plan dates remain visible as objectives, never as historical proof.
  if (item.dueDate && !isApprovalControl(item)) fields.duedate = item.dueDate;
  return fields;
}

function periodNumbers(period: string): number[] {
  const one = /^M0([1-6])$/.exec(period);
  if (one) return [Number(one[1])];
  if (period === "M01–M06" || period === "M01-M06") return [...PERIODS];
  return [];
}

function canonicalMonthFromSummary(summary: string): number | null {
  const match = /Deal\s*4727_H([1-6])_Mes\s*\1/i.exec(summary);
  return match ? Number(match[1]) : null;
}

async function readJiraPreflight(): Promise<{
  linkType: JiraLinkType;
  milestones: Map<number, JiraIssue>;
  targetRequestType: Record<string, unknown>;
}> {
  const project = await jiraGet<{
    id?: string;
    key?: string;
    projectTypeKey?: string;
  }>(`/rest/api/3/project/${TARGET_PROJECT_ID}`);
  assert(
    String(project.id) === TARGET_PROJECT_ID &&
      project.key === TARGET_PROJECT_KEY,
    "el proyecto destino no coincide con 13114/CONSALOP02"
  );

  const createMeta = await jiraGet<Record<string, unknown>>(
    `/rest/api/3/issue/createmeta/${TARGET_PROJECT_ID}/issuetypes/${STAFFING_ISSUE_TYPE_ID}`
  );
  const rawMetaFields = createMeta.fields;
  const metaFields = Array.isArray(rawMetaFields)
    ? (rawMetaFields as Array<{ key?: string; fieldId?: string }>)
    : Object.entries((rawMetaFields ?? {}) as Record<string, unknown>).map(
        ([key, value]) => ({
          key,
          fieldId:
            typeof value === "object" && value !== null && "fieldId" in value
              ? String((value as { fieldId?: unknown }).fieldId ?? "")
              : undefined,
        })
      );
  const enabledFieldKeys = new Set<string>([
    ...metaFields.flatMap(field =>
      [field.key, field.fieldId].filter((value): value is string =>
        Boolean(value)
      )
    ),
  ]);
  assert(
    ["summary", "description", "duedate"].every(field =>
      enabledFieldKeys.has(field)
    ),
    "Tarea de Staffing no expone summary/description/duedate en createmeta"
  );
  const issueType = await jiraGet<{ id?: string; name?: string }>(
    `/rest/api/3/issuetype/${STAFFING_ISSUE_TYPE_ID}`
  );
  assert(
    String(issueType.id) === STAFFING_ISSUE_TYPE_ID &&
      issueType.name === STAFFING_ISSUE_TYPE_NAME,
    `issue type ${STAFFING_ISSUE_TYPE_ID} no es ${STAFFING_ISSUE_TYPE_NAME}`
  );

  const requestPage = await jiraGet<{
    values?: Array<Record<string, unknown>>;
  }>(
    `/rest/servicedeskapi/servicedesk/${TARGET_SERVICE_DESK_ID}/requesttype?limit=100`
  );
  const requestTypes = requestPage.values ?? [];
  const targetRequestType = requestTypes.find(
    requestType => String(requestType.id) === STAFFING_ISSUE_TYPE_ID
  );
  assert(
    targetRequestType &&
      String(targetRequestType.name) === STAFFING_ISSUE_TYPE_NAME,
    "request type 12980 Tarea de Staffing no está verificado"
  );

  const issueLinkTypes = await jiraGet<{ issueLinkTypes?: JiraLinkType[] }>(
    "/rest/api/3/issueLinkType"
  );
  const relates = (issueLinkTypes.issueLinkTypes ?? []).filter(linkType => {
    const values = [linkType.name, linkType.inward, linkType.outward].map(
      value =>
        String(value ?? "")
          .trim()
          .toLowerCase()
    );
    return (
      values.includes("relates") ||
      values.includes("relates to") ||
      values.includes("se relaciona con")
    );
  });
  assert(
    relates.length === 1,
    `no se puede resolver unívocamente el link type Relates desde GET /issueLinkType (${relates.length} candidatos)`
  );

  // The parent agent moves the six canonical financial issues before --apply. We
  // locate them only in the verified destination, by verified financial type and
  // the backed-up summary pattern; no source issue is recreated.
  const candidateIssues = await jiraSearch(
    `project = ${TARGET_PROJECT_KEY} AND issuetype = ${FINANCIAL_ISSUE_TYPE_ID}`,
    ["summary", "labels", "project", "issuetype", "issuelinks"]
  );
  const milestones = new Map<number, JiraIssue>();
  for (const issue of candidateIssues) {
    const month = canonicalMonthFromSummary(
      String(issue.fields?.summary ?? "")
    );
    if (!month) continue;
    assert(
      issue.fields?.project?.id === TARGET_PROJECT_ID &&
        issue.fields?.project?.key === TARGET_PROJECT_KEY,
      `hito ${issue.key} pertenece a otro proyecto`
    );
    assert(
      String(issue.fields?.issuetype?.id) === FINANCIAL_ISSUE_TYPE_ID,
      `hito ${issue.key} no es financiero 12979`
    );
    assert(
      !milestones.has(month),
      `más de un hito canónico para M0${month}; no adivinar enlace`
    );
    milestones.set(month, issue);
  }
  assert(
    milestones.size === EXPECTED_BILLING,
    "faltan uno o más hitos canónicos movidos a CONSALOP02; no crear tareas aún"
  );
  return { linkType: relates[0], milestones, targetRequestType };
}

async function readDbState(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [
    services,
    plan,
    billing,
    mappings,
    sla,
    documents,
    reports,
    financialEvidence,
  ] = await Promise.all([
    db
      .select()
      .from(recurringServices)
      .where(eq(recurringServices.id, STAFFING4727_SERVICE_ID)),
    db
      .select()
      .from(recurringServiceWorkPlan)
      .where(eq(recurringServiceWorkPlan.serviceId, STAFFING4727_SERVICE_ID)),
    db
      .select()
      .from(recurringServiceBillingMonths)
      .where(
        eq(recurringServiceBillingMonths.serviceId, STAFFING4727_SERVICE_ID)
      ),
    db
      .select()
      .from(recurringServiceJsmIssueTypeMappings)
      .where(
        eq(
          recurringServiceJsmIssueTypeMappings.serviceId,
          STAFFING4727_SERVICE_ID
        )
      ),
    db
      .select()
      .from(recurringServiceSlaConfig)
      .where(eq(recurringServiceSlaConfig.serviceId, STAFFING4727_SERVICE_ID)),
    db
      .select()
      .from(recurringServiceDocuments)
      .where(eq(recurringServiceDocuments.serviceId, STAFFING4727_SERVICE_ID)),
    db
      .select()
      .from(recurringServiceReportEvidence)
      .where(
        eq(recurringServiceReportEvidence.serviceId, STAFFING4727_SERVICE_ID)
      ),
    db
      .select()
      .from(recurringServiceFinancialEvidence)
      .where(
        eq(recurringServiceFinancialEvidence.serviceId, STAFFING4727_SERVICE_ID)
      ),
  ]);
  return {
    service: services[0],
    plan,
    billing,
    mappings,
    sla,
    documents,
    reports,
    financialEvidence,
  };
}

function validateDbState(state: Awaited<ReturnType<typeof readDbState>>): void {
  const service = state.service;
  assert(service, `servicio ${STAFFING4727_SERVICE_ID} no existe`);
  assert(
    service.dealId === "4727" && service.serviceType === "staffing",
    "la identidad Deal4727/staffing no coincide"
  );
  assert(
    service.jsmProjectKey === TARGET_PROJECT_KEY &&
      service.jsmProjectId === TARGET_PROJECT_ID,
    "el servicio no está vinculado a CONSALOP02/13114"
  );
  assert(
    service.jsmServiceDeskId === TARGET_SERVICE_DESK_ID,
    "el service desk del servicio no es 399"
  );
  assert(
    service.status === "activo",
    "el servicio no está activo; no cambiar lifecycle"
  );
  assert(
    state.billing.length === EXPECTED_BILLING,
    "no hay exactamente seis cuotas existentes; no tocar facturación"
  );
  assert(
    state.billing.every(
      month => month.currency === "UF" && Number(month.amount) === 195
    ),
    "las cuotas existentes no son seis UF195; no tocar facturación"
  );
  const controlIds = state.plan
    .filter(item => item.id >= 420001 && item.id <= 420024)
    .map(item => item.id)
    .sort((a, b) => a - b);
  assert(
    controlIds.length === EXPECTED_PLAN_CONTROLS,
    "no se encuentran los 24 controles existentes 420001–420024"
  );
  assert(
    JSON.stringify(controlIds) ===
      JSON.stringify([...STAFFING4727_EXISTING_CONTROL_IDS]),
    "la identidad de controles existentes cambió; detener"
  );
  assert(
    state.sla.length === 0,
    "se detectó configuración SLA; este Staffing no agrega SLA/DR/24x7"
  );
}

function selectiveBackup(
  state: Awaited<ReturnType<typeof readDbState>>
): Record<string, unknown> {
  return {
    capturedAt: new Date().toISOString(),
    service: state.service,
    workPlan: state.plan,
    billing: state.billing,
    mappings: state.mappings,
    sla: state.sla,
    documents: state.documents,
    reports: state.reports,
    financialEvidence: state.financialEvidence,
    preservation: {
      billingRows: state.billing.length,
      billingAmounts: state.billing.map(row => ({
        id: row.id,
        amount: row.amount,
        currency: row.currency,
      })),
      documentsRows: state.documents.length,
      reportEvidenceRows: state.reports.length,
      financialEvidenceRows: state.financialEvidence.length,
    },
  };
}

function saveSelectiveBackup(state: Awaited<ReturnType<typeof readDbState>>): {
  path: string;
  sha256: string;
} {
  const backup = selectiveBackup(state);
  const path = join(JOURNAL_ROOT, "pmo-before-selective.json");
  writeJsonAtomic(path, backup);
  const digest = sha256(readFileSync(path));
  writeFileSync(`${path}.sha256`, `${digest}  pmo-before-selective.json\n`, {
    mode: 0o600,
  });
  return { path, sha256: digest };
}

async function ensurePlanRows(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  current: Awaited<ReturnType<typeof readDbState>>,
  matrix: Staffing4727OperationalItem[]
): Promise<Awaited<ReturnType<typeof readDbState>>> {
  await db.transaction(async tx => {
    for (const matrixItem of matrix.filter(
      item => !isSupplementalDefinition(item)
    )) {
      const row = current.plan.find(
        planItem => planItem.id === matrixItem.workPlanId
      );
      assert(row, `control ${matrixItem.workPlanId} no está en PMO`);
      const nextDueDate = isApprovalControl(matrixItem) ? null : row.dueDate;
      await tx
        .update(recurringServiceWorkPlan)
        .set({ description: matrixItem.description, dueDate: nextDueDate })
        .where(
          and(
            eq(recurringServiceWorkPlan.id, row.id),
            eq(recurringServiceWorkPlan.serviceId, STAFFING4727_SERVICE_ID)
          )
        );
    }
    for (const matrixItem of matrix.filter(isSupplementalDefinition)) {
      const matches = current.plan.filter(
        planItem =>
          planItem.serviceId === STAFFING4727_SERVICE_ID &&
          planItem.title === matrixItem.title
      );
      assert(
        matches.length <= 1,
        `definición ${matrixItem.stableKey} está duplicada; no insertar otra`
      );
      if (matches.length === 0) {
        await tx.insert(recurringServiceWorkPlan).values({
          serviceId: STAFFING4727_SERVICE_ID,
          itemType: matrixItem.itemType,
          title: matrixItem.title,
          description: matrixItem.description,
          frequency: matrixItem.frequency,
          dueDate: null,
          monthNumber: null,
          status: "pendiente",
          jiraIssueKey: null,
          sortOrder: matrixItem.sortOrder,
        });
      } else {
        await tx
          .update(recurringServiceWorkPlan)
          .set({
            description: matrixItem.description,
            dueDate: null,
            frequency: matrixItem.frequency,
          })
          .where(
            and(
              eq(recurringServiceWorkPlan.id, matches[0].id),
              eq(recurringServiceWorkPlan.serviceId, STAFFING4727_SERVICE_ID)
            )
          );
      }
    }
  });
  const after = await readDbState(db);
  validateDbState(after);
  return after;
}

function itemForRow(
  row: PlanRow,
  matrix: Staffing4727OperationalItem[]
): Staffing4727OperationalItem {
  const match = matrix.find(
    item => item.workPlanId === row.id || item.title === row.title
  );
  assert(match, `plan ${row.id} no tiene definición en la matriz contractual`);
  return {
    ...match,
    workPlanId: row.id,
    dueDate: isApprovalControl(match) ? null : row.dueDate,
  };
}

function payloadFingerprint(payload: Record<string, unknown>): string {
  return sha256(jsonForHash(payload));
}

function intentKeyForIssue(workPlanId: number): string {
  return `issue:pmo-wp-${workPlanId}`;
}

function intentKeyForLink(taskKey: string, milestoneKey: string): string {
  return `link:${taskKey}:${milestoneKey}`;
}

async function findByUniqueLabel(label: string): Promise<JiraIssue | null> {
  const issues = await jiraSearch(
    `project = ${TARGET_PROJECT_KEY} AND labels = "${label}"`,
    ["summary", "labels", "project", "issuetype", "issuelinks"]
  );
  if (issues.length > 1)
    throw new StopActivationError(
      `label ${label} tiene ${issues.length} issues; no elegir uno`
    );
  return issues[0] ?? null;
}

function saveIntent(journal: Journal, intent: JournalIntent): void {
  journal.intents[intent.intentKey] = intent;
  saveJournal(journal);
}

function saveReceipt(journal: Journal, receipt: JournalReceipt): void {
  journal.receipts[receipt.intentKey] = receipt;
  const existing = journal.intents[receipt.intentKey];
  if (existing) existing.status = receipt.recovered ? "recovered" : "posted";
  saveJournal(journal);
}

async function createIssueWithProof(
  journal: Journal,
  item: Staffing4727OperationalItem
): Promise<JiraIssue> {
  const workPlanId = item.workPlanId;
  assert(workPlanId, `item ${item.stableKey} no tiene id PMO antes de POST`);
  const label = `pmo-wp-${workPlanId}`;
  const intentKey = intentKeyForIssue(workPlanId);
  const existingReceipt = journal.receipts[intentKey];
  if (existingReceipt?.key) {
    const issue = await getIssue(existingReceipt.key);
    assert(
      issue.key === existingReceipt.key,
      `receipt ${existingReceipt.key} no pudo verificarse`
    );
    return issue;
  }
  const existing = await findByUniqueLabel(label);
  if (existing) {
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: existing.key,
      id: existing.id,
      self: existing.self,
      recovered: true,
      verified: true,
    });
    return existing;
  }
  const fields = issueFieldsFor(item, workPlanId);
  const intent: JournalIntent = {
    kind: "create_issue",
    intentKey,
    createdAt: new Date().toISOString(),
    payloadFingerprint: payloadFingerprint(fields),
    payload: {
      projectId: TARGET_PROJECT_ID,
      issueTypeId: STAFFING_ISSUE_TYPE_ID,
      labels: fields.labels,
      workPlanId,
    },
    status: "planned",
  };
  saveIntent(journal, intent);
  try {
    const created = await jiraRequest<{
      id: string;
      key: string;
      self?: string;
    }>("/rest/api/3/issue", {
      method: "POST",
      body: JSON.stringify({ fields }),
    });
    assert(created.id && created.key, `POST de ${label} no devolvió id/key`);
    // Receipt is persisted immediately, before any link or DB update.
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: created.key,
      id: created.id,
      self: created.self,
      verified: true,
    });
    return getIssue(created.key);
  } catch (error) {
    journal.intents[intentKey].status = "uncertain";
    saveJournal(journal);
    // A POST timeout/error is not permission to repeat. Prove by unique label or STOP.
    const recovered = await findByUniqueLabel(label);
    if (!recovered)
      throw new StopActivationError(
        `POST ${label} incierto (${asErrorMessage(error)}); no hay artefacto por label, no repetir`
      );
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: recovered.key,
      id: recovered.id,
      self: recovered.self,
      recovered: true,
      verified: true,
    });
    return recovered;
  }
}

function issueHasLink(issue: JiraIssue, milestoneKey: string): boolean {
  return (issue.fields?.issuelinks ?? []).some(
    link =>
      link.inwardIssue?.key === milestoneKey ||
      link.outwardIssue?.key === milestoneKey
  );
}

async function ensureNativeLink(
  journal: Journal,
  task: JiraIssue,
  milestone: JiraIssue,
  linkType: JiraLinkType
): Promise<void> {
  const intentKey = intentKeyForLink(task.key, milestone.key);
  const existingReceipt = journal.receipts[intentKey];
  if (existingReceipt) return;
  const current = await getIssue(task.key);
  if (issueHasLink(current, milestone.key)) {
    saveReceipt(journal, {
      kind: "link_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: task.key,
      verified: true,
    });
    return;
  }
  const payload = {
    type: { name: linkType.name },
    inwardIssue: { key: task.key },
    outwardIssue: { key: milestone.key },
  };
  saveIntent(journal, {
    kind: "link_issue",
    intentKey,
    createdAt: new Date().toISOString(),
    payloadFingerprint: payloadFingerprint(payload),
    payload: {
      taskKey: task.key,
      milestoneKey: milestone.key,
      linkTypeId: linkType.id,
    },
    status: "planned",
  });
  try {
    await jiraRequest("/rest/api/3/issueLink", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // Native-link receipt is persisted immediately after the POST.
    saveReceipt(journal, {
      kind: "link_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: task.key,
      verified: true,
    });
  } catch (error) {
    journal.intents[intentKey].status = "uncertain";
    saveJournal(journal);
    const verified = await getIssue(task.key);
    if (!issueHasLink(verified, milestone.key)) {
      throw new StopActivationError(
        `link ${task.key}->${milestone.key} incierto (${asErrorMessage(error)}); no repetir`
      );
    }
    saveReceipt(journal, {
      kind: "link_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: task.key,
      recovered: true,
      verified: true,
    });
  }
}

async function applyDbCompletion(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  issueKeysByWorkPlanId: Map<number, string>,
  state: Awaited<ReturnType<typeof readDbState>>,
  linkType: JiraLinkType,
  createdIssues: string[]
): Promise<void> {
  await db.transaction(async tx => {
    for (const [workPlanId, jiraIssueKey] of issueKeysByWorkPlanId) {
      await tx
        .update(recurringServiceWorkPlan)
        .set({ jiraIssueKey, status: "pendiente" })
        .where(
          and(
            eq(recurringServiceWorkPlan.id, workPlanId),
            eq(recurringServiceWorkPlan.serviceId, STAFFING4727_SERVICE_ID)
          )
        );
    }

    const existingOperationalMapping = state.mappings.find(
      mapping => mapping.category === "work_plan"
    );
    if (existingOperationalMapping) {
      await tx
        .update(recurringServiceJsmIssueTypeMappings)
        .set({
          issueTypeId: STAFFING_ISSUE_TYPE_ID,
          issueTypeName: STAFFING_ISSUE_TYPE_NAME,
          source: "selected",
          status: "active",
          configuredBy: null,
          configuredByName: "Staffing4727 activation",
        })
        .where(
          and(
            eq(
              recurringServiceJsmIssueTypeMappings.id,
              existingOperationalMapping.id
            ),
            eq(
              recurringServiceJsmIssueTypeMappings.serviceId,
              STAFFING4727_SERVICE_ID
            ),
            eq(recurringServiceJsmIssueTypeMappings.category, "work_plan")
          )
        );
    } else {
      await tx.insert(recurringServiceJsmIssueTypeMappings).values({
        serviceId: STAFFING4727_SERVICE_ID,
        category: "work_plan",
        issueTypeId: STAFFING_ISSUE_TYPE_ID,
        issueTypeName: STAFFING_ISSUE_TYPE_NAME,
        source: "selected",
        status: "active",
        configuredBy: null,
        configuredByName: "Staffing4727 activation",
      });
    }
    await tx
      .update(recurringServiceJsmIssueTypeMappings)
      .set({ status: "superseded" })
      .where(
        and(
          eq(
            recurringServiceJsmIssueTypeMappings.serviceId,
            STAFFING4727_SERVICE_ID
          ),
          eq(recurringServiceJsmIssueTypeMappings.category, "billing")
        )
      );

    const policyReason =
      "Staffing4727: work-plan operacional en CONSALOP02 como Tarea de Staffing 12980, con 24 controles conservados y definiciones SoW; billing external_reference porque seis hitos financieros originales se movieron al destino 12979, sin recrearlos ni alterar cuotas, moneda, estado o evidencia.";
    await tx
      .update(recurringServices)
      .set({
        jsmWorkPlanSyncMode: "create_in_linked_space",
        jsmBillingSyncMode: "external_reference",
        jsmSyncPolicyReason: policyReason,
        jsmSyncPolicyUpdatedAt: new Date(),
        jsmSyncPolicyUpdatedBy: null,
      })
      .where(eq(recurringServices.id, STAFFING4727_SERVICE_ID));

    await tx.insert(auditLogs).values({
      action: "activate_staffing4727_operations",
      entity: "recurring_service",
      entityId: String(STAFFING4727_SERVICE_ID),
      entityName:
        state.service?.serviceName ?? "Deal 4727_Servicio Staffing_Aquitectura",
      userName: "Staffing4727 activation script",
      userRole: "system",
      details: {
        runId: RUN_ID,
        matrixVersion: STAFFING4727_MATRIX_VERSION,
        createdIssues,
        linkedTasks: issueKeysByWorkPlanId.size,
        workPlanSyncMode: "create_in_linked_space",
        billingSyncMode: "external_reference",
        policyReason,
        nativeLinkType: {
          id: linkType.id,
          name: linkType.name,
          inward: linkType.inward,
          outward: linkType.outward,
        },
        preservedExistingControls: [...STAFFING4727_EXISTING_CONTROL_IDS],
        supplementalKeys: [...STAFFING4727_SUPPLEMENTAL_KEYS],
        financialWrites: false,
        billingRowsChanged: false,
        documentsChanged: false,
        reportEvidenceChanged: false,
        financialEvidenceChanged: false,
        stagesClosed: false,
        publicCommentsCreated: false,
        requestParticipantsCreated: false,
      },
    });
  });
}

function validateIssueForWorkPlan(
  issue: JiraIssue,
  item: Staffing4727OperationalItem
): void {
  assert(
    issue.fields?.project?.id === TARGET_PROJECT_ID &&
      issue.fields?.project?.key === TARGET_PROJECT_KEY,
    `issue ${issue.key} no pertenece a ${TARGET_PROJECT_KEY}`
  );
  assert(
    String(issue.fields?.issuetype?.id) === STAFFING_ISSUE_TYPE_ID,
    `issue ${issue.key} no usa issueType ${STAFFING_ISSUE_TYPE_ID}`
  );
  assert(
    issue.fields?.summary === item.title,
    `issue ${issue.key} no coincide con ${item.stableKey}`
  );
  assert(
    (issue.fields?.labels ?? []).includes(SERVICE_LABEL),
    `issue ${issue.key} no tiene ${SERVICE_LABEL}`
  );
  assert(
    (issue.fields?.labels ?? []).includes(`pmo-wp-${item.workPlanId}`),
    `issue ${issue.key} no tiene pmo-wp-${item.workPlanId}`
  );
}

async function verifyJiraAfterApply(
  issueKeysByWorkPlanId: Map<number, string>,
  matrixById: Map<number, Staffing4727OperationalItem>,
  milestones: Map<number, JiraIssue>
): Promise<void> {
  for (const [workPlanId, key] of issueKeysByWorkPlanId) {
    const issue = await getIssue(key);
    const item = matrixById.get(workPlanId);
    assert(item, `no existe matriz para workPlan ${workPlanId}`);
    validateIssueForWorkPlan(issue, item);
    const months = periodNumbers(item.period);
    for (const month of months.length ? months : [item.monthNumber]) {
      const milestone = milestones.get(month);
      assert(milestone, `no existe hito canónico para ${item.period}`);
      assert(issueHasLink(issue, milestone.key), `${key} no quedó enlazado a ${milestone.key}`);
    }
  }
}

function planSummary(
  state: Awaited<ReturnType<typeof readDbState>>,
  matrix: Staffing4727OperationalItem[],
  milestones: Map<number, JiraIssue>,
  linkType: JiraLinkType
): Record<string, unknown> {
  return {
    mode: APPLY ? "apply" : "dry-run",
    runId: RUN_ID,
    serviceId: STAFFING4727_SERVICE_ID,
    destination: {
      projectKey: TARGET_PROJECT_KEY,
      projectId: TARGET_PROJECT_ID,
      serviceDeskId: TARGET_SERVICE_DESK_ID,
      staffingIssueType: {
        id: STAFFING_ISSUE_TYPE_ID,
        name: STAFFING_ISSUE_TYPE_NAME,
      },
      financialIssueTypeId: FINANCIAL_ISSUE_TYPE_ID,
      nativeLinkType: linkType,
    },
    matrixVersion: STAFFING4727_MATRIX_VERSION,
    existingControlsPreserved: state.plan.filter(
      row => row.id >= 420001 && row.id <= 420024
    ).length,
    existingControlIds: [...STAFFING4727_EXISTING_CONTROL_IDS],
    supplementalDefinitions: [...STAFFING4727_SUPPLEMENTAL_KEYS],
    planItems: matrix.length,
    canonicalMilestones: [...milestones.entries()].map(([month, issue]) => ({
      month,
      key: issue.key,
    })),
    billingPreserved: state.billing.map(row => ({
      id: row.id,
      monthNumber: row.monthNumber,
      amount: row.amount,
      currency: row.currency,
      jiraIssueKey: row.jiraIssueKey,
    })),
    financialMode: "external_reference",
    slaRows: state.sla.length,
    noSlaDr247: true,
    noAssigneesInvented: true,
    noPastComplianceCredited: true,
    approvalDueDatesCleared: matrix
      .filter(isApprovalControl)
      .every(item => item.dueDate === null),
    readinessDueDatesNull: matrix
      .filter(item => item.stableKey.startsWith("READINESS-"))
      .every(item => item.dueDate === null),
    commentsOrParticipants: false,
  };
}

async function main(): Promise<void> {
  const db = await getDb();
  assert(db, "Base de datos no disponible");
  const journal = loadJournal();
  const before = await readDbState(db);
  validateDbState(before);
  const backup = saveSelectiveBackup(before);
  const jira = await readJiraPreflight();
  const matrix = buildStaffing4727OperationalPlan();
  const existingRowsById = new Map(before.plan.map(row => [row.id, row]));
  for (const item of matrix.filter(row => row.source === "existing_control")) {
    const row = existingRowsById.get(item.workPlanId!);
    assert(row, `control ${item.workPlanId} no existe en snapshot actual`);
    item.dueDate = isApprovalControl(item) ? null : row.dueDate;
  }
  const summary = planSummary(before, matrix, jira.milestones, jira.linkType);
  writeJsonAtomic(join(JOURNAL_ROOT, `${RUN_ID}-plan.json`), summary);
  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          ...summary,
          backup,
          journal: join(JOURNAL_ROOT, "journal.json"),
          dbWrites: false,
          jiraWrites: false,
        },
        null,
        2
      )
    );
    return;
  }

  const afterPlan = await ensurePlanRows(db, before, matrix);
  const refreshedMatrix = buildStaffing4727OperationalPlan();
  const matrixByTitle = new Map(
    refreshedMatrix.map(item => [item.title, item])
  );
  const matrixById = new Map<number, Staffing4727OperationalItem>();
  for (const row of afterPlan.plan) {
    const item = matrixByTitle.get(row.title);
    if (item) {
      item.workPlanId = row.id;
      item.dueDate = isApprovalControl(item) ? null : row.dueDate;
      matrixById.set(row.id, item);
    }
  }
  const issueKeysByWorkPlanId = new Map<number, string>();
  const createdIssues: string[] = [];
  for (const row of afterPlan.plan) {
    const item = matrixById.get(row.id);
    assert(item, `plan ${row.id} no tiene definición operacional`);
    let issue: JiraIssue;
    if (row.jiraIssueKey) {
      issue = await getIssue(row.jiraIssueKey);
      validateIssueForWorkPlan(issue, item);
    } else {
      issue = await createIssueWithProof(journal, item);
      validateIssueForWorkPlan(issue, item);
      createdIssues.push(issue.key);
    }
    issueKeysByWorkPlanId.set(row.id, issue.key);
    const months = periodNumbers(item.period);
    for (const month of months.length ? months : [item.monthNumber]) {
      const milestone = jira.milestones.get(month);
      assert(milestone, `hito canónico no encontrado para ${item.period}`);
      await ensureNativeLink(journal, issue, milestone, jira.linkType);
    }
  }
  await applyDbCompletion(
    db,
    issueKeysByWorkPlanId,
    afterPlan,
    jira.linkType,
    createdIssues
  );
  const after = await readDbState(db);
  validateDbState(after);
  await verifyJiraAfterApply(
    issueKeysByWorkPlanId,
    matrixById,
    jira.milestones
  );
  const afterHash = sha256(jsonForHash(selectiveBackup(after)));
  writeJsonAtomic(join(JOURNAL_ROOT, `${RUN_ID}-after.json`), {
    completedAt: new Date().toISOString(),
    beforeBackup: backup,
    afterHash,
    issueKeysByWorkPlanId: Object.fromEntries(issueKeysByWorkPlanId),
    createdIssues,
    financialRowsUnchanged:
      after.billing.length === before.billing.length &&
      after.billing.every(
        (row, index) => jsonForHash(row) === jsonForHash(before.billing[index])
      ),
    reportsUnchanged: after.reports.length === before.reports.length,
    financialEvidenceUnchanged:
      after.financialEvidence.length === before.financialEvidence.length,
  });
  console.log(
    JSON.stringify(
      {
        ...summary,
        mode: "applied",
        backup,
        afterHash,
        createdIssues,
        linkedTasks: issueKeysByWorkPlanId.size,
        dbWrites: true,
        jiraWrites: true,
      },
      null,
      2
    )
  );
}

main().then(() => process.exit(0)).catch(error => {
  console.error(
    JSON.stringify(
      {
        mode: APPLY ? "apply" : "dry-run",
        runId: RUN_ID,
        error: asErrorMessage(error),
        stopped: error instanceof StopActivationError,
      },
      null,
      2
    )
  );
  process.exit(1);
});
