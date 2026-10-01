import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import {
  auditLogs, recurringServices, recurringServiceStages, recurringServiceWorkPlan,
  recurringServiceBillingMonths, recurringServiceJsmIssueTypeMappings,
  recurringServiceSlaConfig, recurringServiceDocuments, documentArtifacts,
  documentValidationDecisions, recurringServiceReportEvidence,
} from "../drizzle/schema";
import { calculateDeadlineDate, getDb } from "../server/db";
import { buildStaffingContractPlan } from "../server/recurringServiceContractPolicy";
import { calculateJsmSetupReadiness } from "../server/jsmRecurringSyncRunner";

const id = 2040001;
const root = "/home/ubuntu/backups/prodigio-pmo/2026-10-01-staffing-4687-configuration";
const backupFile = `${root}/before.json`;
const apply = process.argv.includes("--apply");
const db = await getDb();
if (!db) throw new Error("Base de datos no disponible.");
const rows = await db.select().from(recurringServices).where(eq(recurringServices.id, id));
const service = rows[0];
if (!service || service.serviceType !== "staffing" || service.dealId !== "4687" ||
    service.currency !== "UF" || service.formalStartDate !== "2026-04-27" ||
    service.endDate !== "2026-07-27" || service.currentStage !== "jira_setup" ||
    service.jsmProjectKey !== "CONSALOP01") throw new Error("Ficha cambió: detener sin escribir.");
const tables = {
  recurringServices: rows,
  recurringServiceStages: await db.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId,id)),
  recurringServiceWorkPlan: await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id)),
  recurringServiceBillingMonths: await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,id)),
  recurringServiceJsmIssueTypeMappings: await db.select().from(recurringServiceJsmIssueTypeMappings).where(eq(recurringServiceJsmIssueTypeMappings.serviceId,id)),
  recurringServiceSlaConfig: await db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId,id)),
  recurringServiceDocuments: await db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId,id)),
  documentArtifacts: (await db.select().from(documentArtifacts).where(eq(documentArtifacts.entityId,id))).filter(x=>x.entityType==="recurring_service"),
  documentValidationDecisions: (await db.select().from(documentValidationDecisions).where(eq(documentValidationDecisions.entityId,id))).filter(x=>x.entityType==="recurring_service"),
  recurringServiceReportEvidence: await db.select().from(recurringServiceReportEvidence).where(eq(recurringServiceReportEvidence.serviceId,id)),
};
const work = tables.recurringServiceWorkPlan;
const billing = tables.recurringServiceBillingMonths;
const mappings = tables.recurringServiceJsmIssueTypeMappings;
const liveMappings = mappings.filter(x=>x.status==="active");
const initial = work.length === 15 && work.every(x=>x.id >= 30005 && x.id <= 30019) &&
  billing.length===3 && billing.every(x=>x.amount==="160.00" && x.currency==="UF" && !x.jiraIssueKey) &&
  service.jsmWorkPlanSyncMode === "create_in_linked_space" && service.jsmBillingSyncMode === "create_in_linked_space" &&
  tables.recurringServiceSlaConfig.length===0 && liveMappings.length===2;
const alreadyApplied = service.jsmWorkPlanSyncMode==="external_reference" &&
  service.jsmBillingSyncMode==="external_reference" && liveMappings.length===0 &&
  work.length===12 && work.every(x=>!x.jiraIssueKey && x.itemType!=="facturacion");
