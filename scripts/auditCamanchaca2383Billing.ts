import {mkdirSync,writeFileSync,existsSync} from "node:fs";
import {createHash} from "node:crypto";
import {eq,inArray} from "drizzle-orm";
import {getDb,getAdminSettingValue} from "../server/db";
import {getRecurringServiceById,getBillingMonths} from "../server/recurringServicesDb";
import {getJiraRuntimeCredentials,searchJiraIssues,type JiraIssue} from "../server/jiraClient";
import {loadRecurringServiceJiraBillingEvidence} from "../server/jiraBillingEvidence";
import {recurringServiceStages,recurringServiceWorkPlan,documentArtifacts,documentValidationDecisions} from "../drizzle/schema";

const SERVICE_ID=2100001;
const ROOT="/home/ubuntu/backups/prodigio-pmo/2026-10-21-camanchaca-2383-billing-association";
async function main(){
 const db=await getDb();if(!db)throw Error("DB no disponible");
 const service=await getRecurringServiceById(SERVICE_ID);if(!service||service.dealId!=="2383"||service.jsmProjectKey!=="CAMANSOP01")throw Error("Identidad/vínculo fuera del alcance autorizado");
 const [billing,stages,workPlan,artifacts,mapping]=await Promise.all([
  getBillingMonths(SERVICE_ID),db.select().from(recurringServiceStages).where(eq(recurringServiceStages.serviceId,SERVICE_ID)),
  db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId,SERVICE_ID)),
  db.select().from(documentArtifacts).where(eq(documentArtifacts.entityId,SERVICE_ID)),
  getAdminSettingValue(`recurring-jira-billing-field:${SERVICE_ID}`),
 ]);
 const decisions=artifacts.length?await db.select().from(documentValidationDecisions).where(inArray(documentValidationDecisions.artifactId,artifacts.map(a=>a.id))):[];
 const c=getJiraRuntimeCredentials();const headers={Authorization:c.authorization,Accept:"application/json"};
 const response=await fetch(`${c.baseUrl}/rest/api/3/field`,{headers,signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error(`Field metadata HTTP${response.status}`);
 const fields=(await response.json() as Array<Record<string,any>>).filter(f=>/factur/i.test(f.name??""));
 const issues:JiraIssue[]=[];let nextPageToken:string|undefined;let pages=0;
 do{const result=await searchJiraIssues("project=CAMANSOP01 ORDER BY created ASC",{fields:["*all"],maxResults:100,...(nextPageToken?{nextPageToken}:{})});issues.push(...result.issues);nextPageToken=result.nextPageToken;console.log(`GET CAMANSOP01 página ${++pages}: ${result.issues.length} issues`);if(pages>10&&nextPageToken)throw Error("Paginación fuera del límite auditado");}while(nextPageToken);
 const evidence=await loadRecurringServiceJiraBillingEvidence(SERVICE_ID);
 const snapshot={capturedAt:new Date().toISOString(),service,billing,stages,workPlan,artifacts,decisions,mapping,fields,issues,evidence};
 mkdirSync(ROOT,{recursive:true,mode:0o700});const destination=existsSync(`${ROOT}/before.json`)?`${ROOT}/read-${Date.now()}.json`:`${ROOT}/before.json`;const serialized=JSON.stringify(snapshot,null,2)+"\n";writeFileSync(destination,serialized,{mode:0o600,flag:"wx"});writeFileSync(`${destination}.sha256`,`${createHash("sha256").update(serialized).digest("hex")}  ${destination.split("/").pop()}\n`,{mode:0o600,flag:"wx"});
 const candidates=issues.filter(i=>/factur|hito|milestone|\bh\d\b/i.test(`${i.fields.summary} ${i.fields.issuetype.name}`));
 console.log(JSON.stringify({backup:destination,service:{id:service.id,project:service.jsmProjectKey,billingMode:service.jsmBillingSyncMode},billing,fields:fields.map(f=>({id:f.id,name:f.name,schema:f.schema,scope:f.scope})),candidates:candidates.map(i=>({id:i.id,key:i.key,type:i.fields.issuetype,summary:i.fields.summary,due:i.fields.duedate,status:i.fields.status,labels:i.fields.labels,financial:Object.fromEntries(fields.map(f=>[String(f.id),i.fields[String(f.id)]]))})),readModel:evidence},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e.message);process.exit(1)});
