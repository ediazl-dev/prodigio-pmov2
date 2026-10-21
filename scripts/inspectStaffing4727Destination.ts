import {getJiraRuntimeCredentials} from '../server/jiraClient';
import {writeFileSync} from 'node:fs';
(async()=>{
 const c=getJiraRuntimeCredentials();const out:any={readOnly:true,at:new Date().toISOString()};
 const paths:Record<string,string>={
 statuses:'/rest/api/3/project/CONSALOP02/statuses',
 workFields:'/rest/api/3/issue/createmeta/13114/issuetypes/12925?maxResults=200',
 billingFields:'/rest/api/3/issue/createmeta/13114/issuetypes/12926?maxResults=200',
 requestTypes:'/rest/servicedeskapi/servicedesk/399/requesttype?limit=100',
 assignable:'/rest/api/3/user/assignable/search?project=CONSALOP02&maxResults=100',
 };
 for(const [name,path] of Object.entries(paths)){
  const r=await fetch(c.baseUrl+path,{headers:{Authorization:c.authorization,Accept:'application/json','X-ExperimentalApi':'opt-in'},signal:AbortSignal.timeout(30000)});const text=await r.text();out[name]={http:r.status,data:r.headers.get('content-type')?.includes('json')?JSON.parse(text):text.slice(0,500)};
 }
 const p='/home/ubuntu/4727-destination-metadata.json';writeFileSync(p,JSON.stringify(out,null,2),{mode:0o600});
 console.log(JSON.stringify({path:p,statuses:out.statuses,workFields:{http:out.workFields.http,total:out.workFields.data.total,fields:(out.workFields.data.fields??out.workFields.data.values??[]).map((f:any)=>({fieldId:f.fieldId,key:f.key,name:f.name,required:f.required}))},billingFields:{http:out.billingFields.http,total:out.billingFields.data.total,fields:(out.billingFields.data.fields??out.billingFields.data.values??[]).map((f:any)=>({fieldId:f.fieldId,key:f.key,name:f.name,required:f.required}))},requestTypes:{http:out.requestTypes.http,values:out.requestTypes.data.values?.map((t:any)=>({id:t.id,name:t.name,issueTypeId:t.issueTypeId,groupIds:t.groupIds}))},assignable:{http:out.assignable.http,people:Array.isArray(out.assignable.data)?out.assignable.data.map((x:any)=>({accountId:x.accountId,displayName:x.displayName,active:x.active})):out.assignable.data}},null,2));process.exit(0);
})().catch(e=>{console.error(e.message);process.exit(1)});
