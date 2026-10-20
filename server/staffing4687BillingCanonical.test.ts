import {describe,it,expect} from "vitest";
import type {JiraIssue} from "./jiraClient";
import {buildJiraBillingEvidence} from "./jiraBillingEvidence";
describe("vínculos canónicos Staffing4687",()=>{
 it("mantiene tres hitos únicos y facturación N/D aunque el duplicado externo siga existiendo",()=>{
  const keys=["CONSALOP01-23","CONSALOP01-21","CONSALOP01-22","CONSALOP01-20"];
  const issues=keys.map((key,i)=>({id:key,key,self:`https://jira.example/issue/${key}`,fields:{summary:`Deal 4687_H${i===3?1:i+1}_Mes ${i===3?1:i+1}`,status:{name:"Completed",statusCategory:{key:"done",name:"Done"}},issuetype:{name:"Purchase request with approval",subtask:false},labels:["Deal4687"],duedate:null,description:null,created:"2026-05-08T12:00:00Z",updated:"2026-09-29T12:00:00Z"}})) as JiraIssue[];
  const before=JSON.stringify(issues);
  const result=buildJiraBillingEvidence({entityType:"recurring_service",entityId:2040001,dealId:"4687",sourceProjectKeys:["CONSALOP01"],jiraAvailable:true,allowBillingIssueStatusFallback:false,localItems:[1,2,3].map(n=>({code:`M0${n}`,title:`Cuota ${n}`,monthNumber:n,amount:160,currency:"UF",amountSource:"billing_schedule" as const,dueDate:null,jiraIssueKey:keys[n-1]})),jiraIssues:issues});
  expect(result.items.map(x=>x.key)).toEqual(keys.slice(0,3));expect(result.summary.totalItems).toBe(3);expect(result.summary.duplicateGroups).toBe(0);expect(result.summary.unknownItems).toBe(3);expect(result.items.every(x=>x.matchedBy==="jira_issue_key" && x.amount===160)).toBe(true);expect(result.summary.billedByCurrency).toEqual([]);expect(JSON.stringify(issues)).toBe(before);expect(issues).toHaveLength(4);
 });
});