if (alreadyApplied) { console.log(JSON.stringify({id,mode:"already_applied",workPlan:work.length,billing:billing.length})); process.exit(0); }
if (!initial) throw new Error("El estado no coincide con la precondición de remediación; no se escribieron datos.");
const sow = tables.recurringServiceDocuments.find(d=>d.docType==="sow");
if (!sow) throw new Error("Falta SoW de referencia.");
const reportDueDates: string[] = [];
for (let month=1; month<=3; month++) {
  const end=new Date(`${service.formalStartDate}T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth()+month);
  end.setUTCDate(end.getUTCDate()-1);
  reportDueDates.push((await calculateDeadlineDate(end,3)).toISOString().slice(0,10));
}
const desired = buildStaffingContractPlan({
  durationMonths:3, reportDueDates, approvalDueDates:[null,null,null],
  reportDeliveryBusinessDays:3, approvalWindowBusinessDays:3,
}).map((item,index)=>({
  serviceId:id, itemType:item.itemType as "tarea_programada"|"informe_mensual",
  title:item.title, description:item.description ?? null, frequency:item.frequency ?? null,
  dueDate:item.dueDate ?? null, monthNumber:item.monthNumber ?? null,
  status:"pendiente" as const, sortOrder:index,
}));
if (desired.length !== 12 || desired.some(x=>x.title.includes("Factura")||x.title.includes("SLA"))) throw new Error("Plan deseado inválido.");
const fingerprint = createHash("sha256").update(JSON.stringify({service:rows,work,billing,mappings,stages:tables.recurringServiceStages})).digest("hex");
const backup = {id, createdAt:new Date().toISOString(), sourceCommit:"3d5e41a9", fingerprint, tables};
if (!apply) {
  mkdirSync(root,{recursive:true,mode:0o700});
  chmodSync(root,0o700);
  writeFileSync(backupFile,JSON.stringify(backup,null,2),{mode:0o600,flag:"wx"});
  const sha=createHash("sha256").update(readFileSync(backupFile)).digest("hex");
  writeFileSync(`${backupFile}.sha256`,`${sha}  before.json\n`,{mode:0o600,flag:"wx"});
  console.log(JSON.stringify({mode:"dry-run",id,backupFile,sha256:sha,legacyItems:work.length,archivedLinks:work.filter(x=>x.jiraIssueKey).length,
    newItems:desired.map(x=>({title:x.title,dueDate:x.dueDate,month:x.monthNumber})),billingUnchanged:billing.map(x=>({id:x.id,amount:x.amount,currency:x.currency,dueDate:x.dueDate})), jiraWrites:false}));
  process.exit(0);
}
const stored = JSON.parse(readFileSync(backupFile,"utf8"));
const sha=createHash("sha256").update(readFileSync(backupFile)).digest("hex");
const expectedHash=readFileSync(`${backupFile}.sha256`,"utf8").trim().split(/\s+/)[0];
if (sha!==expectedHash || stored.fingerprint!==fingerprint || stored.id!==id) throw new Error("Respaldo o estado previo no coinciden; no se modificó nada.");
const oldLinks=work.filter(x=>x.jiraIssueKey).map(x=>({id:x.id,key:x.jiraIssueKey,title:x.title,type:x.itemType,month:x.monthNumber}));
await db.transaction(async tx=>{
  await tx.execute(sql`SELECT id FROM recurring_services WHERE id = ${id} FOR UPDATE`);
  const [fresh]=await tx.select().from(recurringServices).where(eq(recurringServices.id,id));
  const freshPlan=await tx.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id));
  const freshBilling=await tx.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,id));
  const freshMappings=await tx.select().from(recurringServiceJsmIssueTypeMappings).where(eq(recurringServiceJsmIssueTypeMappings.serviceId,id));
  if (createHash("sha256").update(JSON.stringify({service:[fresh],work:freshPlan,billing:freshBilling,mappings:freshMappings,stages:tables.recurringServiceStages})).digest("hex") !== fingerprint)
    throw new Error("Cambio concurrente en ficha, plan, cuotas o mappings.");
  await tx.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id));
  await tx.insert(recurringServiceWorkPlan).values(desired);
  await tx.update(recurringServiceJsmIssueTypeMappings).set({status:"superseded"}).where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId,id),eq(recurringServiceJsmIssueTypeMappings.status,"active")));
  await tx.update(recurringServices).set({
    jsmWorkPlanSyncMode:"external_reference",jsmBillingSyncMode:"external_reference",
    jsmSyncPolicyReason:"Staffing Deal 4687: capacidad, horas y reportes se controlan con el SoW y el backlog existente; los tres hitos UF ya existen en Jira. No crear nuevos issues JSM ni inferir factura emitida.",
    jsmSyncPolicyUpdatedAt:new Date(),jsmSyncPolicyUpdatedBy:null,
  }).where(eq(recurringServices.id,id));
  await tx.insert(auditLogs).values({
    action:"remediate_staffing_4687_configuration",entity:"recurring_service",entityId:String(id),entityName:service.serviceName,
    userName:"Manus AI",userRole:"system",details:{authorizedBy:"Keno, 2026-10-01",backupFile,backupSha256:sha,sourceCommit:"3d5e41a9",sowId:sow.id,
      previous:{planCount:work.length,activeMappings:liveMappings.length},desired:{planCount:12,workPlanMode:"external_reference",billingMode:"external_reference"},
      archivedLinkedItems:oldLinks, legacyPlan:work.map(x=>({id:x.id,type:x.itemType,title:x.title,description:x.description,dueDate:x.dueDate,month:x.monthNumber,status:x.status,key:x.jiraIssueKey})),
      preservedBillingIds:billing.map(x=>x.id),jiraWrites:false,invoiceStatusChanged:false,stageChanged:false},
  });
});
const [after]=await db.select().from(recurringServices).where(eq(recurringServices.id,id));
const newWork=await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id));
const newBilling=await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,id));
const newMappings=await db.select().from(recurringServiceJsmIssueTypeMappings).where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId,id),eq(recurringServiceJsmIssueTypeMappings.status,"active")));
const readiness=calculateJsmSetupReadiness({platform:after.jsmPlatform,projectKey:after.jsmProjectKey,workItems:newWork,billing:newBilling,mappings:newMappings,workPlanMode:after.jsmWorkPlanSyncMode,billingMode:after.jsmBillingSyncMode});
if (!readiness.canClose || newWork.length!==12 || newBilling.map(x=>x.id).join()!==billing.map(x=>x.id).join()) throw new Error("Verificación posterior incompleta: revisar respaldo y base antes de avanzar.");
console.log(JSON.stringify({mode:"applied",id,readiness,workPlan:newWork.length,archivedLinks:oldLinks.length,activeMappings:newMappings.length,billingPreserved:newBilling.length,stage:after.currentStage,backupSha256:sha,jiraWrites:false}));
process.exit(0);
