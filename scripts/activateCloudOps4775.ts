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
import { and, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  documentArtifacts,
  documentValidationDecisions,
  recurringServiceBillingMonths,
  recurringServiceDocuments,
  recurringServiceFinancialEvidence,
  recurringServiceJsmIssueTypeMappings,
  recurringServicePenalties,
  recurringServiceReportEvidence,
  recurringServiceSlaConfig,
  recurringServiceStages,
  recurringServiceWorkPlan,
  recurringServices,
  users,
} from "../drizzle/schema";
import { getDb } from "../server/db";
import { getJiraRuntimeCredentials, searchJiraIssues } from "../server/jiraClient";
import {
  buildCloudOps4775Plan,
  CLOUDOPS4775_SERVICE_ID,
  CLOUDOPS4775_VERSION,
  type CloudOps4775Item,
} from "../server/cloudOps4775Plan";

/**
 * Activación operacional de CloudOps 4775.
 *
 * El modo predeterminado sólo hace lecturas y deja respaldo/plan local.  --apply
 * es el único modo que puede hacer POST en Jira o escribir las tablas PMO.  La
 * transacción PMO se ejecuta al final, después de que cada issue y cada enlace
 * nativo tengan receipt en el journal.
 *
 * No se crean solicitudes JSM: los issues se crean exclusivamente mediante
 * /rest/api/3/issue, sin customerRequestType, participantes, organización ni
 * assignee. Las seis cuotas y todos los datos documentales se verifican como
 * snapshot y nunca se actualizan.
 */

const SERVICE_ID = CLOUDOPS4775_SERVICE_ID;
const DEAL_ID = "4775" as const;
const SERVICE_TYPE = "staffing" as const;
const TARGET_PROJECT_KEY = "CONSALOP03" as const;
const TARGET_PROJECT_ID = "13149" as const;
const TARGET_SERVICE_DESK_ID = "434" as const;
const CLOUDOPS_ISSUE_TYPE_ID = "12981" as const;
const CLOUDOPS_ISSUE_TYPE_NAME = "Tarea de CloudOps" as const;
const BILLING_ISSUE_TYPE_ID = "12982" as const;
const BILLING_ISSUE_TYPE_NAME = "Hito de Facturación CloudOps" as const;
const SERVICE_LABEL = "pmo-service-3300001" as const;
const DB_WORK_PLAN_CATEGORY = "work_plan" as const;
const DB_BILLING_CATEGORY = "billing" as const;
// Nombres contractuales de las dos categorías solicitadas; la tabla vigente
// persiste sus equivalentes físicos work_plan/billing.
const OPERATIONAL_CATEGORY = "evento_programado" as const;
const BILLING_CATEGORY = "hito_facturacion" as const;
const JOURNAL_ROOT =
  "/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775-operations";
const BACKUP_FILE = join(JOURNAL_ROOT, "pmo-before.json");
const APPLY = process.argv.includes("--apply");
const RUN_ID =
  process.env.CLOUDOPS4775_RUN_ID ??
  `cloudops4775-${new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 17)}`;
const PERIODS = [1, 2, 3, 4, 5, 6] as const;
const EXISTING_WORK_PLAN_IDS = [
  510001, 510002, 510003, 510004, 510005, 510006,
] as const;
const EXPECTED_PLAN_ITEMS = 34;
const EXPECTED_NEW_ITEMS = 28;
const EXPECTED_BILLING = 6;
const EXPECTED_MONTHLY_ITEMS_PER_MONTH = 4;
const EXPECTED_CADENCE_ITEMS = 2;
let auditActor: { id: number; name: string; role: "admin" } | undefined;

class StopActivationError extends Error {
  constructor(message: string) {
    super(`STOP: ${message}`);
    this.name = "StopActivationError";
  }
}

type JiraIssueLink = {
  id?: string;
  type?: { id?: string; name?: string; inward?: string; outward?: string };
  inwardIssue?: { key?: string };
  outwardIssue?: { key?: string };
};

type JiraIssue = {
  id: string;
  key: string;
  self?: string;
  fields?: Record<string, any> & {
    project?: { id?: string; key?: string };
    issuetype?: { id?: string; name?: string };
    summary?: string;
    description?: unknown;
    labels?: string[];
    status?: {
      name?: string;
      statusCategory?: { key?: string; name?: string };
    };
    duedate?: string | null;
    assignee?: unknown;
    issuelinks?: JiraIssueLink[];
    customfield_10010?: unknown;
  };
};

