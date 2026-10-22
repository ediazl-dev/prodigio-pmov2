import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { getDb } from '../server/db';
import { projects, projectStages, wbsTasks, executiveProjectSources, executiveContractMilestones, documentArtifacts, documentValidationDecisions, billingMilestones, risks, users, adminSettings, auditLogs, holidays } from '../drizzle/schema';
import { storagePut } from '../server/storage';
import { buildNexosInternalPlan, type NexosInternalManifest, type InternalPlanJiraIssue } from '../server/nexosInternalPlan';

const ID=4470001, ROOT='/home/ubuntu/backups/prodigio-pmo/2026-10-21-nexos-4470001-internal';
const FILE='/home/ubuntu/upload/Plan_Multitenant_NEXOS_SFA_BCI.xlsx';
const KEY=`project.internal-work-plan.v1.${ID}`, VERSION='internal-plan-2026-10-19-v1';
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
async function main(){
 const apply=process.argv.includes('--apply');
 const db=await getDb();if(!db)throw Error('DB no disponible');
 const [project]=await db.select().from(projects).where(eq(projects.id,ID));
 if(!project||project.projectName!=='NEXOS_SFA_Multitenant'||project.jiraProjectKey!=='PMOPRONEX'||project.status!=='activo')throw Error('Identidad/lifecycle no coincide');
 const [actor]=await db.select().from(users).where(eq(users.email,'ediazl@prodigio.tech'));
 if(!actor||!['admin','pmo'].includes(actor.role))throw Error('Actor autorizado no disponible');
 const manifest=JSON.parse(readFileSync(`${ROOT}/plan-manifest.json`,'utf8')) as NexosInternalManifest;
 const bytes=readFileSync(FILE);if(createHash('sha256').update(bytes).digest('hex')!==manifest.sha256)throw Error('Hash Excel cambió');
 const issueSnapshot=JSON.parse(readFileSync(`${ROOT}/nexos-internal-jira-full.json`,'utf8')) as {issues:InternalPlanJiraIssue[]};
 const hs=await db.select().from(holidays);
 const plan=buildNexosInternalPlan(manifest,issueSnapshot.issues,'2026-10-19',hs.map(h=>h.date));
 const before={project,stages:await db.select().from(projectStages).where(eq(projectStages.projectId,ID)),wbs:await db.select().from(wbsTasks).where(eq(wbsTasks.projectId,ID)),billing:await db.select().from(billingMilestones).where(eq(billingMilestones.projectId,ID)),risks:await db.select().from(risks).where(eq(risks.projectId,ID)),sources:await db.select().from(executiveProjectSources).where(eq(executiveProjectSources.projectId,ID)),milestones:await db.select().from(executiveContractMilestones).where(eq(executiveContractMilestones.projectId,ID)),artifacts:await db.select().from(documentArtifacts).where(and(eq(documentArtifacts.entityType,'project'),eq(documentArtifacts.entityId,ID))),settings:await db.select().from(adminSettings).where(eq(adminSettings.key,KEY))};
 if(!existsSync(`${ROOT}/before-plan-import.json`)){writeFileSync(`${ROOT}/before-plan-import.json`,JSON.stringify(before,null,2)+'\n',{mode:0o600,flag:'wx'});writeFileSync(`${ROOT}/before-plan-import.json.sha256`,createHash('sha256').update(readFileSync(`${ROOT}/before-plan-import.json`)).digest('hex')+'  before-plan-import.json\n',{mode:0o600,flag:'wx'});}
 if(before.billing.length)throw Error('Existen cuotas: no se alteran automáticamente');
 if(before.sources.length){
  const source=before.sources.find(s=>s.baselineVersion===VERSION);
  if(!source||before.wbs.length!==24||before.milestones.length!==4||!before.settings[0])throw Error('Importación parcial o fuente distinta: revisar sin sobrescribir');
  const previous=JSON.parse(before.settings[0].value||'null');
  if(previous?.sha256!==manifest.sha256||previous?.baselineStartDate!==plan.baselineStartDate)throw Error('Plan persistido no coincide');
  console.log(JSON.stringify({status:'already_applied',projectId:ID,activities:plan.activities.length,gates:plan.gates.map(g=>({code:g.code,baseline:g.baselineDate,jira:g.jiraDueDate})),billing:0}));return;
 }
 if(before.wbs.length)throw Error('WBS previo no vacío; no se sustituye');
 console.log(JSON.stringify({mode:apply?'apply':'dry_run',projectId:ID,financialMode:'internal',activities:19,epics:5,gates:plan.gates.map(g=>({code:g.code,base:g.baselineDate,jira:g.jiraDueDate})),start:plan.baselineStartDate,end:plan.gates.find(g=>g.code==='G3')?.baselineDate,billingCreations:0,stagesUnchanged:true},null,2));
 if(!apply)return;
 let upload:{key:string;url:string};
 const receiptPath=`${ROOT}/plan-storage-receipt.json`;
 if(existsSync(receiptPath))upload=JSON.parse(readFileSync(receiptPath,'utf8'));
 else{upload=await storagePut(`projects/${ID}/internal-plan/${manifest.sha256}.xlsx`,bytes,'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');writeFileSync(receiptPath,JSON.stringify(upload),{mode:0o600,flag:'wx'});}
 const now=new Date();
 await db.transaction(async tx=>{
  await tx.execute(sql`UPDATE projects SET financialMode = 'internal', startDate = '2026-10-19', endDate = '2026-11-06' WHERE id = ${ID}`);
  const [ar]=await tx.insert(documentArtifacts).values({entityType:'project',entityId:ID,requirementCode:'work_plan_milestones',sourceKind:'platform_upload',sourceReference:'Plan interno cargado por CEO; inicio confirmado 19-10-2026; no es contrato ni factura.',fileName:manifest.fileName,fileUrl:upload.url,fileKey:upload.key,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',sizeBytes:bytes.length,sha256:manifest.sha256,uploadedBy:actor.id,uploadedByName:actor.name,version:1});
  const artifactId=Number(ar.insertId);if(!artifactId)throw Error('ID de artefacto no disponible');
  await tx.insert(documentValidationDecisions).values({artifactId,entityType:'project',entityId:ID,requirementCode:'work_plan_milestones',policyVersion:'2026-10-21.v2',decision:'pending',costingStatus:'not_applicable',reason:'Carga del plan interno; la revisión documental y aceptación de entregables no se infieren.',decidedBy:actor.id,decidedByName:actor.name});
  const [sr]=await tx.insert(executiveProjectSources).values({projectId:ID,dealId:'',jiraProjectKey:'PMOPRONEX',baselineVersion:VERSION,contractDocumentId:artifactId,contractFileName:manifest.fileName,contractFileUrl:upload.url,contractSha256:manifest.sha256,sourceStatus:'approved',approvedAt:now,approvedBy:actor.id,approvedByName:actor.name,approvalNotes:'Línea base INTERNA del Excel aportado y autorizada por el CEO; Día1 19-10-2026 confirmado expresamente. No es baseline contractual ni aceptación de gates. Fechas planificadas Jira preservadas.'});
  const sourceId=Number(sr.insertId);if(!sourceId)throw Error('ID de fuente no disponible');
  for(const epic of issueSnapshot.issues.filter(i=>i.fields.issuetype?.name==='Epic'))await tx.insert(wbsTasks).values({projectId:ID,taskCode:epic.key,taskName:epic.fields.summary,phase:'por_confirmar',issueLevel:'epic',epicCode:epic.key,jiraIssueKey:epic.key,jiraTaskId:epic.key,jiraStatusName:epic.fields.status?.name,jiraStatusCategory:epic.fields.status?.statusCategory?.key});
  const phaseFor=(track:string):'analisis'|'construccion'|'cierre'|'por_confirmar'=>track==='Software'?'analisis':track==='Infraestructura'||track==='Despliegue'||track==='Testing'?'construccion':track==='Cierre'?'cierre':'por_confirmar';
  for(const task of plan.activities)await tx.insert(wbsTasks).values({projectId:ID,taskCode:task.code,taskName:task.title,phase:phaseFor(task.track),expected:String(task.plannedDays),dependencies:task.dependency,assignee:task.owner,issueLevel:task.gate?'milestone':'task',epicCode:task.jiraParentKey,jiraIssueKey:task.jiraIssueKey,jiraTaskId:task.jiraIssueKey,jiraParentKey:task.jiraParentKey,jiraStatusName:task.jiraStatusName,jiraStatusCategory:task.jiraStatusCategory,acceptanceCriteria:`${task.deliverable}\n${task.notes||''}\nPlan interno: D${task.startDay}–D${task.endDay}; línea base ${task.baselineStartDate} a ${task.baselineEndDate}; Jira ${task.jiraDueDate||'N/D'}; avance Excel ${task.progress}. Duración planificada, no estimación PERT.`});
  for(const gate of plan.gates)await tx.insert(executiveContractMilestones).values({projectId:ID,sourceId,milestoneCode:gate.code,title:gate.title.slice(0,500),billingWeight:'0.00',baselineDate:gate.baselineDate,jiraIssueKey:gate.jiraIssueKey,jiraDueDate:gate.jiraDueDate,jiraStatusName:gate.jiraStatusName,semanticStatus:'pending',isCritical:true,lastObservedAt:now,reconciliationNotes:`Entrega interna sin ingresos: ${gate.criterion}. Evidencia requerida: ${gate.evidence}. Carga no equivale a aceptación.`});
  await tx.insert(adminSettings).values({key:KEY,value:JSON.stringify({...plan,sha256:manifest.sha256,fileName:manifest.fileName,sourceId,artifactId}),description:'Plan interno NEXOS; no ingreso/factura; fechas internas y Jira separadas'});
  await tx.insert(auditLogs).values({userId:actor.id,userName:actor.name,userRole:actor.role,action:'configure_internal_project_plan',entity:'project',entityId:ID,entityName:project.projectName,details:{sourceId,artifactId,sha256:manifest.sha256,baselineStart:'2026-10-19',activities:19,epics:5,gates:4,billingCreations:0,riskConfirmations:0,jiraWrites:0,stageClosures:0}});
 });
 const after={project:(await db.select().from(projects).where(eq(projects.id,ID)))[0],stages:await db.select().from(projectStages).where(eq(projectStages.projectId,ID)),billing:await db.select().from(billingMilestones).where(eq(billingMilestones.projectId,ID)),risks:await db.select().from(risks).where(eq(risks.projectId,ID)),wbs:await db.select().from(wbsTasks).where(eq(wbsTasks.projectId,ID)),milestones:await db.select().from(executiveContractMilestones).where(eq(executiveContractMilestones.projectId,ID))};
 if(hash(before.stages)!==hash(after.stages)||hash(before.billing)!==hash(after.billing)||hash(before.risks)!==hash(after.risks))throw Error('Invariante de etapa/facturación/riesgos falló');
 if(after.wbs.length!==24||after.milestones.length!==4)throw Error('Cardinalidad final incorrecta');
 writeFileSync(`${ROOT}/after-plan-import.json`,JSON.stringify(after,null,2)+'\n',{mode:0o600});console.log('APPLIED: 19 actividades, 5 épicas, 4 entregables internos; cero factura/Jira/cierre/confirmación.');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
