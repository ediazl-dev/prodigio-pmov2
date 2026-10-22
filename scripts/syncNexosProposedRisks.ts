import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb } from '../server/db';
import { projects, risks, users, auditLogs, projectStages, billingMilestones } from '../drizzle/schema';
import { getJiraProject, getJiraIssue, searchJiraIssues, createJiraIssue, transitionJiraIssue, getJiraRuntimeCredentials } from '../server/jiraClient';
import { mapNexosInternalRiskPlan } from '../server/nexosInternalRiskPlan';

const ID=4470001, SPACE='PMOPRONEX';
const DIR='/home/ubuntu/backups/prodigio-pmo/2026-10-21-nexos-4470001-proposed-risks';
const hash=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
function privateSave(name:string,value:any,overwrite=false){const path=`${DIR}/${name}`,text=JSON.stringify(value,null,2)+'\n';if(existsSync(path)&&!overwrite)return;writeFileSync(path,text,{mode:0o600,flag:overwrite?'w':'wx'});if(!overwrite)writeFileSync(`${path}.sha256`,createHash('sha256').update(text).digest('hex')+`  ${name}\n`,{mode:0o600,flag:'wx'});}
async function main(){
 mkdirSync(DIR,{recursive:true,mode:0o700});
 const db=await getDb();if(!db)throw Error('DB no disponible');
 const [project]=await db.select().from(projects).where(eq(projects.id,ID));
 if(!project||project.jiraProjectKey!==SPACE||(project as any).financialMode!=='internal')throw Error('Identidad/clasificación interna inválida');
 const [actor]=await db.select().from(users).where(eq(users.email,getJiraRuntimeCredentials().email));
 if(!actor||!['admin','pmo'].includes(actor.role))throw Error('Actor no autorizado');
 const original=await db.select().from(risks).where(eq(risks.projectId,ID));
 const stages=await db.select().from(projectStages).where(eq(projectStages.projectId,ID));
 const billing=await db.select().from(billingMilestones).where(eq(billingMilestones.projectId,ID));
 const proposed=mapNexosInternalRiskPlan(original as any[]) as typeof original;
 if(original.some(r=>r.confirmed))throw Error('La carga propuesta exige conservar las 18 confirmaciones en false');
 const jira=await getJiraProject(SPACE);
 if(!(jira.issueTypes||[]).some(t=>t.name==='Riesgos PMO'))throw Error('Tipo Riesgos PMO no disponible');
 privateSave('before.json',{project,risks:original,stages,billing,authorizedAsProposed:true,authorizedAt:'2026-10-21T23:56:26Z'});
 const journalPath=`${DIR}/journal.json`;
 const journal:any=existsSync(journalPath)?JSON.parse(readFileSync(journalPath,'utf8')):{projectId:ID,space:SPACE,items:{},draftTextApplied:false};
 const saveJournal=()=>privateSave('journal.json',journal,true);
 console.log(JSON.stringify({projectId:ID,risks:proposed.length,confirmedChanges:0,stageClosures:0,billingCreations:0,jiraExistingTasksPreserved:true},null,2));
 if(!process.argv.includes('--apply'))return;
 if(!journal.draftTextApplied){
  await db.transaction(async tx=>{
   for(const risk of proposed)await tx.update(risks).set({description:risk.description,mitigation:risk.mitigation,contingency:risk.contingency}).where(and(eq(risks.id,risk.id),eq(risks.projectId,ID)));
   await tx.insert(auditLogs).values({action:'load_internal_risk_proposals',entity:'project',entityId:ID,userId:actor.id,userName:actor.name,userRole:actor.role,details:{source:'Plan_Multitenant_NEXOS_SFA_BCI.xlsx',risks:18,confirmedChanged:false,approval:'pending_review'}});
  });journal.draftTextApplied=true;saveJournal();
 }
 for(let i=0;i<proposed.length;i++){
  const risk=proposed[i],label=`pmo-risk-${risk.id}`;
  let receipt=journal.items[risk.id];
  let key=risk.jiraIssueKey||receipt?.key;
  if(receipt?.status==='creating'&&!key)throw Error(`${risk.riskCode}: resultado incierto; no repetir POST`);
  if(!key){
   const found=await searchJiraIssues(`project = ${SPACE} AND labels = "${label}"`,{maxResults:3,fields:['project','summary','labels','status']});
   if(found.issues.length>1)throw Error(`${risk.riskCode}: más de un candidato`);
   if(found.issues.length===1)key=found.issues[0].key;
  }
  if(!key){
   journal.items[risk.id]={status:'creating',riskCode:risk.riskCode,startedAt:new Date().toISOString()};saveJournal();
   const description=[`RIESGO PROPUESTO — PENDIENTE DE REVISIÓN. No aprobado ni confirmado automáticamente.`,`Proyecto interno ${project.projectName}; sin ingresos ni facturación.`,`${risk.riskCode} — ${risk.description}`,`Probabilidad: ${risk.probability}. Impacto: ${risk.impact}. Categoría: ${risk.category}. Tipo: ${risk.type}.`,`Mitigación: ${risk.mitigation}`,`Contingencia: ${risk.contingency}`,`Responsable informado en PMO: ${risk.owner||'N/D'}. Fecha de compromiso: ${risk.dueDate||'pendiente de definición'}. Costo estimado informado: ${risk.estimatedCost||'N/D'}.`,`Fuente: Plan_Multitenant_NEXOS_SFA_BCI.xlsx; Día1 19-10-2026. Fuente/IDs PMO preservados. La carga no acredita ejecución ni aprobación.`].join('\n\n');
   const created=await createJiraIssue({projectKey:SPACE,issueTypeName:'Riesgos PMO',summary:`[PROPUESTO] ${risk.riskCode} — ${risk.description.slice(0,205)}`,description,labels:[label,'pmo-risk-proposed','pmo-project-4470001']});
   key=created.key;journal.items[risk.id]={status:'created',riskCode:risk.riskCode,key,id:created.id};saveJournal();
  }
  const item=await getJiraIssue(key);
  if(item.fields.project?.key!==SPACE||item.fields.issuetype?.name!=='Riesgos PMO'||!item.fields.labels?.includes(label))throw Error(`${risk.riskCode}: identidad Jira inválida`);
  let verified=item;
  let state=item.fields.status?.name||'';
  if(state.toLowerCase()!=='identificado'){
   if(!await transitionJiraIssue(key,'Identificado'))throw Error(`${risk.riskCode}: no fue posible estado Identificado`);
   verified=await getJiraIssue(key);state=verified.fields.status?.name||'';
  }
  if(state.toLowerCase()!=='identificado')throw Error(`${risk.riskCode}: estado final no verificado`);
  await db.update(risks).set({jiraIssueKey:key,jiraTaskId:item.id,jiraStatusName:state,jiraStatusCategory:verified.fields.status?.statusCategory?.key??null}).where(and(eq(risks.id,risk.id),eq(risks.projectId,ID)));
  journal.items[risk.id]={...journal.items[risk.id],key,id:item.id,status:'verified',jiraStatus:state};saveJournal();
  console.log(`VERIFY ${i+1}/18 ${risk.riskCode} -> ${key} Identificado; confirmación PMO=false`);
 }
 const after=await db.select().from(risks).where(eq(risks.projectId,ID));
 const invariant=(rows:typeof original)=>rows.map(({description,mitigation,contingency,jiraIssueKey,jiraTaskId,jiraStatusName,jiraStatusCategory,updatedAt,...r})=>r).sort((a,b)=>a.id-b.id);
 if(hash(invariant(original))!==hash(invariant(after))||after.some(r=>r.confirmed)||new Set(after.map(r=>r.jiraIssueKey)).size!==18)throw Error('Invariante de evaluación/confirmación/IDs falló');
 if(hash(stages)!==hash(await db.select().from(projectStages).where(eq(projectStages.projectId,ID)))||hash(billing)!==hash(await db.select().from(billingMilestones).where(eq(billingMilestones.projectId,ID))))throw Error('Cambio de etapa/facturación inesperado');
 privateSave('after.json',{risks:after,confirmed:0,linked:18,stagesPreserved:true,billingPreserved:true});
 console.log('DONE: 18 riesgos propuestos e identificados; cero aprobaciones/cierres; evaluaciones originales conservadas.');
}
main().then(()=>process.exit(0)).catch(error=>{console.error(error.message);process.exit(1)});
