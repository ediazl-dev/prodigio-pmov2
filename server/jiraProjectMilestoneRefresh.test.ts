import { describe, expect, it } from "vitest";
import { buildProjectMilestoneRefreshPlan, parseJiraMilestoneWeight, type RefreshMilestone, type RefreshJiraIssue } from "./jiraProjectMilestoneRefresh";
const now = new Date("2026-10-20T19:00:00Z");
const existing: RefreshMilestone[] = [1,2,3].map(n => ({id:30000+n,milestoneCode:`M0${n}`,jiraIssueKey:`PCIAD4-${10+n}`,title:`H${n} - 33.4%: anterior`,billingWeight:"33.33",baselineDate:null,jiraDueDate:null,jiraClosedDate:null,jiraStatusName:"Pendiente",semanticStatus:"pending"}));
const issues: RefreshJiraIssue[] = [
  {key:"PCIAD4-49",fields:{summary:"H0 - 28%: Kickoff",issuetype:{name:"Hito PMO"},duedate:"2026-10-13",resolutiondate:null,status:{name:"Cumplido (Entregable)",statusCategory:{key:"done"}}}},
  ...[1,2,3].map((n): RefreshJiraIssue => ({key:`PCIAD4-${10+n}`,fields:{summary:`H${n} - ${[22,36,14][n-1]}%: entregable`,issuetype:{name:"Hito PMO"},duedate:["2026-11-19","2027-01-05","2027-02-01"][n-1],resolutiondate:null,status:{name:"Pendiente",statusCategory:{key:"new"}}}})),
];
const build = (e=existing,j=issues,syncObservedWeights=true) => buildProjectMilestoneRefreshPlan({existing:e,issues:j,projectKey:"PCIAD4",syncObservedWeights,now});
describe("plan de actualización de hitos Jira",()=>{
 it("añade sólo H0, conserva IDs y actualiza la distribución explícita",()=>{
  const p=build(); expect(p.created).toBe(1);expect(p.updated).toBe(3);expect(p.totalWeight).toBe(100);
  expect(p.rows.map(x=>x.id)).toEqual([null,30001,30002,30003]);expect(p.rows.map(x=>x.values.billingWeight)).toEqual(["28.00","22.00","36.00","14.00"]);
  expect(p.rows.map(x=>x.values.jiraDueDate)).toEqual(["2026-10-13","2026-11-19","2027-01-05","2027-02-01"]);
 });
 it("no crea baseline, acta, factura ni fecha real de cierre ausente",()=>{
  const p=build();expect(p.rows.every(x=>x.baselineDate===null)).toBe(true);expect(p.rows[0].values.jiraClosedDate).toBeNull();expect(p.rows[0].values.semanticStatus).toBe("fulfilled");
  for(const row of p.rows){expect(row.values).not.toHaveProperty("baselineDate");expect(row.values).not.toHaveProperty("acceptedAt");expect(row.values).not.toHaveProperty("billingStatus");}
 });
 it("preserva una fecha contractual existente aunque cambie duedate",()=>{
  expect(build(existing.map(x=>({...x,baselineDate:"2026-08-01"}))).rows[1].baselineDate).toBe("2026-08-01");
 });
 it("es idempotente después de aplicar el plan",()=>{
  const applied=build().rows.map((x,i)=>({...x.values,id:x.id??40000+i,milestoneCode:x.milestoneCode,jiraIssueKey:x.jiraIssueKey,baselineDate:x.baselineDate}));
  expect(build(applied)).toMatchObject({created:0,updated:0});
 });
 it("rechaza lectura incompleta, duplicados y distribución incompleta",()=>{
  expect(()=>build(existing,issues.slice(0,3))).toThrow(/Faltan/);expect(()=>build(existing,[...issues,issues[0]])).toThrow(/duplicadas/);
  expect(()=>build(existing,issues.map(x=>({...x,fields:{...x.fields,summary:x.fields.summary.replace("28%","20%")}})))).toThrow(/100%/);
 });
 it("preserva pesos por defecto y no financia automáticamente un hito nuevo",()=>{
  const p=build(existing,issues,false);expect(p.rows.map(x=>x.values.billingWeight)).toEqual(["0.00","33.33","33.33","33.33"]);
 });
 it("interpreta porcentajes decimales sin truncarlos a 4%",()=>{
  expect(parseJiraMilestoneWeight("H1 - 33.4%: entrega")).toBe("33.40");expect(parseJiraMilestoneWeight("H1 - 33,4%: entrega")).toBe("33.40");expect(()=>parseJiraMilestoneWeight("H1: sin porcentaje")).toThrow();
 });
});
