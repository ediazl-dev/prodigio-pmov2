import {getDb} from "../server/db";
import {recurringServices,recurringServiceStages,recurringServiceBillingMonths,recurringServiceWorkPlan,recurringServiceDocuments,recurringServiceReportEvidence,recurringServiceFinancialEvidence,recurringServicePenalties,recurringServiceSlaConfig,documentArtifacts,documentValidationDecisions} from "../drizzle/schema";
import {eq,and} from "drizzle-orm";
import {mkdirSync,chmodSync,writeFileSync,readFileSync} from "node:fs";
import {createHash} from "node:crypto";
(async()=>{
 const db=await getDb();if(!db)throw Error("Base de datos no disponible");const id=2040001;
 const state={
 service:await db.select().from(recurringServices).where(eq(recurringServices.id,id)),
 stages:await db.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId,id)).orderBy(recurringServiceStages.id),
 billing:await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,id)).orderBy(recurringServiceBillingMonths.id),
 plan:await db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,id)).orderBy(recurringServiceWorkPlan.id),
 documents:await db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId,id)).orderBy(recurringServiceDocuments.id),
 reports:await db.select().from(recurringServiceReportEvidence).where(eq(recurringServiceReportEvidence.serviceId,id)).orderBy(recurringServiceReportEvidence.id),
 financialEvidence:await db.select().from(recurringServiceFinancialEvidence).where(eq(recurringServiceFinancialEvidence.serviceId,id)).orderBy(recurringServiceFinancialEvidence.id),
 penalties:await db.select().from(recurringServicePenalties).where(eq(recurringServicePenalties.serviceId,id)).orderBy(recurringServicePenalties.id),
 sla:await db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId,id)).orderBy(recurringServiceSlaConfig.id),
 artifacts:await db.select().from(documentArtifacts).where(and(eq(documentArtifacts.entityType,"recurring_service"),eq(documentArtifacts.entityId,id))).orderBy(documentArtifacts.id),
 decisions:await db.select().from(documentValidationDecisions).where(and(eq(documentValidationDecisions.entityType,"recurring_service"),eq(documentValidationDecisions.entityId,id))).orderBy(documentValidationDecisions.id),
 };
 if(state.service[0]?.status!=="completado" || state.service[0]?.currentStage!=="cierre")throw Error("El servicio ya no está cerrado; detener corrección.");
 const root="/home/ubuntu/backups/prodigio-pmo/2026-10-20-staffing-4687-read-only-lock",text=JSON.stringify(state,null,2),sha=createHash("sha256").update(text).digest("hex");
 if(process.argv.includes("--verify")){
  const before=readFileSync(`${root}/before.json`);const original=createHash("sha256").update(before).digest("hex");
  if(original!==readFileSync(`${root}/before.json.sha256`,"utf8").trim().split(/\s+/)[0] || original!==sha)throw Error("Datos del servicio cambiaron: investigar, no sobrescribir ni restaurar automáticamente.");
  console.log(JSON.stringify({mode:"verified",serviceId:id,status:state.service[0].status,sha256:sha,unchanged:true,billingItems:state.billing.length,planItems:state.plan.length}));
 }else{
  mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);writeFileSync(`${root}/before.json`,text,{mode:0o600,flag:"wx"});writeFileSync(`${root}/before.json.sha256`,`${sha}  before.json\n`,{mode:0o600,flag:"wx"});
  console.log(JSON.stringify({mode:"read_only_backup",serviceId:id,status:state.service[0].status,sha256:sha,backup:`${root}/before.json`,billingKeys:state.billing.map(x=>x.jiraIssueKey),entityWrites:false}));
 }
 process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
