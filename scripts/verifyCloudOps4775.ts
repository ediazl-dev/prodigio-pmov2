import {getDb} from '../server/db';
import {searchJiraIssues} from '../server/jiraClient';
import {loadRecurringServiceJiraBillingEvidence} from '../server/jiraBillingEvidence';
import {getJsmSyncConfiguration} from '../server/jsmRecurringSyncRunner';
import {recurringServices,recurringServiceBillingMonths,recurringServiceWorkPlan,recurringServiceStages} from '../drizzle/schema';
import {eq} from 'drizzle-orm';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ROOT='/home/ubuntu/4775-cloudops';
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const assert=(v:unknown,t:string)=>{if(!v)throw Error(t)};
(async()=>{
 const db=await getDb();if(!db)throw Error('No DB');
 async function snapshot(id:number){const s:any={};for(const[n,t]of Object.entries({service:recurringServices,billing:recurringServiceBillingMonths,plan:recurringServiceWorkPlan,stages:recurringServiceStages})){const tb:any=t;s[n]=await db!.select().from(tb).where(eq(n==='service'?tb.id:tb.serviceId,id)).orderBy(tb.id)}return s;}
 const s=await snapshot(3300001);
 assert(s.service[0].status==='activo'&&s.service[0].currentStage==='ejecucion'&&s.service[0].jsmProjectKey==='CONSALOP03','Lifecycle/vínculo cambió');
 assert(s.billing.length===6&&s.billing.every((b:any)=>b.currency==='UF'&&Number(b.amount)===160),'Cuotas cambiaron');
 assert(s.plan.length===34&&new Set(s.plan.map((p:any)=>p.jiraIssueKey)).size===34&&s.plan.every((p:any)=>p.status==='pendiente'&&p.dueDate===null&&p.jiraIssueKey?.startsWith('CONSALOP03-')),'Plan incompleto/cumplimiento inventado');
 const page=await searchJiraIssues('project=CONSALOP03 ORDER BY key',{maxResults:100,fields:['summary','issuetype','project','status','labels','description','duedate','assignee','customfield_12128','customfield_10010','customfield_10027','customfield_10002']});
 assert(!page.nextPageToken&&page.issues.length===40,'Cantidad Jira no verificada');
 const work=page.issues.filter(i=>(i.fields.issuetype as any).id==='12981'),financial=page.issues.filter(i=>(i.fields.issuetype as any).id==='12982');
 assert(work.length===34&&financial.length===6,'Tipos/cantidad inesperados');
 assert(work.every(i=>i.fields.status.statusCategory?.key==='new'&&(i.fields as any).customfield_10010==null&&((i.fields as any).customfield_10027??[]).length===0&&((i.fields as any).customfield_10002??[]).length===0&&(i.fields as any).assignee==null),'Tareas no internas/pendientes');
 for(const w of work){const p=s.plan.find((p:any)=>p.jiraIssueKey===w.key);assert(p&&p.title===w.fields.summary,'Binding de tarea no coincide');assert(w.fields.labels?.includes('pmo-service-3300001'),'Label servicio faltante')}
 const canonical=await loadRecurringServiceJiraBillingEvidence(3300001);
 assert(canonical.sourceProjectKeys.join(',')==='CONSALOP03'&&canonical.items.length===6&&canonical.summary.billedItems===2&&canonical.summary.unknownItems===4&&canonical.summary.duplicateGroups===0&&canonical.summary.billedByCurrency[0]?.amount===320&&canonical.items.every(i=>i.jiraStatusName!==null),'Lectura financiera incompleta');
 const config=await getJsmSyncConfiguration(3300001);
 const old=JSON.parse(readFileSync(ROOT+'/4727-invariant-before.json','utf8'));assert(hash(await snapshot(2070001))===old.sha256,'4727 cambió');
 const journal=JSON.parse(readFileSync('/home/ubuntu/backups/prodigio-pmo/2026-10-21-cloudops-4775-operations/journal.json','utf8'));assert(journal.status==='completed'&&journal.plan.length===34,'Corrida no certificada');
 const result={serviceId:3300001,project:'CONSALOP03',jiraTotal:page.issues.length,operational:work.length,financial:financial.length,existingIdsReused:[510001,510002,510003,510004,510005,510006].every(id=>s.plan.some((p:any)=>p.id===id)),newRows:28,internalPending:true,quotesUf:s.billing.reduce((a:number,b:any)=>a+Number(b.amount),0),jiraBilling:canonical.summary,sources:canonical.sourceProjectKeys,warnings:canonical.warnings,configuration:config,other4727Unchanged:true,other4727Sha256:old.sha256,sourceMatrixVersion:journal.matrixVersion,plan:s.plan.map((p:any)=>({id:p.id,title:p.title,key:p.jiraIssueKey,month:p.monthNumber,dueDate:p.dueDate,status:p.status}))};
 writeFileSync(ROOT+'/final-verification.json',JSON.stringify(result,null,2),{mode:0o600});console.log(JSON.stringify({...result,configuration:undefined,plan:undefined}));
})().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
