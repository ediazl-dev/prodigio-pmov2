import { getDb } from "../server/db";
import { getJiraRuntimeCredentials } from "../server/jiraClient";
import { eq, and } from "drizzle-orm";
import { recurringServices, recurringServiceStages, recurringServiceBillingMonths, recurringServiceWorkPlan, recurringServiceDocuments, recurringServiceReportEvidence, recurringServiceFinancialEvidence, recurringServicePenalties, recurringServiceSlaConfig, recurringServiceJsmIssueTypeMappings, recurringServiceJsmSyncRuns, documentArtifacts, documentValidationDecisions } from "../drizzle/schema";
import { mkdirSync, writeFileSync, readFileSync, chmodSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const SERVICE_ID = 2070001;
const SOURCE_KEYS = ["PSCSC4S-41", "PSCSC4S-19", "PSCSC4S-20", "PSCSC4S-21", "PSCSC4S-22", "PSCSC4S-23"];
const TARGET_KEY = "CONSALOP02";
const SOW = "/home/ubuntu/upload/RXpOnzW9Rjs2FHw6Vklua-SoWStatementofWork-StaffingArquitectodeSolucionesSenior-Consalud-Deal4727.pdf";
const sha = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const root = `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-migration/${stamp}`;
mkdirSync(root, { recursive: true, mode: 0o700 }); chmodSync(root, 0o700);
function save(name: string, value: unknown) {
  const text = JSON.stringify(value, null, 2);
  writeFileSync(join(root, name), text, { mode: 0o600, flag: "wx" });
  writeFileSync(join(root, `${name}.sha256`), `${sha(text)}  ${name}\n`, { mode: 0o600, flag: "wx" });
}
async function jira(path: string): Promise<any> {
  const c = getJiraRuntimeCredentials();
  const response = await fetch(`${c.baseUrl}/rest/api/3${path}`, { method: "GET", headers: { Authorization: c.authorization, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Jira GET ${path.split("?")[0]}: HTTP ${response.status}`);
  return response.json();
}
async function optional(path: string) {
  try { return { ok: true, value: await jira(path) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : "Error de lectura" }; }
}
async function pages(path: string, property: string): Promise<any[]> {
  const values: any[] = []; let startAt = 0;
  for (let page = 0; page < 50; page++) {
    const result = await jira(`${path}${path.includes("?") ? "&" : "?"}startAt=${startAt}&maxResults=100`);
    const current = result[property] ?? [];
    values.push(...current);
    const next = (result.startAt ?? startAt) + current.length;
    if (result.isLast === true || current.length === 0 || (typeof result.total === "number" && next >= result.total)) return values;
    startAt = next;
  }
  throw new Error("Paginación excedió su límite; respaldo incompleto.");
}
(async () => {
  const db = await getDb(); if (!db) throw new Error("Base de datos no disponible");
  console.log("Preparando snapshot PMO 2070001 (sin escrituras de negocio).");
  const state = {
    service: await db.select().from(recurringServices).where(eq(recurringServices.id, SERVICE_ID)),
    stages: await db.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId, SERVICE_ID)).orderBy(recurringServiceStages.id),
    billing: await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, SERVICE_ID)).orderBy(recurringServiceBillingMonths.id),
    plan: await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, SERVICE_ID)).orderBy(recurringServiceWorkPlan.id),
    documents: await db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId, SERVICE_ID)),
    reports: await db.select().from(recurringServiceReportEvidence).where(eq(recurringServiceReportEvidence.serviceId, SERVICE_ID)),
    financialEvidence: await db.select().from(recurringServiceFinancialEvidence).where(eq(recurringServiceFinancialEvidence.serviceId, SERVICE_ID)),
    penalties: await db.select().from(recurringServicePenalties).where(eq(recurringServicePenalties.serviceId, SERVICE_ID)),
    sla: await db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, SERVICE_ID)),
    mappings: await db.select().from(recurringServiceJsmIssueTypeMappings).where(eq(recurringServiceJsmIssueTypeMappings.serviceId, SERVICE_ID)),
    runs: await db.select().from(recurringServiceJsmSyncRuns).where(eq(recurringServiceJsmSyncRuns.serviceId, SERVICE_ID)),
    artifacts: await db.select().from(documentArtifacts).where(and(eq(documentArtifacts.entityType, "recurring_service"), eq(documentArtifacts.entityId, SERVICE_ID))),
    decisions: await db.select().from(documentValidationDecisions).where(and(eq(documentValidationDecisions.entityType, "recurring_service"), eq(documentValidationDecisions.entityId, SERVICE_ID))),
  };
  const service = state.service[0];
  if (!service || service.dealId !== "4727" || service.serviceType !== "staffing" || service.jsmProjectKey !== TARGET_KEY || service.status !== "activo") throw new Error("Identidad, tipo, destino o lifecycle del servicio no coinciden; detener.");
  if (state.billing.length !== 6 || state.billing.some(b => b.currency !== "UF" || Number(b.amount) !== 195)) throw new Error("Calendario contractual cambió; no asumir seis cuotas UF195.");
  save("pmo-before.json", state);
  copyFileSync(SOW, join(root, "sow.pdf")); chmodSync(join(root, "sow.pdf"), 0o600);
  writeFileSync(join(root, "sow.pdf.sha256"), `${sha(readFileSync(SOW))}  sow.pdf\n`, { mode: 0o600, flag: "wx" });
  const source = await jira("/project/PSCSC4S");
  const target = await jira(`/project/${TARGET_KEY}`);
  const permissions = "BROWSE_PROJECTS,CREATE_ISSUES,MOVE_ISSUES,EDIT_ISSUES,ADMINISTER_PROJECTS,BULK_CHANGE,ADMINISTER";
  const capability = {
    sourceProject: source, targetProject: target,
    sourcePermissions: await optional(`/mypermissions?projectKey=PSCSC4S&permissions=${permissions}`),
    targetPermissions: await optional(`/mypermissions?projectKey=${TARGET_KEY}&permissions=${permissions}`),
    targetTypes: await optional(`/issuetype/project?projectId=${target.id}`),
    targetCreateTypes: await optional(`/issue/createmeta/${target.id}/issuetypes`),
    billingFieldContexts: await optional("/field/customfield_11237/context"),
  };
  save("capabilities.json", capability);
  const issues: any[] = [];
  for (const key of SOURCE_KEYS) {
    console.log(`Respaldando ${key}: campos, changelog, comentarios y adjuntos.`);
    const issue = await jira(`/issue/${key}?fields=*all`);
    if (!String(issue.fields.project.key).match(/^(PSCSC4S|CONSALOP02)$/)) throw new Error(`${key} pertenece a otro Space; detener.`);
    issue.changelogFull = await pages(`/issue/${issue.id}/changelog`, "values");
    issue.commentsFull = await pages(`/issue/${issue.id}/comment`, "comments");
    save(`${key}.json`, issue);
    for (const attachment of issue.fields.attachment ?? []) {
      const credentials = getJiraRuntimeCredentials();
      const url = new URL(attachment.content);
      if (url.origin !== new URL(credentials.baseUrl).origin) throw new Error("Adjunto con origen inesperado; no enviar credenciales.");
      const response = await fetch(url, { headers: { Authorization: credentials.authorization }, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`No se pudo respaldar adjunto ${attachment.id}: HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const name = `attachment-${attachment.id}-${String(attachment.filename).replace(/[^A-Za-z0-9._-]/g, "_")}`;
      writeFileSync(join(root, name), bytes, { mode: 0o600, flag: "wx" });
      writeFileSync(join(root, `${name}.sha256`), `${sha(bytes)}  ${name}\n`, { mode: 0o600, flag: "wx" });
    }
    issues.push(issue);
  }
  const manifest = {
    version: 1, readOnly: true, backupComplete: true, createdAt: new Date().toISOString(), serviceId: SERVICE_ID,
    sourceProject: { id: source.id, key: source.key, style: source.style }, targetProject: { id: target.id, key: target.key, style: target.style, projectTypeKey: target.projectTypeKey },
    sowSha256: sha(readFileSync(SOW)), backupDirectory: root,
    mapping: issues.map((issue, index) => ({ monthNumber: index + 1, billingId: state.billing.find(b => b.monthNumber === index + 1)?.id, sourceKey: SOURCE_KEYS[index], currentKey: issue.key, issueId: issue.id, projectKey: issue.fields.project.key, issueTypeId: issue.fields.issuetype.id, issueTypeName: issue.fields.issuetype.name, summary: issue.fields.summary, amount: "195.00", currency: "UF", dueDate: issue.fields.duedate, status: issue.fields.status, billingField: issue.fields.customfield_11237, attachments: issue.fields.attachment?.length ?? 0, comments: issue.commentsFull.length, changelogEntries: issue.changelogFull.length })),
  };
  save("manifest.json", manifest);
  console.log(JSON.stringify({ backupDirectory: root, backupComplete: true, readOnly: true, serviceId: SERVICE_ID, sourceStyle: source.style, targetStyle: target.style, targetType: target.projectTypeKey, sourcePermissions: capability.sourcePermissions, targetPermissions: capability.targetPermissions, targetTypes: capability.targetTypes, createTypes: capability.targetCreateTypes, billingFieldContexts: capability.billingFieldContexts, manifest: manifest.mapping }, null, 2));
  process.exit(0);
})().catch(error => {
  const message = error instanceof Error ? error.message : "Error de respaldo";
  console.error(JSON.stringify({ backupDirectory: root, backupComplete: false, readOnly: true, error: message }));
  process.exit(1);
});
