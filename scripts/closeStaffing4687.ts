import {createHash} from "node:crypto";
import {mkdirSync,chmodSync,readFileSync,writeFileSync} from "node:fs";
import {and,eq,sql} from "drizzle-orm";
import {users,recurringServices,recurringServiceStages,recurringServiceBillingMonths,recurringServiceWorkPlan,recurringServiceDocuments,recurringServiceReportEvidence,recurringServiceFinancialEvidence,recurringServicePenalties,recurringServiceSlaConfig,documentArtifacts,documentValidationDecisions,auditLogs} from "../drizzle/schema";
import {getDb} from "../server/db";
import {searchJiraIssues} from "../server/jiraClient";
import {loadRecurringServiceJiraBillingEvidence} from "../server/jiraBillingEvidence";
import {buildStaffing4687ClosurePlan} from "../server/staffing4687ClosurePolicy";

const id=2040001,root="/home/ubuntu/backups/prodigio-pmo/2026-10-20-staffing-4687-closure";
const apply=process.argv.includes("--apply"),db=await getDb();
if(!db)throw new Error("Base de datos no disponible.");
const [actor]=await db.select({id:users.id,name:users.name,role:users.role}).from(users).where(eq(users.openId,process.env.OWNER_OPEN_ID??"")).limit(1);
if(!actor || actor.role!=="admin")throw new Error("No se identificó al propietario admin autorizado.");
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function snapshot(conn:NonNullable<typeof db>){
 return {
  service:await conn.select().from(recurringServices).where(eq(recurringServices.id,id)),
  stages:await conn.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId,id)).orderBy(recurringServiceStages.id),
  billing:await conn.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,id)).orderBy(recurringServiceBillingMonths.id),
  plan:await conn.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id)).orderBy(recurringServiceWorkPlan.id),
  documents:await conn.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId,id)).orderBy(recurringServiceDocuments.id),
  reports:await conn.select().from(recurringServiceReportEvidence).where(eq(recurringServiceReportEvidence.serviceId,id)).orderBy(recurringServiceReportEvidence.id),
  financialEvidence:await conn.select().from(recurringServiceFinancialEvidence).where(eq(recurringServiceFinancialEvidence.serviceId,id)).orderBy(recurringServiceFinancialEvidence.id),
  penalties:await conn.select().from(recurringServicePenalties).where(eq(recurringServicePenalties.serviceId,id)).orderBy(recurringServicePenalties.id),
  sla:await conn.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId,id)).orderBy(recurringServiceSlaConfig.id),
  artifacts:await conn.select().from(documentArtifacts).where(and(eq(documentArtifacts.entityId,id),eq(documentArtifacts.entityType,"recurring_service"))).orderBy(documentArtifacts.id),
  decisions:await conn.select().from(documentValidationDecisions).where(and(eq(documentValidationDecisions.entityId,id),eq(documentValidationDecisions.entityType,"recurring_service"))).orderBy(documentValidationDecisions.id),
 };
}
const before=await snapshot(db),now=new Date();
const jira=await searchJiraIssues("key in (CONSALOP01-20,CONSALOP01-21,CONSALOP01-22,CONSALOP01-23) ORDER BY key",{maxResults:10,fields:["*all"]});
if(jira.issues.length!==4 || (jira.nextPageToken&&!jira.isLast))throw new Error("Lectura Jira incompleta.");
const plan=buildStaffing4687ClosurePlan({service:before.service[0],billing:before.billing,stages:before.stages,issues:jira.issues,closedAt:now.toISOString(),actorId:actor.id});
if(plan.alreadyClosed){console.log(JSON.stringify({mode:"already_closed",serviceId:id,bindings:plan.bindings,jiraWrites:false}));process.exit(0);}
const jiraEvidence=await loadRecurringServiceJiraBillingEvidence(id);
if(jiraEvidence.summary.totalItems!==3 || jiraEvidence.summary.unknownItems!==3)throw new Error("La evidencia de factura cambió; revisar antes de cerrar.");
const fingerprint=hash(before),jiraFingerprint=hash(jira.issues);
if(!apply){
 mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
 const text=JSON.stringify({serviceId:id,sourceCommit:"f6d95f1f",createdAt:now.toISOString(),fingerprint,jiraFingerprint,actor,before,jira,jiraEvidence,plan},null,2);
 writeFileSync(`${root}/before.json`,text,{mode:0o600,flag:"wx"});
 const sha=createHash("sha256").update(text).digest("hex");writeFileSync(`${root}/before.json.sha256`,`${sha}  before.json\n`,{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({mode:"dry_run",serviceId:id,backup:`${root}/before.json`,sha256:sha,bindings:plan.bindings,originalKey:"CONSALOP01-23",excludedCandidate:"CONSALOP01-20",desiredStatus:plan.serviceUpdate,stageUpdates:plan.stageUpdates.map(x=>x.id),billingPreserved:3,invoiceUnknown:3,jiraWrites:false}));process.exit(0);
}
const text=readFileSync(`${root}/before.json`),stored=JSON.parse(text.toString("utf8"));
const sha=createHash("sha256").update(text).digest("hex");
if(sha!==readFileSync(`${root}/before.json.sha256`,"utf8").trim().split(/\s+/)[0] || fingerprint!==stored.fingerprint || jiraFingerprint!==stored.jiraFingerprint)throw new Error("Checksum o estado previo cambió: no escribir.");
await db.transaction(async tx=>{
 await tx.execute(sql`SELECT id FROM recurring_services WHERE id=${id} FOR UPDATE`);
 await tx.execute(sql`SELECT id FROM recurring_service_stages WHERE serviceId=${id} FOR UPDATE`);
 await tx.execute(sql`SELECT id FROM recurring_service_billing_months WHERE serviceId=${id} FOR UPDATE`);
 if(hash(await snapshot(tx as unknown as NonNullable<typeof db>))!==fingerprint)throw new Error("Cambio concurrente; cierre cancelado.");
 for(const binding of plan.bindings){
  const previous=before.billing.find(x=>x.monthNumber===binding.monthNumber)!;
  await tx.update(recurringServiceBillingMonths).set({jiraIssueKey:binding.jiraIssueKey,notes:[previous.notes,`Vínculo canónico confirmado ${now.toISOString()}: ${binding.jiraIssueKey}. M01 conserva el original -23; -20 posterior excluido del vínculo PMO, no eliminado en Jira. Estado de facturación no alterado.`].filter(Boolean).join("\n")}).where(and(eq(recurringServiceBillingMonths.id,previous.id),eq(recurringServiceBillingMonths.serviceId,id)));
 }
 for(const stage of plan.stageUpdates)await tx.update(recurringServiceStages).set({status:"completed",completedAt:now,completedBy:actor.id,data:stage.data}).where(and(eq(recurringServiceStages.id,stage.id),eq(recurringServiceStages.serviceId,id)));
 await tx.update(recurringServices).set(plan.serviceUpdate).where(eq(recurringServices.id,id));
 await tx.insert(auditLogs).values({action:"administrative_close_staffing_4687",entity:"recurring_service",entityId:String(id),entityName:before.service[0].serviceName,userId:actor.id,userName:actor.name,userRole:actor.role,details:{authorizedBy:"Usuario: resolver duplicado hito y cerrar el servicio, 20-10-2026",executedBy:"Manus",backupFile:`${root}/before.json`,backupSha256:sha,sourceCommit:"f6d95f1f",beforeStatus:before.service[0].status,beforeStage:before.service[0].currentStage,closure:plan.closureData,stageTerminatedAdministratively:"ejecucion",jiraWrites:false,externalIssueDeleted:false,invoiceStatusChanged:false,operationalItemsCompleted:false,contractDatesChanged:false,historicalFinancialDataChanged:false}});
});
const after=await snapshot(db);
const stable=(b:typeof before)=>({plan:b.plan,documents:b.documents,reports:b.reports,financialEvidence:b.financialEvidence,penalties:b.penalties,sla:b.sla,artifacts:b.artifacts,decisions:b.decisions,billing:b.billing.map(({jiraIssueKey,notes,...rest})=>rest),stages:b.stages.filter(x=>!["ejecucion","cierre"].includes(x.stageId)),service:b.service.map(({status,currentStage,updatedAt,...rest})=>rest)});
if(hash(stable(before))!==hash(stable(after)))throw new Error("Verificación de preservación falló; detener y revisar respaldo.");
const afterEvidence=await loadRecurringServiceJiraBillingEvidence(id);
if(after.service[0].status!=="completado" || after.service[0].currentStage!=="cierre" || afterEvidence.summary.totalItems!==3 || afterEvidence.summary.duplicateGroups!==0 || afterEvidence.summary.unknownItems!==3 || afterEvidence.items.map(x=>x.key).join()!==plan.bindings.map(x=>x.jiraIssueKey).join())throw new Error("Cierre o deduplicación no quedó confirmado.");
writeFileSync(`${root}/after.json`,JSON.stringify({after,afterEvidence,closedAt:now.toISOString(),backupSha256:sha},null,2),{mode:0o600,flag:"wx"});
console.log(JSON.stringify({mode:"applied",serviceId:id,status:after.service[0].status,stage:after.service[0].currentStage,closureDate:now.toISOString(),billingKeys:afterEvidence.items.map(x=>x.key),items:afterEvidence.summary.totalItems,duplicateGroups:afterEvidence.summary.duplicateGroups,invoiceUnknown:afterEvidence.summary.unknownItems,billingUF:after.billing.map(x=>x.amount),evidencePreserved:true,jiraWrites:false,backupSha256:sha}));process.exit(0);
