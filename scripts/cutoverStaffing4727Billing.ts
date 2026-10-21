import { getDb } from "../server/db";
import { getJiraRuntimeCredentials } from "../server/jiraClient";
import { recurringServices, recurringServiceBillingMonths, adminSettings, auditLogs, users } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
const SERVICE_ID = 2070001;
const FIELD = "customfield_12127";
const KEY = `recurring-jira-billing-field:${SERVICE_ID}`;
const JOURNAL = "/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-native-move/journal.json";
const ROOT = "/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-billing-cutover";
const apply = process.argv.includes("--apply");
const hash = (x: string | Buffer) => createHash("sha256").update(x).digest("hex");
function saveOnce(name: string, data: unknown) {
  const text = JSON.stringify(data, null, 2); const path = join(ROOT, name);
  if (existsSync(path)) {
    if (hash(readFileSync(path)) !== readFileSync(path + ".sha256", "utf8").split(/\s/)[0]) throw new Error("Respaldo alterado");
    return;
  }
  writeFileSync(path, text, { mode: 0o600, flag: "wx" });
  writeFileSync(path + ".sha256", `${hash(text)}  ${name}\n`, { mode: 0o600, flag: "wx" });
}
async function jira(path: string): Promise<any> {
  const c = getJiraRuntimeCredentials();
  const r = await fetch(c.baseUrl + "/rest/api/3" + path, { headers: { Authorization: c.authorization, Accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`GET ${path.split("?")[0]} HTTP ${r.status}`);
  return r.json();
}
(async () => {
  const db = await getDb(); if (!db) throw new Error("DB no disponible");
  const journal = JSON.parse(readFileSync(JOURNAL, "utf8"));
  if (hash(readFileSync(JOURNAL)) !== readFileSync(JOURNAL + ".sha256", "utf8").split(/\s/)[0]) throw new Error("Journal alterado");
  const manifestPath = join(journal.backupDirectory, "manifest.json");
  if (hash(readFileSync(manifestPath)) !== readFileSync(manifestPath + ".sha256", "utf8").split(/\s/)[0]) throw new Error("Manifest alterado");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const originalPmo = JSON.parse(readFileSync(join(journal.backupDirectory, "pmo-before.json"), "utf8"));
  const [service] = await db.select().from(recurringServices).where(eq(recurringServices.id, SERVICE_ID));
  const billing = await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, SERVICE_ID)).orderBy(recurringServiceBillingMonths.id);
  const setting = await db.select().from(adminSettings).where(eq(adminSettings.key, KEY));
  if (service?.dealId !== "4727" || service.status !== "activo" || service.serviceType !== "staffing" || service.jsmProjectKey !== "CONSALOP02" || service.jsmProjectId !== "13114") throw new Error("Servicio/vínculo/lifecycle cambió");
  if (billing.length !== 6 || manifest.mapping.length !== 6 || billing.some(b => b.currency !== "UF" || Number(b.amount) !== 195)) throw new Error("Cuotas no coinciden");
  const destinations: any[] = [];
  for (const m of manifest.mapping) {
    const entry = journal.items[m.issueId];
    if (!entry?.verifiedAt || !entry.destinationKey) throw new Error(`Falta destino verificado M${m.monthNumber}`);
    const live = await jira(`/issue/${m.issueId}?fields=summary,project,issuetype,${FIELD},duedate`);
    if (live.id !== m.issueId || live.key !== entry.destinationKey || live.fields.project.key !== "CONSALOP02" || live.fields.issuetype.id !== "12979" || live.fields[FIELD]?.value !== entry.billingValue || live.fields.duedate !== m.dueDate) throw new Error("Evidencia destino cambió");
    destinations.push({ monthNumber: m.monthNumber, billingId: m.billingId, issueId: m.issueId, sourceKey: m.sourceKey, destinationKey: live.key, billingValue: entry.billingValue });
  }
  for (const row of billing) {
    const original = originalPmo.billing.find((b: any) => b.id === row.id);
    if (!original) throw new Error("Cuota no existe en respaldo");
    const withoutKey = ({ jiraIssueKey: _key, ...rest }: any) => rest;
    if (JSON.stringify(withoutKey(original)) !== JSON.stringify(withoutKey(row))) throw new Error("Datos de cuota cambiaron; no sobrescribir");
  }
  const allBound = destinations.every(d => billing.find(b => b.id === d.billingId)?.jiraIssueKey === d.destinationKey);
  const existing = setting[0]?.value ? JSON.parse(setting[0].value) : null;
  if (allBound && existing?.fieldId === FIELD && existing?.projectKey === "CONSALOP02" && existing?.serviceId === SERVICE_ID) {
    console.log(JSON.stringify({ mode: "noop", serviceId: SERVICE_ID, destinations, preservedBilling: true })); return;
  }
  mkdirSync(ROOT, { recursive: true, mode: 0o700 });
  saveOnce("before.json", { service, billing, setting, journalSha256: hash(readFileSync(JOURNAL)) });
  const mapping = { version: 1, serviceId: SERVICE_ID, projectId: "13114", projectKey: "CONSALOP02", fieldId: FIELD, fieldName: "Estado de Facturación Staffing", verifiedAt: new Date().toISOString() };
  console.log(JSON.stringify({ apply, destinations, field: mapping, invariant: "6 cuotas UF195 intactas; cambia sólo jiraIssueKey y configuración de lectura" }));
  if (!apply) return;
  const [actor] = await db.select({ id: users.id, name: users.name, role: users.role }).from(users).where(eq(users.email, "ediazl@prodigio.tech")).limit(1);
  if (!actor || actor.role !== "admin") throw new Error("Actor administrador PMO no verificado");
  await db.transaction(async tx => {
    const locked = await tx.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, SERVICE_ID)).orderBy(recurringServiceBillingMonths.id).for("update");
    if (JSON.stringify(locked) !== JSON.stringify(billing)) throw new Error("Cuotas cambiaron concurrentemente");
    for (const d of destinations) await tx.update(recurringServiceBillingMonths).set({ jiraIssueKey: d.destinationKey }).where(eq(recurringServiceBillingMonths.id, d.billingId));
    await tx.insert(adminSettings).values({ key: KEY, value: JSON.stringify(mapping), description: "Campo local financiero verificado para JSM team-managed; fuente única CONSALOP02, sin fallback al Space anterior." }).onDuplicateKeyUpdate({ set: { value: JSON.stringify(mapping), description: "Campo local financiero verificado para JSM team-managed; fuente única CONSALOP02, sin fallback al Space anterior." } });
    await tx.insert(auditLogs).values({ action: "staffing_4727_billing_cutover", entity: "recurring_service", entityId: String(SERVICE_ID), entityName: service.serviceName, userId: actor.id, userName: actor.name, userRole: actor.role, details: { backupDirectory: ROOT, originalBackup: journal.backupDirectory, journalSha256: hash(readFileSync(JOURNAL)), destinations, fieldMapping: mapping, quoteAmountsChanged: false, jiraCopiesCreated: false, jiraOriginalIdsPreserved: true, sourceFallbackDisabled: true } });
  });
  const after = await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, SERVICE_ID)).orderBy(recurringServiceBillingMonths.id);
  saveOnce("after.json", { billing: after, mapping, destinations });
  if (!destinations.every(d => after.find(b => b.id === d.billingId)?.jiraIssueKey === d.destinationKey)) throw new Error("Corte no verificado");
  console.log(JSON.stringify({ applied: true, serviceId: SERVICE_ID, billingItems: after.length, preservedQuoteAmounts: true }));
})().then(() => process.exit(0)).catch(e => { console.error(e.message); process.exit(1); });
