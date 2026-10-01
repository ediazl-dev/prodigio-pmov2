import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { auditLogs, recurringServices, recurringServiceWorkPlan, recurringServiceBillingMonths } from "../drizzle/schema";
import { getDb } from "../server/db";
import { buildStaffingContractPlan } from "../server/recurringServiceContractPolicy";

const serviceId = 2040001;
const backupDir = "/home/ubuntu/backups/prodigio-pmo/2026-10-01-staffing-4687-configuration";
const backupFile = `${backupDir}/before-worklog-annotation.json`;
const oldText = "Consolidar las actividades asignadas por el cliente y las horas consumidas por el profesional durante el período.";
const newText = buildStaffingContractPlan({ durationMonths: 1, reportDueDates: [null], approvalDueDates: [null], reportDeliveryBusinessDays: 3, approvalWindowBusinessDays: 3 })[0].description!;
const db = await getDb();
if (!db) throw new Error("Base de datos no disponible");
const [service] = await db.select().from(recurringServices).where(eq(recurringServices.id, serviceId));
const plan = await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId));
const billing = await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId));
if (service?.dealId !== "4687" || service.serviceType !== "staffing" || service.jsmWorkPlanSyncMode !== "external_reference" || plan.length !== 12 || billing.length !== 3) throw new Error("Precondición de Staffing 4687 cambió");
const target = plan.filter(row => row.title.startsWith("Consolidar horas y capacidad · Mes "));
if (target.length !== 3 || target.some(row => ![oldText, newText].includes(row.description ?? ""))) throw new Error("Descripción o número de controles cambió");
if (target.every(row => row.description === newText)) { console.log(JSON.stringify({mode:"already_applied",serviceId,count:3})); process.exit(0); }
if (!target.every(row => row.description === oldText)) throw new Error("Cambio parcial: detener sin escribir");
const payload = {service,plan,billing,createdAt:new Date().toISOString()};
const fingerprint = createHash("sha256").update(JSON.stringify({service,plan,billing})).digest("hex");
if (!process.argv.includes("--apply")) {
  mkdirSync(backupDir,{recursive:true,mode:0o700}); chmodSync(backupDir,0o700);
  writeFileSync(backupFile,JSON.stringify({fingerprint,...payload},null,2),{flag:"wx",mode:0o600});
  const sha = createHash("sha256").update(readFileSync(backupFile)).digest("hex");
  writeFileSync(`${backupFile}.sha256`,`${sha}  before-worklog-annotation.json\n`,{flag:"wx",mode:0o600});
  console.log(JSON.stringify({mode:"dry-run",serviceId,backupFile,sha256:sha,affectedIds:target.map(row=>row.id),billingPreserved:billing.map(row=>row.id),newDescription:newText}));
  process.exit(0);
}
const backup = JSON.parse(readFileSync(backupFile,"utf8"));
const backupSha = createHash("sha256").update(readFileSync(backupFile)).digest("hex");
if (backup.fingerprint !== fingerprint || readFileSync(`${backupFile}.sha256`,"utf8").split(/\s+/)[0] !== backupSha) throw new Error("Respaldo o estado cambiaron");
await db.transaction(async tx => {
  await tx.execute(sql`SELECT id FROM recurring_services WHERE id = ${serviceId} FOR UPDATE`);
  const [freshService] = await tx.select().from(recurringServices).where(eq(recurringServices.id,serviceId));
  const freshPlan = await tx.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,serviceId));
  const freshBilling = await tx.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,serviceId));
  if (createHash("sha256").update(JSON.stringify({service:freshService,plan:freshPlan,billing:freshBilling})).digest("hex") !== fingerprint) throw new Error("Cambió el estado concurrentemente");
  for (const row of target) {
    await tx.update(recurringServiceWorkPlan).set({description:newText}).where(and(eq(recurringServiceWorkPlan.id,row.id),eq(recurringServiceWorkPlan.description,oldText)));
  }
  await tx.insert(auditLogs).values({action:"annotate_staffing_4687_worklog",entity:"recurring_service",entityId:String(serviceId),entityName:service.serviceName,userName:"Manus AI",userRole:"system",
    details:{authorizedBy:"Keno, 2026-10-01",backupFile,backupSha256:backupSha,affectedIds:target.map(row=>row.id),worklogAndBurnRate:true,actualOwnerAssigned:false,reportEvidenceChanged:false,billingIds:billing.map(row=>row.id),jiraWrites:false}});
});
const after = await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,serviceId));
if (after.filter(row=>row.description===newText).length!==3) throw new Error("Verificación posterior falló");
console.log(JSON.stringify({mode:"applied",serviceId,affected:3,backupSha256:backupSha,reportEvidenceChanged:false,billingPreserved:3,jiraWrites:false}));
process.exit(0);
