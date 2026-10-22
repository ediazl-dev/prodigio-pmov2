import React from 'react';
import { describe,it,expect,afterEach } from 'vitest';
import { render,screen,cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { InternalWorkPlanTable } from './InternalWorkPlanTable';
import { ExecutiveFinancialAxis } from './ExecutiveFinancialAxis';
import { ExecutiveMilestoneEvidenceTable } from './ExecutiveMilestoneEvidenceTable';
afterEach(cleanup);
describe('presentación interna NEXOS',()=>{
 it('conserva línea base y fecha Jira separadas con estado observado',()=>{
  render(<InternalWorkPlanTable activities={[{code:'A03',title:'Revisión humana',startDay:3,endDay:3,baselineStartDate:'2026-10-21',baselineEndDate:'2026-10-21',jiraDueDate:'2026-10-23',progress:0,jiraIssueKey:'PMOPRONEX-8',jiraStatusName:'NUEVO',deliverable:'Spec revisada'}]}/>);
  expect(screen.getByText('21 oct 2026 – 21 oct 2026')).toBeTruthy();expect(screen.getByText('23 oct 2026')).toBeTruthy();expect(screen.getByText('0%')).toBeTruthy();expect(screen.queryByText('Facturado')).toBeNull();
 });
 it('costos faltantes son N/D y revenue comercial no se renderiza',()=>{
  const {container}=render(<ExecutiveFinancialAxis projectFinancialMode='internal' projectFinance={{overview:{saleUf:99999},costs:{}}} financialEvidence={{}} commercialExposure={{}} auditBase='Plan interno'/>);
  expect(container.textContent).not.toContain('99.999');expect(screen.getByText('Costos de ejecución — plan interno')).toBeTruthy();expect(screen.getAllByText('N/D').length).toBeGreaterThan(1);expect(screen.queryByText('Valor contratado')).toBeNull();
  expect(screen.getByText('No aplica')).toBeTruthy();
 });
 it('entregables internos no tienen monto ni aceptación implícita por Jira',()=>{
  render(<ExecutiveMilestoneEvidenceTable milestones={[{id:1,milestoneCode:'G1',title:'Spec',baselineDate:'2026-10-21',jiraIssueKey:'PMOPRONEX-8',jiraStatusName:'Done',jiraDueDate:'2026-10-23',acceptanceStatus:'unverified'}]} milestoneFinanceByCode={new Map([['G1',{amountUf:500}]])} source={{}} projectFinancialMode='internal' canManageRequirements={false} onRegisterActa={()=>{}}/>);
  expect(screen.queryByRole('columnheader',{name:'Monto'})).toBeNull();expect(screen.queryByText('500,00 UF')).toBeNull();expect(screen.getByText('Sin acta')).toBeTruthy();expect(screen.getByRole('columnheader',{name:'Línea base interna'})).toBeTruthy();
 });
 it('dashboard excluye panel de factura y monta 19 tareas y observación por clave',()=>{
  const client=readFileSync(resolve(process.cwd(),'client/src/pages/stages/ExecutiveDashboardV2.tsx'),'utf8');
  const server=readFileSync(resolve(process.cwd(),'server/routers.ts'),'utf8');
  expect(client).toContain('!isInternalProject && <section className="edv2-section" id="facturacion-jira"');expect(client).toContain('<InternalWorkPlanTable activities={internalActivities} />');expect(server).toContain('internalJiraByKey');expect(server).toContain('internalJiraObservationAvailability');
  expect(client).toContain('isInternalProject ? `${milestones.length} entregables internos · no facturables`');
 });
});

it('selección y foco interno usan CTO sin navegar a pestañas financieras ocultas',()=>{
 const client=readFileSync(resolve(process.cwd(),'client/src/pages/stages/ExecutiveDashboardV2.tsx'),'utf8');
 expect(client).toContain('const derivedView = isInternalProject ? "cto" : selectedDerivedView;');
 expect(client).toContain('aria-selected={derivedView === view.id}');
 expect(client).toContain('tabIndex={derivedView === view.id ? 0 : -1}');
 expect(client).toContain('isInternalProject ? ["cto"] : ["cfo", "commercial", "cto"]');
});
