import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildNexosInternalPlan, internalPlanDate, type NexosInternalManifest, type InternalPlanJiraIssue } from './nexosInternalPlan';
const manifest = JSON.parse(readFileSync('/home/ubuntu/backups/prodigio-pmo/2026-10-21-nexos-4470001-internal/plan-manifest.json', 'utf8')) as NexosInternalManifest;
const issues = manifest.activities.map((a,i)=>({ id:String(i+1), key:`PMOPRONEX-${i+6}`, fields:{ summary:`${a.code} · ${a.title}`, status:{name:'ACTIVIDAD POR HACER',statusCategory:{key:'new'}},duedate:'2026-11-10'}})) as InternalPlanJiraIssue[];
describe('Plan interno NEXOS SFA',()=>{
  it('respeta 19 actividades,4 gates y el Día1 confirmado sin crear factura',()=>{
    const plan=buildNexosInternalPlan(manifest,issues,'2026-10-19');
    expect(plan.activities).toHaveLength(19);expect(plan.gates).toHaveLength(4);expect(plan.billingMilestones).toEqual([]);expect(plan.hasRevenue).toBe(false);
    expect(plan.gates.map(g=>[g.code,g.baselineDate])).toEqual([['G1','2026-10-21'],['Infra','2026-10-23'],['G2','2026-10-26'],['G3','2026-11-06']]);
    expect(plan.gates.every(g=>g.acceptedAt===null && g.billingWeight===0)).toBe(true);
  });
  it('separa la línea base de la fecha planificada Jira y del avance informado',()=>{
    const plan=buildNexosInternalPlan(manifest,issues,'2026-10-19');
    expect(plan.gates[0].baselineDate).not.toEqual(plan.gates[0].jiraDueDate);
    expect(plan.activities[0].progress).toEqual(manifest.activities[0].progress);
    expect(plan.activities[0].progressSource).toBe('uploaded_work_plan');
  });
  it('considera días hábiles y feriados sin inventar una fecha ausente',()=>{
    expect(internalPlanDate('2026-10-19',15)).toBe('2026-11-06');expect(internalPlanDate(null,15)).toBeNull();
    expect(internalPlanDate('2026-10-19',3,['2026-10-20'])).toBe('2026-10-22');
    expect(()=>internalPlanDate('2026-10-18',1)).toThrow('día hábil');
  });
  it('rechaza otro proyecto, duplicados y gates cumplidos sin evidencia',()=>{
    expect(()=>buildNexosInternalPlan({...manifest,projectId:1},issues,'2026-10-19')).toThrow('Identidad');
    expect(()=>buildNexosInternalPlan(manifest,issues.slice(1),'2026-10-19')).toThrow('única');
    expect(()=>buildNexosInternalPlan({...manifest,gates:manifest.gates.map((g,i)=>i===0?{...g,status:'cumplido'}:g)},issues,'2026-10-19')).toThrow('evidencia');
  });
});
