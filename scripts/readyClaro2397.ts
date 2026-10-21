import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq, inArray } from "drizzle-orm";
import * as schema from "../drizzle/schema";
import { getDb } from "../server/db";
import { getJiraRuntimeCredentials } from "../server/jiraClient";
import { recurringServicesRouter } from "../server/recurringServicesRouter";
import { linkRecurringItemToExistingJiraIssue } from "../server/recurringServicesDb";
import { buildClaro2397SetupPlan, CLARO_2397_ID as ID } from "../server/claro2397SetupPlan";
import { loadRecurringServiceJiraBillingEvidence } from "../server/jiraBillingEvidence";

const DIR = "/home/ubuntu/backups/prodigio-pmo/2026-10-21-claro-2397-ready";
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const apply = process.argv.includes("--apply");
async function main() {
  const db = await getDb(); if (!db) throw Error("DB no disponible");
  const snapshot = async () => {
    const [[service], stages, billing, workItems, mappings, documents, artifacts, decisions] = await Promise.all([
      db.select().from(schema.recurringServices).where(eq(schema.recurringServices.id, ID)),
      db.select().from(schema.recurringServiceStages).where(eq(schema.recurringServiceStages.serviceId, ID)),
      db.select().from(schema.recurringServiceBillingMonths).where(eq(schema.recurringServiceBillingMonths.serviceId, ID)),
      db.select().from(schema.recurringServiceWorkPlan).where(eq(schema.recurringServiceWorkPlan.serviceId, ID)),
      db.select().from(schema.recurringServiceJsmIssueTypeMappings).where(eq(schema.recurringServiceJsmIssueTypeMappings.serviceId, ID)),
      db.select().from(schema.recurringServiceDocuments).where(eq(schema.recurringServiceDocuments.serviceId, ID)),
      db.select().from(schema.documentArtifacts).where(and(eq(schema.documentArtifacts.entityType, "recurring_service"), eq(schema.documentArtifacts.entityId, ID))),
      db.select().from(schema.documentValidationDecisions).where(and(eq(schema.documentValidationDecisions.entityType, "recurring_service"), eq(schema.documentValidationDecisions.entityId, ID))),
    ]);
    if (!service) throw Error("Servicio no encontrado");
    return { service, stages, billing, workItems, mappings, documents, artifacts, decisions };
  };
  const current = await snapshot();
  const [actor] = await db.select().from(schema.users).where(eq(schema.users.email, "ediazl@prodigio.tech"));
  if (!actor || actor.role !== "admin") throw Error("Actor autorizado no disponible");
  const c = getJiraRuntimeCredentials();
  const getIssue = async (key: string) => {
    const r = await fetch(`${c.baseUrl}/rest/api/3/issue/${key}?fields=*all&expand=changelog`, { headers: { Authorization: c.authorization, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw Error(`Lectura Jira ${key}: HTTP${r.status}`);
    return r.json();
  };
  const workIssues = []; const billingIssues = [];
  for (const item of current.workItems) { if (!item.jiraIssueKey) throw Error("Actividad sin Jira"); workIssues.push(await getIssue(item.jiraIssueKey)); }
  console.log("32 actividades existentes verificadas");
  for (let month = 1; month <= 12; month++) billingIssues.push(await getIssue(`MDS2937-${55 + month}`));
  console.log("12 hitos originales verificados; ningún POST Jira");
  const plan = buildClaro2397SetupPlan({ ...current, workIssues, billingIssues });
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  if (!existsSync(`${DIR}/before.json`)) {
    const text = JSON.stringify({ ...current, workIssues, billingIssues }, null, 2) + "\n";
    writeFileSync(`${DIR}/before.json`, text, { mode: 0o600, flag: "wx" });
    writeFileSync(`${DIR}/before.json.sha256`, createHash("sha256").update(text).digest("hex") + "  before.json\n", { mode: 0o600, flag: "wx" });
  }
  const bytes = readFileSync(`${DIR}/before.json`);
  if (createHash("sha256").update(bytes).digest("hex") !== readFileSync(`${DIR}/before.json.sha256`, "utf8").split(" ")[0]) throw Error("Hash respaldo no coincide");
  const before = JSON.parse(bytes.toString());
  const owners = await db.select().from(schema.recurringServiceBillingMonths).where(inArray(schema.recurringServiceBillingMonths.jiraIssueKey, plan.bindings.map(x => x.jiraIssueKey)));
  if (owners.some(x => x.serviceId !== ID)) throw Error("Hito financiero usado por otro servicio");
  const caller = recurringServicesRouter.createCaller({ user: actor, req: { headers: { "user-agent": "Manus mantenimiento autorizado Claro2397" }, ip: "127.0.0.1" }, res: {} } as any);
  console.log(JSON.stringify({ apply, bindings: plan.bindings, policy: plan.policy, phase: current.service.currentStage }));
  if (!apply) return;
  for (const binding of plan.bindings) {
    await linkRecurringItemToExistingJiraIssue({ serviceId: ID, category: "billing", entityId: binding.entityId, jiraIssueKey: binding.jiraIssueKey });
    console.log(`Referencia M${binding.monthNumber} guardada/reutilizada`);
  }
  if (current.service.jsmWorkPlanSyncMode !== "external_reference" || current.service.jsmBillingSyncMode !== "external_reference") await caller.setJsmSyncPolicy({ serviceId: ID, ...plan.policy });
  const configuration = await caller.getJsmSyncConfiguration({ serviceId: ID });
  if (!configuration.readiness.canClose || configuration.readiness.totalUnsynced !== 0) throw Error("Compuerta aún no válida");
  const stage = (await snapshot()).stages.find(x => x.stageId === "jira_setup");
  if (stage?.status === "in_progress") await caller.closeJiraSetupStage({ serviceId: ID });
  else if (stage?.status !== "completed") throw Error("Estado inesperado de setup");
  const after = await snapshot();
  const cleanBilling = (rows: any[]) => rows.map(({ jiraIssueKey, updatedAt, ...x }) => x).sort((a, b) => a.id - b.id);
  if (hash(cleanBilling(before.billing)) !== hash(cleanBilling(after.billing)) || hash(before.workItems) !== hash(after.workItems) || hash(before.documents) !== hash(after.documents) || hash(before.artifacts) !== hash(after.artifacts) || hash(before.decisions) !== hash(after.decisions)) throw Error("Preservación de datos falló");
  if (after.service.status !== "activo" || after.service.currentStage !== "ejecucion" || after.stages.find(x => x.stageId === "ejecucion")?.status !== "in_progress" || after.stages.find(x => x.stageId === "cierre")?.status !== "locked") throw Error("Lifecycle no operativo");
  const evidence = await loadRecurringServiceJiraBillingEvidence(ID);
  if (evidence.items.length !== 12 || evidence.summary.duplicateGroups !== 0 || evidence.summary.billedItems !== 0 || evidence.summary.unknownItems !== 12) throw Error("Estado financiero inesperado: revisar sin inferir emisión");
  writeFileSync(`${DIR}/after.json`, JSON.stringify({ ...after, readiness: configuration.readiness, financial: evidence.summary, preserved: true }, null, 2) + "\n", { mode: 0o600 });
  const auditAction = "claro2397_setup_ready_existing_references";
  const prior = await db.select().from(schema.auditLogs).where(and(eq(schema.auditLogs.action, auditAction), eq(schema.auditLogs.entityId, String(ID)))).limit(1);
  if (prior.length === 0) await db.insert(schema.auditLogs).values({ userId: actor.id, userName: actor.name, userRole: actor.role, action: auditAction, entity: "recurring_service", entityId: String(ID), entityName: after.service.serviceName, details: { bindings: plan.bindings, originalActivitiesPreserved: 32, nativeStageClose: true, noJiraWrites: true, noFinancialReconciliation: true, financial: evidence.summary } });
  console.log(JSON.stringify({ OPERATIVO: true, stage: after.service.currentStage, work: after.workItems.length, billing: after.billing.length, financial: evidence.summary, preserved: true }));
}
main().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
