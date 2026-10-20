import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { projects, executiveProjectSources, executiveContractMilestones, executiveMilestoneAcceptances, billingMilestones, auditLogs } from "../drizzle/schema";
import { getDb } from "../server/db";
import { searchJiraIssues } from "../server/jiraClient";
import { buildProjectMilestoneRefreshPlan, type RefreshJiraIssue } from "../server/jiraProjectMilestoneRefresh";

const id=180003, sourceId=30001, key="PCIAD4";
const root="/home/ubuntu/backups/prodigio-pmo/2026-10-20-consalud-4529-milestones";
const apply=process.argv.includes("--apply");
const db=await getDb();
if(db==null) throw new Error("Base de datos no disponible.");
const hash=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function snapshot(conn: NonNullable<typeof db>) {
 return {
  project:await conn.select().from(projects).where(eq(projects.id,id)),
  source:await conn.select().from(executiveProjectSources).where(eq(executiveProjectSources.id,sourceId)),
  milestones:await conn.select().from(executiveContractMilestones).where(eq(executiveContractMilestones.projectId,id)).orderBy(executiveContractMilestones.id),
  acceptances:await conn.select().from(executiveMilestoneAcceptances).where(eq(executiveMilestoneAcceptances.projectId,id)).orderBy(executiveMilestoneAcceptances.id),
  billing:await conn.select().from(billingMilestones).where(eq(billingMilestones.projectId,id)).orderBy(billingMilestones.id),
 };
}
const before=await snapshot(db);
const project=before.project[0], source=before.source[0];
if(project?.jiraProjectKey!==key || !project.projectName.includes("4529") || source?.projectId!==id || source.sourceStatus!=="approved" || !source.contractFileName.startsWith("baseline-jira-") || before.milestones.some(x=>x.sourceId!==sourceId)) throw new Error("El proyecto o su fuente cambió; detener sin escritura.");
let nextPageToken:string|undefined;
const issues:RefreshJiraIssue[]=[];
for(let page=0;page<10;page++){
 const response=await searchJiraIssues(`project=${key} AND issuetype="Hito PMO" ORDER BY key`,{maxResults:100,nextPageToken,fields:["summary","issuetype","status","duedate","resolutiondate","updated"]});
 issues.push(...response.issues as RefreshJiraIssue[]);
 if(response.isLast || !response.nextPageToken || response.issues.length===0) break;
 nextPageToken=response.nextPageToken;
 if(page===9) throw new Error("Paginación incompleta; no escribir.");
}
if(issues.map(x=>x.key).sort().join()!==["PCIAD4-11","PCIAD4-12","PCIAD4-13","PCIAD4-49"].sort().join()) throw new Error("Inventario Jira cambió: revisar nuevos hitos antes de aplicar.");
const now=new Date();
const plan=buildProjectMilestoneRefreshPlan({existing:before.milestones,issues,projectKey:key,syncObservedWeights:true,now});
if(plan.created===0 && plan.updated===0){console.log(JSON.stringify({mode:"already_synchronized",id,rows:plan.rows,totalWeight:plan.totalWeight,jiraWrites:false}));process.exit(0);}
const fingerprint=hash(before), jiraFingerprint=hash(issues);
if(!apply){
 mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
 const data=JSON.stringify({id,sourceId,key,createdAt:now.toISOString(),sourceCommit:"6337567f",fingerprint,jiraFingerprint,before,issues,plan},null,2);
 writeFileSync(`${root}/before.json`,data,{mode:0o600,flag:"wx"});
 const sha=createHash("sha256").update(data).digest("hex");
 writeFileSync(`${root}/before.json.sha256`,`${sha}  before.json\n`,{mode:0o600,flag:"wx"});
 console.log(JSON.stringify({mode:"dry_run",id,backup:`${root}/before.json`,sha256:sha,created:plan.created,updated:plan.updated,totalWeight:plan.totalWeight,rows:plan.rows,jiraWrites:false}));process.exit(0);
}
const data=readFileSync(`${root}/before.json`);
const stored=JSON.parse(data.toString("utf8"));
const backupHash=createHash("sha256").update(data).digest("hex");
const expectedHash=readFileSync(`${root}/before.json.sha256`,"utf8").trim().split(/\s+/)[0];
if(backupHash!==expectedHash || stored.fingerprint!==fingerprint || stored.jiraFingerprint!==jiraFingerprint) throw new Error("Checksum, estado PMO o lectura Jira cambió; no escribir.");
await db.transaction(async tx=>{
 await tx.execute(sql`SELECT id FROM projects WHERE id=${id} FOR UPDATE`);
 await tx.execute(sql`SELECT id FROM executive_project_sources WHERE id=${sourceId} FOR UPDATE`);
 const fresh=await snapshot(tx as unknown as NonNullable<typeof db>);
 if(hash(fresh)!==fingerprint) throw new Error("Cambio concurrente de PMO; transacción cancelada.");
 for(const row of plan.rows){
  const note=`Observación Jira ${now.toISOString()}: título, porcentaje y programación sincronizados por solicitud del usuario 2026-10-20. Peso Jira referencial; no es nueva aprobación contractual, acta ni factura. Baseline contractual preservado.`;
  if(row.id==null){
   await tx.insert(executiveContractMilestones).values({projectId:id,sourceId,milestoneCode:row.milestoneCode,jiraIssueKey:row.jiraIssueKey,baselineDate:null,...row.values,lastObservedAt:now,reconciliationNotes:note,isCritical:false});
  }else if(row.changed){
   const previous=before.milestones.find(x=>x.id===row.id);
   await tx.update(executiveContractMilestones).set({...row.values,lastObservedAt:now,reconciliationNotes:[previous?.reconciliationNotes,note].filter(Boolean).join("\n")}).where(and(eq(executiveContractMilestones.id,row.id),eq(executiveContractMilestones.projectId,id)));
  }
 }
 await tx.insert(auditLogs).values({action:"sync_consalud_4529_milestones",entity:"project",entityId:String(id),entityName:project.projectName,userName:"Manus AI",userRole:"system",details:{authorizedBy:"Usuario: actualiza y sincroniza, 2026-10-20",backupFile:`${root}/before.json`,backupSha256:backupHash,sourceId,sourceCommit:"6337567f",created:plan.created,updated:plan.updated,observedWeights:plan.rows.map(x=>({key:x.jiraIssueKey,weight:x.values.billingWeight})),beforeMilestones:before.milestones,plan,jiraWrites:false,contractDatesChanged:false,sourceApprovalChanged:false,acceptancesChanged:false,invoicesChanged:false,financialWorkbookChanged:false}});
});
const after=await snapshot(db);
const verification=buildProjectMilestoneRefreshPlan({existing:after.milestones,issues,projectKey:key,syncObservedWeights:true,now});
if(verification.created!==0 || verification.updated!==0 || hash({...before,milestones:[]})!==hash({...after,milestones:[]}) || before.milestones.some(old=>after.milestones.find(x=>x.id===old.id)?.baselineDate!==old.baselineDate)) throw new Error("Verificación posterior falló: detener antes de otro cambio.");
writeFileSync(`${root}/after.json`,JSON.stringify({id,observedAt:now.toISOString(),after,verification,backupHash},null,2),{mode:0o600,flag:"wx"});
console.log(JSON.stringify({mode:"applied",id,created:plan.created,updated:plan.updated,milestones:after.milestones.map(x=>({id:x.id,code:x.milestoneCode,key:x.jiraIssueKey,weight:x.billingWeight,baseline:x.baselineDate,due:x.jiraDueDate,status:x.jiraStatusName,closed:x.jiraClosedDate,lastObserved:x.lastObservedAt})),totalWeight:plan.totalWeight,backupHash,jiraWrites:false,immutableRecordsPreserved:true}));
process.exit(0);
