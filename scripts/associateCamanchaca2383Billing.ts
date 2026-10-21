import {getDb} from '../server/db';
import {getJiraRuntimeCredentials} from '../server/jiraClient';
import {recurringServices,recurringServiceBillingMonths,adminSettings,auditLogs,users} from '../drizzle/schema';
import {eq} from 'drizzle-orm';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const ID=2100001,ROOT='/home/ubuntu/backups/prodigio-pmo/2026-10-21-camanchaca-2383-billing-association';
const KEY=`recurring-jira-billing-comment-policy:${ID}`,APPLY=process.argv.includes('--apply');
const AUTHOR='619253aed5986c006a543998';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const bytes=readFileSync(ROOT+'/before.json');if(sha(bytes)!==readFileSync(ROOT+'/before.json.sha256','utf8').split(/\s/)[0])throw Error('Checksum inválido');
const original=JSON.parse(bytes.toString());
function saveOnce(name:string,x:unknown){const p=ROOT+'/'+name;if(existsSync(p))return;const s=JSON.stringify(x,null,2)+'\n';writeFileSync(p,s,{mode:0o600,flag:'wx'});writeFileSync(p+'.sha256',sha(s)+'  '+name+'\n',{mode:0o600,flag:'wx'});}
function text(v:any):string{if(Array.isArray(v))return v.map(text).join(' ');if(v&&typeof v==='object')return [v.text??'',text(v.content??[])].join(' ').trim();return typeof v==='string'?v:'';}
(async()=>{
 const db=await getDb();if(!db)throw Error('DB no disponible');
 const [s]=await db.select().from(recurringServices).where(eq(recurringServices.id,ID));
 const billing=await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,ID)).orderBy(recurringServiceBillingMonths.monthNumber);
 const settings=await db.select().from(adminSettings).where(eq(adminSettings.key,KEY));
 if(!s||s.dealId!=='2383'||s.status!=='activo'||s.jsmProjectKey!=='CAMANSOP01'||s.jsmProjectId!=='13011'||billing.length!==6)throw Error('Scope cambió');
 const targets=billing.map(b=>({billingId:b.id,month:b.monthNumber,key:`CAMANSOP01-${19+b.monthNumber}`,amount:b.amount,currency:b.currency,due:b.dueDate}));
 const verified:any[]=[];const c=getJiraRuntimeCredentials();
 for(const t of targets){
  const base=original.billing.find((b:any)=>b.id===t.billingId);const row=billing.find(b=>b.id===t.billingId)!;
  if(!base||t.currency!=='UF'||Number(t.amount)!==94||row.jiraIssueKey&&row.jiraIssueKey!==t.key)throw Error('Cuota/binding fuera de alcance');
  const omit=({jiraIssueKey:_k,...r}:any)=>r;if(JSON.stringify(omit(row))!==JSON.stringify(omit(base)))throw Error('Datos de cuota cambiaron');
  const r=await fetch(c.baseUrl+`/rest/api/3/issue/${t.key}?fields=project,summary,description,issuetype,labels,duedate,status,comment,customfield_11237`,{headers:{Authorization:c.authorization,Accept:'application/json'},signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`GET ${t.key} HTTP${r.status}`);const issue=await r.json();const f=issue.fields;
  if(f.project.id!=='13011'||f.project.key!=='CAMANSOP01'||f.summary!==`Facturación Mes ${t.month} - Soporte y evolutivos`||!f.labels?.includes(`mes-${t.month}`)||f.labels.some((v:string)=>v.startsWith('pmo-')))throw Error('Hito original no coincide');
  if(!text(f.description).includes('94.00 UF'))throw Error('Importe contractual Jira no coincide');
  const initial=original.issues.find((i:any)=>i.key===t.key);if(!initial||initial.id!==issue.id||initial.fields.duedate!==f.duedate||JSON.stringify(initial.fields.comment)!==JSON.stringify(f.comment))throw Error('Evidencia original cambió');
  const confirmation=f.comment.comments.filter((v:any)=>v.author?.accountId===AUTHOR&&/^(Facturado|Facturación (confirmada|completada)|Confirmada facturación)/i.test(text(v.body)));
  if(t.month<6&&confirmation.length!==1)throw Error('Confirmación no determinista');
  if(t.month===6&&confirmation.length)throw Error('M06 ya tiene nueva evidencia; revisar antes de aplicar');
  verified.push({key:issue.key,id:issue.id,month:t.month,status:f.status.name,commentIds:confirmation.map((v:any)=>v.id),commentAuthor:AUTHOR});
 }
 const policy={version:1,serviceId:ID,projectId:'13011',projectKey:'CAMANSOP01',issueKeys:targets.map(t=>t.key),authorAccountIds:[AUTHOR],verifiedAt:new Date().toISOString()};
 const existing=settings[0]?.value?JSON.parse(settings[0].value):null;
 if(s.jsmBillingSyncMode==='external_reference'&&targets.every(t=>billing.find(b=>b.id===t.billingId)?.jiraIssueKey===t.key)&&JSON.stringify(existing?.issueKeys)===JSON.stringify(policy.issueKeys)&&JSON.stringify(existing?.authorAccountIds)===JSON.stringify(policy.authorAccountIds)){console.log(JSON.stringify({noop:true,verified}));return;}
 saveOnce('association-before.json',{service:s,billing,settings,verified,originalSha256:sha(bytes)});
 console.log(JSON.stringify({apply:APPLY,targets,policy,verified,invoicesModified:false}));if(!APPLY)return;
 const [actor]=await db.select().from(users).where(eq(users.email,'ediazl@prodigio.tech')).limit(1);if(!actor||actor.role!=='admin')throw Error('Actor administrativo no verificado');
 await db.transaction(async tx=>{
  const locked=await tx.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,ID)).orderBy(recurringServiceBillingMonths.monthNumber).for('update');if(JSON.stringify(locked)!==JSON.stringify(billing))throw Error('Cambio concurrente en cuotas');
  const [service]=await tx.select().from(recurringServices).where(eq(recurringServices.id,ID)).for('update');if(service.status!=='activo'||service.jsmProjectKey!=='CAMANSOP01'||service.jsmBillingSyncMode!==s.jsmBillingSyncMode)throw Error('Lifecycle o política cambió');
  for(const t of targets)await tx.update(recurringServiceBillingMonths).set({jiraIssueKey:t.key}).where(eq(recurringServiceBillingMonths.id,t.billingId));
  await tx.update(recurringServices).set({jsmBillingSyncMode:'external_reference'}).where(eq(recurringServices.id,ID));
  await tx.insert(adminSettings).values({key:KEY,value:JSON.stringify(policy),description:'Confirmación financiera explícita por Aiza en comentarios de seis hitos originales CAMANSOP01. Nunca por Completed; no inferir M06.'}).onDuplicateKeyUpdate({set:{value:JSON.stringify(policy)}});
  await tx.insert(auditLogs).values({action:'camanchaca_2383_billing_association',entity:'recurring_service',entityId:String(ID),entityName:s.serviceName,userId:actor.id,userName:actor.name,userRole:actor.role,details:{backup:ROOT,targets,verified,policy,amountsChanged:false,datesChanged:false,jiraWritten:false,workPlanChanged:false}});
 });
 const after=await db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId,ID)).orderBy(recurringServiceBillingMonths.monthNumber);
 saveOnce('association-after.json',{billing:after,policy,verified});console.log(JSON.stringify({applied:true,serviceId:ID,bound:after.length,unchangedAmounts:true,jiraWrites:0}));
})().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