type JiraSearchResponse = {
  issues?: JiraIssue[];
  total?: number;
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

type JournalPlanItem = {
  code: string;
  title: string;
  description: string;
  itemType: CloudOps4775Item["itemType"];
  frequency: CloudOps4775Item["frequency"];
  monthNumber: number | null;
  dueDate: null;
  kind: CloudOps4775Item["kind"];
  workPlanId?: number;
  jiraIssueKey?: string;
};

type Journal = {
  version: 1;
  runId: string;
  serviceId: number;
  matrixVersion: string;
  createdAt: string;
  updatedAt: string;
  status: "open" | "completed";
  beforeBackupSha256?: string;
  planFingerprint?: string;
  plan?: JournalPlanItem[];
  intents: Record<string, JournalIntent>;
  receipts: Record<string, JournalReceipt>;
  completedAt?: string;
};

type PlanRow = typeof recurringServiceWorkPlan.$inferSelect;
type DbLike = NonNullable<Awaited<ReturnType<typeof getDb>>>;

// Drizzle's transaction object has the same read surface as the root DB but a
// distinct generic type. Keeping the narrow persistence helper untyped at this
// boundary avoids widening the schema imports or using unsafe SQL elsewhere.
type ReadDb = {
  select: (...args: any[]) => any;
};

type DbState = {
  service: typeof recurringServices.$inferSelect | undefined;
  plan: PlanRow[];
  billing: (typeof recurringServiceBillingMonths.$inferSelect)[];
  mappings: (typeof recurringServiceJsmIssueTypeMappings.$inferSelect)[];
  sla: (typeof recurringServiceSlaConfig.$inferSelect)[];
  stages: (typeof recurringServiceStages.$inferSelect)[];
  documents: (typeof recurringServiceDocuments.$inferSelect)[];
  reports: (typeof recurringServiceReportEvidence.$inferSelect)[];
  financialEvidence: (typeof recurringServiceFinancialEvidence.$inferSelect)[];
  penalties: (typeof recurringServicePenalties.$inferSelect)[];
  artifacts: (typeof documentArtifacts.$inferSelect)[];
  validationDecisions: (typeof documentValidationDecisions.$inferSelect)[];
};

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function jsonForHash(value: unknown): string {
  return JSON.stringify(value, (_key, nested) => {
    if (nested instanceof Date) return nested.toISOString();
    return nested;
  });
}

function snapshotHash(value: unknown): string {
  return sha256(jsonForHash(value));
}

function writeJsonAtomic(path: string, value: unknown): void {
  mkdirSync(JOURNAL_ROOT, { recursive: true, mode: 0o700 });
  chmodSync(JOURNAL_ROOT, 0o700);
  const temporary = `${path}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
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
    { mode: 0o600 }
  );
}

function loadJournal(): Journal {
  const path = join(JOURNAL_ROOT, "journal.json");
  if (!existsSync(path)) {
    return {
      version: 1,
      runId: RUN_ID,
      serviceId: SERVICE_ID,
      matrixVersion: CLOUDOPS4775_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: "open",
      intents: {},
      receipts: {},
    };
  }
  assert(
    existsSync(`${path}.sha256`),
    "journal.json existe sin su checksum; no sobrescribirlo"
  );
  const digest = sha256(readFileSync(path));
  const expected = readFileSync(`${path}.sha256`, "utf8").split(/\s+/)[0];
  assert(digest === expected, "checksum de journal.json no coincide");
  const journal = JSON.parse(readFileSync(path, "utf8")) as Journal;
  assert(
    journal.version === 1 &&
      journal.serviceId === SERVICE_ID &&
      journal.matrixVersion === CLOUDOPS4775_VERSION,
    "journal existente incompatible con CloudOps 4775; no sobrescribirlo"
  );
  assert(
    journal.status === "open" || journal.status === "completed",
    "estado de journal inválido"
  );
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
    // Nunca imprimir body, credenciales o respuesta de Jira: un POST fallido es incierto.
    throw new Error(
      `Jira ${init.method ?? "GET"} ${path.split("?")[0]} respondió HTTP ${response.status}`
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

async function jiraSearch(jql: string, fields: string[]): Promise<JiraIssue[]> {
  const result = await searchJiraIssues(jql, { maxResults: 100, fields });
  assert(!result.nextPageToken, "Búsqueda exacta de control excede 100; no crear con lectura parcial");
  return result.issues as unknown as JiraIssue[];
}

async function getIssue(key: string): Promise<JiraIssue> {
  return jiraGet<JiraIssue>(
    `/rest/api/3/issue/${encodeURIComponent(key)}?fields=*all`
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

function textFromAdf(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const node = value as { text?: unknown; content?: unknown };
  if (typeof node.text === "string") return node.text;
  if (!Array.isArray(node.content)) return "";
  const pieces: string[] = [];
  for (const child of node.content) {
    const childText = textFromAdf(child);
    if (child && typeof child === "object" && (child as { type?: string }).type === "paragraph") {
      pieces.push(childText);
    } else {
      pieces.push(childText);
    }
  }
  return pieces.join("\n");
}

function issueFieldsFor(item: CloudOps4775Item): Record<string, unknown> {
  // Deliberadamente no se envían assignee, customerRequestType, participantes,
  // organización, request type ni duedate. El issue debe permanecer interno y
  // sin fecha de cumplimiento acreditada.
  return {
    project: { id: TARGET_PROJECT_ID },
    issuetype: { id: CLOUDOPS_ISSUE_TYPE_ID },
    summary: item.title,
    description: adfDescription(item.description),
    labels: [SERVICE_LABEL, `cloudops-4775-${item.code}`],
  };
}

function codeLabel(item: CloudOps4775Item): string {
  return `cloudops-4775-${item.code}`;
}

function issueIntentKey(item: CloudOps4775Item): string {
  return `issue:${codeLabel(item)}`;
}

function linkIntentKey(taskKey: string, milestoneKey: string): string {
  return `link:${taskKey}:${milestoneKey}`;
}

function payloadFingerprint(payload: Record<string, unknown>): string {
  return sha256(jsonForHash(payload));
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

function isEmptyJiraValue(value: unknown): boolean {
  return (
    value == null ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === "object" &&
      value !== null &&
      Object.keys(value as Record<string, unknown>).length === 0)
  );
}

function forbiddenFieldKind(key: string):
  | "customerRequestType"
  | "participants"
  | "organization"
  | "assignee"
  | null {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized === "assignee") return "assignee";
  if (
    normalized === "customerrequesttype" ||
    normalized.includes("customerrequesttype")
  ) {
    return "customerRequestType";
  }
  if (normalized.includes("participant")) return "participants";
  if (normalized === "organization" || normalized === "organizations") {
    return "organization";
  }
  return null;
}

function validateInternalIssue(
  issue: JiraIssue,
  item: CloudOps4775Item
): void {
  assert(issue.id, `issue ${issue.key} no tiene id GET verificable`);
  assert(
    issue.fields?.project?.id === TARGET_PROJECT_ID &&
      issue.fields?.project?.key === TARGET_PROJECT_KEY,
    `issue ${issue.key} no pertenece a ${TARGET_PROJECT_KEY}/${TARGET_PROJECT_ID}`
  );
  assert(
    String(issue.fields?.issuetype?.id) === CLOUDOPS_ISSUE_TYPE_ID &&
      issue.fields?.issuetype?.name === CLOUDOPS_ISSUE_TYPE_NAME,
    `issue ${issue.key} no usa ${CLOUDOPS_ISSUE_TYPE_ID} ${CLOUDOPS_ISSUE_TYPE_NAME}`
  );
  assert(
    issue.fields?.summary === item.title,
    `issue ${issue.key} no coincide con summary de ${item.code}`
  );
  assert(
    textFromAdf(issue.fields?.description) === item.description,
    `issue ${issue.key} no coincide con description de ${item.code}`
  );
  const labels = issue.fields?.labels ?? [];
  assert(labels.includes(SERVICE_LABEL), `issue ${issue.key} no tiene ${SERVICE_LABEL}`);
  assert(labels.includes(codeLabel(item)), `issue ${issue.key} no tiene ${codeLabel(item)}`);
  assert(
    issue.fields?.duedate == null,
    `issue ${issue.key} tiene dueDate; todas deben permanecer null`
  );
  const statusCategory = String(
    issue.fields?.status?.statusCategory?.key ?? ""
  ).toLowerCase();
  assert(statusCategory === "new", `issue ${issue.key} no quedó en status new`);

  for (const [key, value] of Object.entries(issue.fields ?? {})) {
    const kind = forbiddenFieldKind(key);
    if (!kind) continue;
    assert(
      isEmptyJiraValue(value),
      `issue ${issue.key} contiene ${kind}; debe ser nulo/vacío para issue interno`
    );
  }
  // Jira Cloud suele exponer request type como customfield_10010. La ausencia
  // del campo equivale a null cuando fields=*all no lo materializa.
  assert(
    issue.fields?.customfield_10010 == null,
    `issue ${issue.key} tiene customerRequestType no nulo`
  );
}

function issueHasLink(issue: JiraIssue, milestoneKey: string): boolean {
  return (issue.fields?.issuelinks ?? []).some(
    link =>
      link.inwardIssue?.key === milestoneKey ||
      link.outwardIssue?.key === milestoneKey
  );
}

async function findByUniqueLabel(label: string): Promise<JiraIssue | null> {
  const issues = await jiraSearch(
    `project = ${TARGET_PROJECT_KEY} AND labels = "${label}"`,
    ["summary", "labels", "project", "issuetype", "status", "duedate", "issuelinks"]
  );
  if (issues.length > 1) {
    throw new StopActivationError(
      `label ${label} tiene ${issues.length} issues; no elegir uno`
    );
  }
  return issues[0] ?? null;
}

async function createIssueWithProof(
  journal: Journal,
  item: CloudOps4775Item
): Promise<{ issue: JiraIssue; created: boolean }> {
  const label = codeLabel(item);
  const intentKey = issueIntentKey(item);
  const existingReceipt = journal.receipts[intentKey];
  if (existingReceipt?.key) {
    const issue = await getIssue(existingReceipt.key);
    validateInternalIssue(issue, item);
    return { issue, created: false };
  }

  const priorIntent = journal.intents[intentKey];
  const existing = await findByUniqueLabel(label);
  if (existing) {
    const issue = await getIssue(existing.key);
    validateInternalIssue(issue, item);
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: issue.key,
      id: issue.id,
      self: issue.self,
      recovered: true,
      verified: true,
    });
    return { issue, created: false };
  }

  // Un intent previo sin artefacto probado es una barrera absoluta: no hacer
  // un POST nuevo, incluso si la ejecución anterior quedó a mitad de camino.
  if (priorIntent) {
    throw new StopActivationError(
      `intent ${intentKey} (${priorIntent.status}) no tiene artefacto por label; no repetir POST`
    );
  }

  const fields = issueFieldsFor(item);
  saveIntent(journal, {
    kind: "create_issue",
    intentKey,
    createdAt: new Date().toISOString(),
    payloadFingerprint: payloadFingerprint(fields),
    payload: {
      code: item.code,
      projectId: TARGET_PROJECT_ID,
      issueTypeId: CLOUDOPS_ISSUE_TYPE_ID,
      labels: fields.labels,
      dueDate: null,
      internalIssue: true,
      customerRequestType: null,
      participants: null,
      organization: null,
      assignee: null,
    },
    status: "planned",
  });

  try {
    const created = await jiraRequest<{ id: string; key: string; self?: string }>(
      "/rest/api/3/issue",
      {
        method: "POST",
        body: JSON.stringify({ fields }),
      }
    );
    assert(created.id && created.key, `POST de ${label} no devolvió id/key`);
    // Receipt inmediatamente después del POST y antes de cualquier GET/link.
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: created.key,
      id: created.id,
      self: created.self,
      verified: true,
    });
    const issue = await getIssue(created.key);
    validateInternalIssue(issue, item);
    return { issue, created: true };
  } catch (error) {
    const currentIntent = journal.intents[intentKey];
    if (currentIntent) currentIntent.status = "uncertain";
    saveJournal(journal);
    // Un POST incierto sólo se recupera por GET de la label única; nunca se repite.
    const recovered = await findByUniqueLabel(label);
    if (!recovered) {
      throw new StopActivationError(
        `POST ${label} incierto (${asErrorMessage(error)}); no hay artefacto por label, no repetir`
      );
    }
    const issue = await getIssue(recovered.key);
    validateInternalIssue(issue, item);
    saveReceipt(journal, {
      kind: "create_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: issue.key,
      id: issue.id,
      self: issue.self,
      recovered: true,
      verified: true,
    });
    return { issue, created: false };
  }
}

async function ensureNativeLink(
  journal: Journal,
  task: JiraIssue,
  milestone: JiraIssue,
  linkType: JiraLinkType
): Promise<void> {
  const intentKey = linkIntentKey(task.key, milestone.key);
  const existingReceipt = journal.receipts[intentKey];
  const current = await getIssue(task.key);
  assert(current.id, `GET de ${task.key} no devolvió id`);
  if (existingReceipt) {
    assert(
      issueHasLink(current, milestone.key),
      `receipt ${intentKey} existe pero GET no demuestra el enlace`
    );
    return;
  }
  const priorIntent = journal.intents[intentKey];
  const target = await getIssue(milestone.key);
  assert(
    target.fields?.project?.id === TARGET_PROJECT_ID &&
      target.fields?.project?.key === TARGET_PROJECT_KEY,
    `hito ${milestone.key} no pertenece al destino; no enlazar`
  );
  assert(
    String(target.fields?.issuetype?.id) === BILLING_ISSUE_TYPE_ID,
    `hito ${milestone.key} no es ${BILLING_ISSUE_TYPE_ID}`
  );
  if (issueHasLink(current, milestone.key)) {
    saveReceipt(journal, {
      kind: "link_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: task.key,
      recovered: true,
      verified: true,
    });
    return;
  }
  if (priorIntent) {
    throw new StopActivationError(
      `intent ${intentKey} (${priorIntent.status}) no tiene enlace verificable; no repetir POST`
    );
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
      linkTypeName: linkType.name,
    },
    status: "planned",
  });
  try {
    await
    await jiraRequest("/rest/api/3/issueLink", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    // Receipt inmediatamente después del POST del enlace.
    saveReceipt(journal, {
      kind: "link_issue",
      intentKey,
      recordedAt: new Date().toISOString(),
      key: task.key,
      verified: true,
    });
  } catch (error) {
    const intent = journal.intents[intentKey];
    if (intent) intent.status = "uncertain";
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

async function readDbState(db: ReadDb): Promise<DbState> {
  const [
    services,
    plan,
    billing,
    mappings,
    sla,
    stages,
    documents,
    reports,
    financialEvidence,
    penalties,
    artifacts,
    validationDecisions,
  ] = await Promise.all([
    db.select().from(recurringServices).where(eq(recurringServices.id, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceWorkPlan)
      .where(eq(recurringServiceWorkPlan.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceBillingMonths)
      .where(eq(recurringServiceBillingMonths.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceJsmIssueTypeMappings)
      .where(eq(recurringServiceJsmIssueTypeMappings.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceSlaConfig)
      .where(eq(recurringServiceSlaConfig.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceStages)
      .where(eq(recurringServiceStages.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceDocuments)
      .where(eq(recurringServiceDocuments.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceReportEvidence)
      .where(eq(recurringServiceReportEvidence.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServiceFinancialEvidence)
      .where(eq(recurringServiceFinancialEvidence.serviceId, SERVICE_ID)),
    db
      .select()
      .from(recurringServicePenalties)
      .where(eq(recurringServicePenalties.serviceId, SERVICE_ID)),
    db
      .select()
      .from(documentArtifacts)
      .where(
        and(
          eq(documentArtifacts.entityType, "recurring_service"),
          eq(documentArtifacts.entityId, SERVICE_ID)
        )
      ),
    db
      .select()
      .from(documentValidationDecisions)
      .where(
        and(
          eq(documentValidationDecisions.entityType, "recurring_service"),
          eq(documentValidationDecisions.entityId, SERVICE_ID)
        )
      ),
  ]);
  return {
    service: services[0],
    plan,
    billing,
    mappings,
    sla,
    stages,
    documents,
    reports,
    financialEvidence,
    penalties,
    artifacts,
    validationDecisions,
  };
}

function immutableSnapshot(state: DbState): Record<string, unknown> {
  return {
    service: state.service,
    billing: state.billing,
    mappings: state.mappings,
    sla: state.sla,
    stages: state.stages,
    documents: state.documents,
    reports: state.reports,
    financialEvidence: state.financialEvidence,
    penalties: state.penalties,
    artifacts: state.artifacts,
    validationDecisions: state.validationDecisions,
    // The pre-transaction plan is immutable too: Jira calls happen outside the
    // DB transaction and must never silently race another PMO plan change.
    plan: state.plan,
  };
}

function validateDbState(state: DbState): void {
  const service = state.service;
  assert(service, `servicio ${SERVICE_ID} no existe`);
  assert(
    service.dealId === DEAL_ID &&
      service.serviceType === SERVICE_TYPE &&
      service.status === "activo" &&
      service.currentStage === "ejecucion",
    "identidad Deal4775/staffing/activo/ejecucion no coincide"
  );
  assert(
    service.jsmProjectKey === TARGET_PROJECT_KEY &&
      service.jsmProjectId === TARGET_PROJECT_ID &&
      service.jsmServiceDeskId === TARGET_SERVICE_DESK_ID,
    "el servicio no está vinculado a CONSALOP03/13149/desk434"
  );
  assert(
    state.billing.length === EXPECTED_BILLING,
    "no hay exactamente seis cuotas existentes; no tocar facturación"
  );
  assert(
    state.billing.every(
      row => row.currency === "UF" && Number(row.amount) === 160
    ),
    "las cuotas existentes no son seis UF160; no tocar facturación"
  );
  assert(
    state.billing.reduce((sum, row) => sum + Number(row.amount), 0) === 960,
    "el total de cuotas no es UF960; no tocar facturación"
  );
  const billingMonths = new Set(state.billing.map(row => row.monthNumber));
  assert(
    PERIODS.every(month => billingMonths.has(month)),
    "las cuotas no cubren exactamente M01-M06"
  );
  assert(
    state.sla.length === 0,
    "se detectó configuración SLA; CloudOps no agrega SLA/DR/24x7"
  );
  assert(
    state.stages.length > 0,
    "no se encontró snapshot de stages para preservar"
  );
}

function validateInitialOrCompletedPlan(state: DbState): void {
  const byId = new Map(state.plan.map(row => [row.id, row]));
  if (state.plan.length === 6) {
    assert(
      EXISTING_WORK_PLAN_IDS.every(id => byId.has(id)),
      "las seis filas iniciales no son exactamente 510001-510006"
    );
    assert(
      state.plan.every(row => row.jiraIssueKey == null),
      "las seis filas iniciales ya tienen vínculo Jira; no reconstruir"
    );
    assert(
      new Set(state.plan.map(row => row.monthNumber)).size === 6 &&
        PERIODS.every(month => state.plan.some(row => row.monthNumber === month)),
      "las seis filas iniciales no son una por cuota M01-M06"
    );
    assert(
      state.plan.every(row => row.status === "pendiente" && row.dueDate == null),
      "las seis filas iniciales no están pendientes y sin dueDate"
    );
    return;
  }
  assert(
    state.plan.length === EXPECTED_PLAN_ITEMS,
    `el plan debe tener seis filas iniciales o 34 finales, no ${state.plan.length}`
  );
  assert(
    EXISTING_WORK_PLAN_IDS.every(id => byId.has(id)),
    "las seis filas reutilizables ya no están presentes"
  );
  assert(
    state.plan.every(row => row.status === "pendiente" && row.dueDate == null),
    "plan final no está completamente pendiente y sin fechas"
  );
  assert(
    state.plan.every(row => row.jiraIssueKey),
    "plan final tiene tareas sin vínculo Jira"
  );
}

function selectiveBackup(state: DbState): Record<string, unknown> {
  return {
    capturedAt: new Date().toISOString(),
    service: state.service,
    workPlan: state.plan,
    billing: state.billing,
    mappings: state.mappings,
    sla: state.sla,
    stages: state.stages,
    documents: state.documents,
    reports: state.reports,
    financialEvidence: state.financialEvidence,
    penalties: state.penalties,
    artifacts: state.artifacts,
    validationDecisions: state.validationDecisions,
    preservation: {
      billingRows: state.billing.length,
      billingAmounts: state.billing.map(row => ({
        id: row.id,
        monthNumber: row.monthNumber,
        amount: row.amount,
        currency: row.currency,
        dueDate: row.dueDate,
        status: row.status,
        jiraIssueKey: row.jiraIssueKey,
      })),
      stagesHash: snapshotHash(state.stages),
      documentsHash: snapshotHash(state.documents),
      reportsHash: snapshotHash(state.reports),
      financialEvidenceHash: snapshotHash(state.financialEvidence),
      artifactsHash: snapshotHash(state.artifacts),
      validationDecisionsHash: snapshotHash(state.validationDecisions),
    },
  };
}

function saveSelectiveBackup(state: DbState): {
  path: string;
  sha256: string;
} {
  const path = BACKUP_FILE;
  if (existsSync(path)) {
    assert(existsSync(`${path}.sha256`), "pmo-before.json existe sin checksum");
    const digest = sha256(readFileSync(path));
    const expected = readFileSync(`${path}.sha256`, "utf8").split(/\s+/)[0];
    assert(digest === expected, "checksum de pmo-before.json no coincide");
    const original = JSON.parse(readFileSync(path, "utf8")) as {
      service?: { id?: number; dealId?: string };
    };
    assert(
      original.service?.id === SERVICE_ID && original.service?.dealId === DEAL_ID,
      "pmo-before.json pertenece a otro servicio"
    );
    return { path, sha256: digest };
  }
  writeJsonAtomic(path, selectiveBackup(state));
  const digest = sha256(readFileSync(path));
  writeFileSync(`${path}.sha256`, `${digest}  pmo-before.json\n`, {
    mode: 0o600,
  });
  return { path, sha256: digest };
}

function loadBackupHash(): string {
  assert(existsSync(BACKUP_FILE), "falta pmo-before.json; ejecutar dry-run primero");
  assert(existsSync(`${BACKUP_FILE}.sha256`), "falta checksum de pmo-before.json");
  const digest = sha256(readFileSync(BACKUP_FILE));
  const expected = readFileSync(`${BACKUP_FILE}.sha256`, "utf8").split(/\s+/)[0];
  assert(digest === expected, "checksum de respaldo inicial no coincide");
  return digest;
}

function syntheticBuildRows(state: DbState): Array<{
  id: number;
  monthNumber: number | null;
  jiraIssueKey: string | null;
}> {
  return PERIODS.map(month => {
    const row = state.plan.find(
      candidate => candidate.id === EXISTING_WORK_PLAN_IDS[month - 1]
    );
    assert(row, `falta fila worklog reutilizable ${EXISTING_WORK_PLAN_IDS[month - 1]}`);
    return {
      id: row.id,
      monthNumber: row.monthNumber,
      jiraIssueKey: row.jiraIssueKey,
    };
  });
}

function buildMatrix(state: DbState): CloudOps4775Item[] {
  const matrix = buildCloudOps4775Plan(syntheticBuildRows(state));
  assert(matrix.length === EXPECTED_PLAN_ITEMS, "la matriz CloudOps no tiene 34 tareas");
  assert(
    matrix.filter(item => item.kind === "monthly").length === 24,
    "la matriz no tiene 24 tareas mensuales"
  );
  assert(
    matrix.filter(item => item.kind === "cadence").length === EXPECTED_CADENCE_ITEMS,
    "la matriz no tiene dos definiciones quincenales"
  );
  assert(
    matrix.filter(item => item.kind === "initial").length === 5,
    "la matriz no tiene cinco prerrequisitos de inicio"
  );
  assert(
    matrix.filter(item => item.kind === "conditional").length === 3,
    "la matriz no tiene tres protocolos condicionados"
  );
  assert(matrix.every(item => item.dueDate == null), "la matriz contiene fechas no nulas");
  return matrix;
}

function rowForItem(
  state: DbState,
  item: CloudOps4775Item
): PlanRow | undefined {
  if (item.reuseId != null) {
    return state.plan.find(row => row.id === item.reuseId);
  }
  const matches = state.plan.filter(row => row.title === item.title);
  assert(matches.length <= 1, `tarea ${item.code} está duplicada en PMO`);
  return matches[0];
}

function itemRows(
  state: DbState,
  matrix: CloudOps4775Item[]
): Map<string, PlanRow> {
  const result = new Map<string, PlanRow>();
  for (const item of matrix) {
    const row = rowForItem(state, item);
    if (row) result.set(item.code, row);
  }
  return result;
}

async function readJiraPreflight(
  state: DbState
): Promise<{
  linkType: JiraLinkType;
  milestones: Map<number, JiraIssue>;
}> {
  const project = await jiraGet<{ id?: string; key?: string; projectTypeKey?: string }>(
    `/rest/api/3/project/${TARGET_PROJECT_ID}`
  );
  assert(
    String(project.id) === TARGET_PROJECT_ID && project.key === TARGET_PROJECT_KEY,
    "el proyecto destino no coincide con 13149/CONSALOP03"
  );

  const issueType = await jiraGet<{ id?: string; name?: string }>(
    `/rest/api/3/issuetype/${CLOUDOPS_ISSUE_TYPE_ID}`
  );
  assert(
    String(issueType.id) === CLOUDOPS_ISSUE_TYPE_ID &&
      issueType.name === CLOUDOPS_ISSUE_TYPE_NAME,
    `issue type ${CLOUDOPS_ISSUE_TYPE_ID} no es ${CLOUDOPS_ISSUE_TYPE_NAME}`
  );
  const billingType = await jiraGet<{ id?: string; name?: string }>(
    `/rest/api/3/issuetype/${BILLING_ISSUE_TYPE_ID}`
  );
  assert(
    String(billingType.id) === BILLING_ISSUE_TYPE_ID &&
      billingType.name === BILLING_ISSUE_TYPE_NAME,
    `issue type ${BILLING_ISSUE_TYPE_ID} no es ${BILLING_ISSUE_TYPE_NAME}`
  );
  const createMeta = await jiraGet<Record<string, unknown>>(
    `/rest/api/3/issue/createmeta/${TARGET_PROJECT_ID}/issuetypes/${CLOUDOPS_ISSUE_TYPE_ID}`
  );
  const rawFields = createMeta.fields;
  const fieldKeys = new Set<string>(
    Array.isArray(rawFields)
      ? (rawFields as Array<{ key?: string; fieldId?: string }>).flatMap(field =>
          [field.key, field.fieldId].filter((value): value is string => Boolean(value))
        )
      : Object.entries((rawFields ?? {}) as Record<string, unknown>).flatMap(
          ([key, value]) => {
            const fieldId =
              typeof value === "object" && value !== null && "fieldId" in value
                ? String((value as { fieldId?: unknown }).fieldId ?? "")
                : "";
            return [key, fieldId].filter(Boolean);
          }
        )
  );
  assert(
    ["summary", "description", "labels"].every(key => fieldKeys.has(key)),
    "Tarea de CloudOps no expone summary/description/labels en createmeta"
  );
  const desk = await jiraGet<{ id?: string; projectId?: string }>(
    `/rest/servicedeskapi/servicedesk/${TARGET_SERVICE_DESK_ID}`
  );
  assert(
    String(desk.id) === TARGET_SERVICE_DESK_ID &&
      String(desk.projectId) === TARGET_PROJECT_ID,
    "service desk 434 no corresponde al proyecto CONSALOP03"
  );

  // Cutover gate: el parent debe haber movido los seis hitos antes de crear
  // cualquier issue. Se obtienen únicamente desde las seis billing keys PMO.
  assert(
    state.billing.every(row => row.jiraIssueKey),
    "billingKeys CONSALOP03 aún no están presentes; no crear tareas ni enlaces"
  );
  const milestones = new Map<number, JiraIssue>();
  for (const row of [...state.billing].sort((a, b) => a.monthNumber - b.monthNumber)) {
    assert(row.jiraIssueKey, `cuota M0${row.monthNumber} no tiene billingKey`);
    const issue = await getIssue(row.jiraIssueKey);
    assert(
      issue.fields?.project?.id === TARGET_PROJECT_ID &&
        issue.fields?.project?.key === TARGET_PROJECT_KEY,
      `hito ${issue.key} aún no está en ${TARGET_PROJECT_KEY}; esperar cutover parent`
    );
    assert(
      String(issue.fields?.issuetype?.id) === BILLING_ISSUE_TYPE_ID,
      `hito ${issue.key} no usa issue type ${BILLING_ISSUE_TYPE_ID}`
    );
    assert(!milestones.has(row.monthNumber), `billingKey duplicado para M0${row.monthNumber}`);
    milestones.set(row.monthNumber, issue);
  }
  assert(milestones.size === EXPECTED_BILLING, "no se verificaron seis hitos financieros destino");

  const issueLinkTypes = await jiraGet<{ issueLinkTypes?: JiraLinkType[] }>(
    "/rest/api/3/issueLinkType"
  );
  const relates = (issueLinkTypes.issueLinkTypes ?? []).filter(linkType => {
    const values = [linkType.name, linkType.inward, linkType.outward].map(value =>
      String(value ?? "").trim().toLowerCase()
    );
    return values.includes("relates") || values.includes("relates to") || values.includes("se relaciona con");
  });
  assert(
    relates.length === 1,
    `no se puede resolver unívocamente Relates (${relates.length} candidatos)`
  );
  return { linkType: relates[0], milestones };
}

function validateExistingIssueForRow(
  issue: JiraIssue,
  row: PlanRow,
  item: CloudOps4775Item
): void {
  validateInternalIssue(issue, item);
  assert(
    row.jiraIssueKey === issue.key,
    `PMO ${row.id} no conserva jiraIssueKey ${issue.key}`
  );
}

function planCodeForRow(
  row: PlanRow,
  matrix: CloudOps4775Item[]
): CloudOps4775Item | undefined {
  return matrix.find(item => {
    if (item.reuseId === row.id) return true;
    return row.title === item.title;
  });
}

function verifyPlanShape(
  state: DbState,
  matrix: CloudOps4775Item[]
): Map<string, PlanRow> {
  assert(state.plan.length === EXPECTED_PLAN_ITEMS, "persistencia no dejó 34 filas");
  const rows = itemRows(state, matrix);
  assert(rows.size === EXPECTED_PLAN_ITEMS, "no todas las tareas tienen fila PMO única");
  const ids = new Set<number>();
  for (const item of matrix) {
    const row = rows.get(item.code);
    assert(row, `falta fila para ${item.code}`);
    assert(!ids.has(row.id), `fila PMO ${row.id} fue reutilizada por dos tareas`);
    ids.add(row.id);
    assert(row.status === "pendiente", `${item.code} no está pendiente`);
    assert(row.dueDate == null, `${item.code} tiene dueDate no nulo`);
    assert(row.jiraIssueKey, `${item.code} no tiene jiraIssueKey persistida`);
    assert(row.serviceId === SERVICE_ID, `${item.code} pertenece a otro servicio`);
    assert(row.itemType === item.itemType, `${item.code} tiene itemType divergente`);
    assert(row.title === item.title, `${item.code} tiene title divergente`);
    assert(row.description === item.description, `${item.code} tiene description divergente`);
    assert(row.frequency === item.frequency, `${item.code} tiene frequency divergente`);
    assert(row.monthNumber === item.monthNumber, `${item.code} tiene monthNumber divergente`);
  }
  return rows;
}

async function persistFinalDb(
  db: DbLike,
  before: DbState,
  matrix: CloudOps4775Item[],
  issueKeysByCode: Map<string, string>,
  backupSha256: string,
  nativeLinkType: JiraLinkType
): Promise<Map<string, number>> {
  const resultingIds = new Map<string, number>();
  assert(auditActor, "Actor PMO no verificado");
  await db.transaction(async tx => {
    // Locks explícitos: servicio, plan, cuotas, mappings y stages quedan
    // congelados mientras se comprueba el snapshot y se escribe una sola vez.
    await tx.execute(sql`SELECT id FROM recurring_services WHERE id = ${SERVICE_ID} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM recurring_service_work_plan WHERE serviceId = ${SERVICE_ID} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM recurring_service_billing_months WHERE serviceId = ${SERVICE_ID} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM recurring_service_jsm_issue_type_mappings WHERE serviceId = ${SERVICE_ID} FOR UPDATE`);
    await tx.execute(sql`SELECT id FROM recurring_service_stages WHERE serviceId = ${SERVICE_ID} FOR UPDATE`);
    const fresh = await readDbState(tx as unknown as ReadDb);
    validateDbState(fresh);
    assert(
      snapshotHash(immutableSnapshot(fresh)) === snapshotHash(immutableSnapshot(before)),
      "snapshot DB cambió antes de la transacción final; no escribir"
    );
    assert(
      fresh.plan.length === 6 || fresh.plan.length === EXPECTED_PLAN_ITEMS,
      "plan cambió a una cardinalidad no autorizada"
    );
    const currentRows = itemRows(fresh, matrix);
    for (const item of matrix) {
      const issueKey = issueKeysByCode.get(item.code);
      assert(issueKey, `falta issue Jira para ${item.code}`);
      const existing = currentRows.get(item.code);
      const values = {
        serviceId: SERVICE_ID,
        itemType: item.itemType,
        title: item.title,
        description: item.description,
        frequency: item.frequency,
        dueDate: null,
        monthNumber: item.monthNumber,
        status: "pendiente" as const,
        jiraIssueKey: issueKey,
        sortOrder: matrix.indexOf(item) + 1,
      };
      if (existing) {
        await tx
          .update(recurringServiceWorkPlan)
          .set(values)
          .where(
            and(
              eq(recurringServiceWorkPlan.id, existing.id),
              eq(recurringServiceWorkPlan.serviceId, SERVICE_ID)
            )
          );
        resultingIds.set(item.code, existing.id);
      } else {
        await tx
          .insert(recurringServiceWorkPlan)
          .values(values);
        const insertedRows = await tx.select({ id: recurringServiceWorkPlan.id })
          .from(recurringServiceWorkPlan).where(and(
            eq(recurringServiceWorkPlan.serviceId, SERVICE_ID),
            eq(recurringServiceWorkPlan.jiraIssueKey, issueKey)
          ));
        assert(insertedRows.length === 1, `insert de ${item.code} no es único`);
        resultingIds.set(item.code, insertedRows[0].id);
      }
    }

    const mappings: Array<{
      category: typeof DB_WORK_PLAN_CATEGORY | typeof DB_BILLING_CATEGORY;
      issueTypeId: string;
      issueTypeName: string;
      domainCategory: string;
    }> = [
      {
        category: DB_WORK_PLAN_CATEGORY,
        issueTypeId: CLOUDOPS_ISSUE_TYPE_ID,
        issueTypeName: CLOUDOPS_ISSUE_TYPE_NAME,
        domainCategory: OPERATIONAL_CATEGORY,
      },
      {
        category: DB_BILLING_CATEGORY,
        issueTypeId: BILLING_ISSUE_TYPE_ID,
        issueTypeName: BILLING_ISSUE_TYPE_NAME,
        domainCategory: BILLING_CATEGORY,
      },
    ];
    for (const mapping of mappings) {
      const existing = fresh.mappings.find(row => row.category === mapping.category);
      const values = {
        serviceId: SERVICE_ID,
        category: mapping.category,
        issueTypeId: mapping.issueTypeId,
        issueTypeName: mapping.issueTypeName,
        source: "selected" as const,
        status: "active" as const,
        configuredBy: auditActor!.id,
        configuredByName: auditActor!.name,
      };
      if (existing) {
        await tx
          .update(recurringServiceJsmIssueTypeMappings)
          .set(values)
          .where(
            and(
              eq(recurringServiceJsmIssueTypeMappings.id, existing.id),
              eq(recurringServiceJsmIssueTypeMappings.serviceId, SERVICE_ID),
              eq(recurringServiceJsmIssueTypeMappings.category, mapping.category)
            )
          );
      } else {
        await tx.insert(recurringServiceJsmIssueTypeMappings).values(values);
      }
    }

    const policyReason =
      "CloudOps 4775: 34 tareas internas en CONSALOP03 como Tarea de CloudOps 12981; work-plan create_in_linked_space y billing external_reference porque las seis cuotas UF160 ya tienen billing keys 12982 tras cutover parent. Se preservan cuotas UF160/total UF960, stages, evidencias, documentos y artifacts; no se asignan responsables, fechas de recepción/aceptación ni SLA.";
    await tx
      .update(recurringServices)
      .set({
        jsmWorkPlanSyncMode: "create_in_linked_space",
        jsmBillingSyncMode: "external_reference",
        jsmSyncPolicyReason: policyReason,
        jsmSyncPolicyUpdatedAt: new Date(),
        jsmSyncPolicyUpdatedBy: auditActor!.id,
      })
      .where(eq(recurringServices.id, SERVICE_ID));

    await tx.insert(auditLogs).values({
      action: "activate_cloudops4775_operations",
      entity: "recurring_service",
      entityId: String(SERVICE_ID),
      entityName: before.service?.serviceName ?? "Deal 4775 CloudOps",
      userId: auditActor!.id,
      userName: auditActor!.name,
      userRole: auditActor!.role,
      details: {
        actor: auditActor!.name,
        actorRole: "admin",
        runId: RUN_ID,
        matrixVersion: CLOUDOPS4775_VERSION,
        sourcePlan: "/home/ubuntu/prodigio-pmo/server/cloudOps4775Plan.ts",
        backupFile: BACKUP_FILE,
        backupSha256,
        planCount: EXPECTED_PLAN_ITEMS,
        reusedIds: [...EXISTING_WORK_PLAN_IDS],
        insertedCount: EXPECTED_NEW_ITEMS,
        issueType: { id: CLOUDOPS_ISSUE_TYPE_ID, name: CLOUDOPS_ISSUE_TYPE_NAME },
        mappingCategories: {
          [OPERATIONAL_CATEGORY]: CLOUDOPS_ISSUE_TYPE_ID,
          [BILLING_CATEGORY]: BILLING_ISSUE_TYPE_ID,
        },
        dbMappingCategories: {
          [DB_WORK_PLAN_CATEGORY]: CLOUDOPS_ISSUE_TYPE_ID,
          [DB_BILLING_CATEGORY]: BILLING_ISSUE_TYPE_ID,
        },
        workPlanSyncMode: "create_in_linked_space",
        billingSyncMode: "external_reference",
        policyReason,
        nativeLinkType: {
          id: nativeLinkType.id,
          name: nativeLinkType.name,
          inward: nativeLinkType.inward,
          outward: nativeLinkType.outward,
        },
        billingWrites: false,
        billingRowsPreserved: true,
        billingAmounts: "6 cuotas UF160; total UF960",
        stagesChanged: false,
        documentsChanged: false,
        reportEvidenceChanged: false,
        financialEvidenceChanged: false,
        artifactsChanged: false,
        slaRowsCreated: false,
        assigneesCreated: false,
        participantsCreated: false,
        organizationsCreated: false,
        publicCommentsCreated: false,
      },
    });
  });
  return resultingIds;
}

function monthsForItem(item: CloudOps4775Item): number[] {
  if (item.kind === "monthly") {
    assert(item.monthNumber != null, `${item.code} mensual sin monthNumber`);
    return [item.monthNumber];
  }
  if (item.kind === "cadence") return [...PERIODS];
  return [];
}

function planSummary(
  state: DbState,
  matrix: CloudOps4775Item[],
  milestones: Map<number, JiraIssue>,
  linkType: JiraLinkType,
  backup: { path: string; sha256: string }
): Record<string, unknown> {
  return {
    mode: APPLY ? "apply" : "dry-run",
    runId: RUN_ID,
    serviceId: SERVICE_ID,
    sourcePlan: "/home/ubuntu/prodigio-pmo/server/cloudOps4775Plan.ts",
    matrixVersion: CLOUDOPS4775_VERSION,
    destination: {
      projectKey: TARGET_PROJECT_KEY,
      projectId: TARGET_PROJECT_ID,
      serviceDeskId: TARGET_SERVICE_DESK_ID,
      issueType: { id: CLOUDOPS_ISSUE_TYPE_ID, name: CLOUDOPS_ISSUE_TYPE_NAME },
      billingIssueType: { id: BILLING_ISSUE_TYPE_ID, name: BILLING_ISSUE_TYPE_NAME },
      nativeLinkType: linkType,
    },
    counts: {
      total: matrix.length,
      monthly: matrix.filter(item => item.kind === "monthly").length,
      cadence: matrix.filter(item => item.kind === "cadence").length,
      initial: matrix.filter(item => item.kind === "initial").length,
      conditional: matrix.filter(item => item.kind === "conditional").length,
      reused: matrix.filter(item => item.reuseId != null).length,
      new: matrix.filter(item => item.reuseId == null).length,
    },
    workPlanIds: matrix.map(item => ({ code: item.code, reuseId: item.reuseId })),
    existingPlanRows: state.plan.map(row => ({
      id: row.id,
      monthNumber: row.monthNumber,
      jiraIssueKey: row.jiraIssueKey,
    })),
    milestones: [...milestones.entries()].map(([month, issue]) => ({ month, key: issue.key, id: issue.id })),
    billingPreserved: state.billing.map(row => ({
      id: row.id,
      monthNumber: row.monthNumber,
      amount: row.amount,
      currency: row.currency,
      dueDate: row.dueDate,
      status: row.status,
      jiraIssueKey: row.jiraIssueKey,
    })),
    syncPolicy: {
      workPlan: "create_in_linked_space",
      billing: "external_reference",
      reason: "CloudOps 4775 interno, billing external_reference para seis cuotas ya movidas por cutover parent.",
    },
    mappings: {
      [OPERATIONAL_CATEGORY]: CLOUDOPS_ISSUE_TYPE_ID,
      [BILLING_CATEGORY]: BILLING_ISSUE_TYPE_ID,
    },
    allDueDatesNull: matrix.every(item => item.dueDate == null),
    noHumanAssignees: true,
    noReceiptAcceptanceDatesOrSla: true,
    backup,
    journal: join(JOURNAL_ROOT, "journal.json"),
  };
}

function stablePlanFingerprint(
  matrix: CloudOps4775Item[],
  milestones: Map<number, JiraIssue>,
  linkType: JiraLinkType
): string {
  return snapshotHash({
    serviceId: SERVICE_ID,
    matrixVersion: CLOUDOPS4775_VERSION,
    items: matrix.map(item => ({
      code: item.code,
      title: item.title,
      description: item.description,
      itemType: item.itemType,
      frequency: item.frequency,
      monthNumber: item.monthNumber,
      dueDate: null,
      reuseId: item.reuseId,
      kind: item.kind,
    })),
    milestones: [...milestones.entries()].map(([month, issue]) => ({
      month,
      id: issue.id,
      key: issue.key,
    })),
    linkType: {
      id: linkType.id,
      name: linkType.name,
      inward: linkType.inward,
      outward: linkType.outward,
    },
    policy: {
      workPlan: "create_in_linked_space",
      billing: "external_reference",
      operationalCategory: OPERATIONAL_CATEGORY,
      billingCategory: BILLING_CATEGORY,
      operationalIssueTypeId: CLOUDOPS_ISSUE_TYPE_ID,
      billingIssueTypeId: BILLING_ISSUE_TYPE_ID,
    },
  });
}

async function verifyAllAfterApply(
  state: DbState,
  matrix: CloudOps4775Item[],
  rows: Map<string, PlanRow>,
  milestones: Map<number, JiraIssue>
): Promise<void> {
  const verifyRows = verifyPlanShape(state, matrix);
  assert(verifyRows.size === rows.size, "conteo de filas post-transacción cambió");
  for (const item of matrix) {
    const row = verifyRows.get(item.code);
    assert(row, `falta ${item.code} después de la transacción`);
    const issue = await getIssue(row.jiraIssueKey!);
    validateExistingIssueForRow(issue, row, item);
    for (const month of monthsForItem(item)) {
      const milestone = milestones.get(month);
      assert(milestone, `falta hito M0${month} para ${item.code}`);
      assert(
        issueHasLink(issue, milestone.key),
        `${issue.key} no quedó enlazado a ${milestone.key}`
      );
    }
  }
}

async function verifyCompletedNoop(
  state: DbState,
  matrix: CloudOps4775Item[],
  milestones: Map<number, JiraIssue>,
  backupSha256: string
): Promise<void> {
  const rows = verifyPlanShape(state, matrix);
  assert(rows.size === EXPECTED_PLAN_ITEMS, "runcompleted sin 34 filas PMO");
  for (const item of matrix) {
    const row = rows.get(item.code);
    assert(row?.jiraIssueKey, `runcompleted sin Jira para ${item.code}`);
    const issue = await getIssue(row.jiraIssueKey);
    validateExistingIssueForRow(issue, row, item);
    for (const month of monthsForItem(item)) {
      const milestone = milestones.get(month);
      assert(milestone && issueHasLink(issue, milestone.key), `enlace perdido ${item.code}/M0${month}`);
    }
  }
  assert(backupSha256.length === 64, "hash de respaldo inválido");
}

async function main(): Promise<void> {
  const db = await getDb();
  assert(db, "Base de datos no disponible");
  const [actor] = await db.select().from(users).where(eq(users.email, "ediazl@prodigio.tech")).limit(1);
  assert(actor && actor.role === "admin", "Actor administrador PMO no verificado");
  auditActor = { id: actor.id, name: actor.name || "ediazl@prodigio.tech", role: "admin" };
  const journal = loadJournal();
  const before = await readDbState(db);
  validateDbState(before);
  validateInitialOrCompletedPlan(before);
  const backup = saveSelectiveBackup(before);
  const matrix = buildMatrix(before);
  const jira = await readJiraPreflight(before);
  const plan = planSummary(before, matrix, jira.milestones, jira.linkType, backup);
  const planFingerprint = stablePlanFingerprint(
    matrix,
    jira.milestones,
    jira.linkType
  );
  if (journal.planFingerprint && journal.planFingerprint !== planFingerprint && journal.status === "completed") {
    throw new StopActivationError("runcompleted cambió el plan; no hacer NOOP ni escribir");
  }
  if (!journal.planFingerprint) {
    journal.planFingerprint = planFingerprint;
    journal.plan = matrix.map(item => ({
      code: item.code,
      title: item.title,
      description: item.description,
      itemType: item.itemType,
      frequency: item.frequency,
      monthNumber: item.monthNumber,
      dueDate: null,
      kind: item.kind,
      workPlanId: item.reuseId ?? undefined,
      jiraIssueKey: item.reuseId != null
        ? before.plan.find(row => row.id === item.reuseId)?.jiraIssueKey ?? undefined
        : undefined,
    }));
    saveJournal(journal);
  }
  writeJsonAtomic(join(JOURNAL_ROOT, `${RUN_ID}-plan.json`), plan);

  if (!APPLY) {
    console.log(
      JSON.stringify(
        {
          ...plan,
          dbWrites: false,
          jiraWrites: false,
          journalStatus: journal.status,
          backup,
          check: "dry-run; no --apply ejecutado",
        },
        null,
        2
      )
    );
    return;
  }

  if (journal.status === "completed") {
    await verifyCompletedNoop(before, matrix, jira.milestones, backup.sha256);
    console.log(
      JSON.stringify(
        {
          ...plan,
          mode: "noop",
          journalStatus: "completed",
          dbWrites: false,
          jiraWrites: false,
          reason: "runcompleted verificado por GET y plan states preservados",
        },
        null,
        2
      )
    );
    return;
  }

  const issueKeysByCode = new Map<string, string>();
  const createdIssues: string[] = [];
  const currentRows = itemRows(before, matrix);
  let processed = 0;
  for (const item of matrix) {
    const existingRow = currentRows.get(item.code);
    let issue: JiraIssue;
    let created = false;
    if (existingRow?.jiraIssueKey) {
      issue = await getIssue(existingRow.jiraIssueKey);
      validateExistingIssueForRow(issue, existingRow, item);
    } else {
      const result = await createIssueWithProof(journal, item);
      issue = result.issue;
      created = result.created;
      if (created) createdIssues.push(issue.key);
    }
    issueKeysByCode.set(item.code, issue.key);
    for (const month of monthsForItem(item)) {
      const milestone = jira.milestones.get(month);
      assert(milestone, `hito canónico no encontrado para ${item.code}/M0${month}`);
      await ensureNativeLink(journal, issue, milestone, jira.linkType);
    }
    processed += 1;
    console.log(
      JSON.stringify({
        progress: `${processed}/${matrix.length}`,
        code: item.code,
        planId: item.reuseId ?? null,
        issueKey: issue.key,
        created,
        linksVerified: monthsForItem(item).length,
      })
    );
  }

  const backupSha256 = loadBackupHash();
  const resultingIds = await persistFinalDb(
    db,
    before,
    matrix,
    issueKeysByCode,
    backupSha256,
    jira.linkType
  );
  const after = await readDbState(db);
  validateDbState(after);
  const rows = verifyPlanShape(after, matrix);
  await verifyAllAfterApply(after, matrix, rows, jira.milestones);
  journal.status = "completed";
  journal.completedAt = new Date().toISOString();
  for (const item of matrix) {
    const row = rows.get(item.code);
    const intentKey = issueIntentKey(item);
    const receipt = journal.receipts[intentKey];
    assert(receipt?.key === row?.jiraIssueKey, `receipt final no coincide para ${item.code}`);
    const saved = journal.plan?.find(planItem => planItem.code === item.code);
    if (saved) {
      saved.workPlanId = row?.id;
      saved.jiraIssueKey = row?.jiraIssueKey;
    }
  }
  saveJournal(journal);
  const afterHash = snapshotHash(selectiveBackup(after));
  writeJsonAtomic(join(JOURNAL_ROOT, `${RUN_ID}-after.json`), {
    completedAt: journal.completedAt,
    beforeBackup: backup,
    afterHash,
    createdIssues,
    issueKeysByCode: Object.fromEntries(issueKeysByCode),
    workPlanIdsByCode: Object.fromEntries(resultingIds),
    linkedTasks: matrix.length,
    billingUnchanged:
      jsonForHash(after.billing) === jsonForHash(before.billing),
    stagesUnchanged: jsonForHash(after.stages) === jsonForHash(before.stages),
    documentsUnchanged: jsonForHash(after.documents) === jsonForHash(before.documents),
    reportsUnchanged: jsonForHash(after.reports) === jsonForHash(before.reports),
    financialEvidenceUnchanged:
      jsonForHash(after.financialEvidence) === jsonForHash(before.financialEvidence),
    artifactsUnchanged: jsonForHash(after.artifacts) === jsonForHash(before.artifacts),
    createdIssuesCount: createdIssues.length,
  });
  console.log(
    JSON.stringify(
      {
        ...plan,
        mode: "applied",
        journalStatus: "completed",
        afterHash,
        createdIssues,
        linkedTasks: matrix.length,
        dbWrites: true,
        jiraWrites: true,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch(error => {
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
