import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { getDb } from '../server/db';
import { projects, risks, projectStages, billingMilestones, wbsTasks, executiveProjectSources, executiveContractMilestones, adminSettings } from '../drizzle/schema';
import { searchJiraIssues } from '../server/jiraClient';

// Sólo SELECT/consultas Jira. Las únicas escrituras son archivos locales de evidencia, nunca PMO/Jira.
const ID = 4470001;
const PLAN = '/home/ubuntu/backups/prodigio-pmo/2026-10-21-nexos-4470001-internal';
const RISK = '/home/ubuntu/backups/prodigio-pmo/2026-10-21-nexos-4470001-proposed-risks';
const load = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const ordered = (rows: any[]) => [...rows].sort((a, b) => Number(a.id) - Number(b.id));
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const invariantRisks = (rows: any[]) => ordered(rows).map(({ description, mitigation, contingency, jiraIssueKey, jiraTaskId, jiraStatusName, jiraStatusCategory, updatedAt, ...r }) => r);

async function main() {
  const db = await getDb();
  assert(db, 'DB no disponible');
  const before = load(`${RISK}/before.json`);
  const afterPlan = load(`${PLAN}/after-plan-import.json`);
  const originalJira = load(`${PLAN}/nexos-internal-jira-full.json`).issues;
  const journal = load(`${RISK}/journal.json`);
  const [project] = await db.select().from(projects).where(eq(projects.id, ID));
  assert.equal(project.projectName, 'NEXOS_SFA_Multitenant');
  assert.equal(project.jiraProjectKey, 'PMOPRONEX');
  assert.equal(project.financialMode, 'internal');
  assert.equal(project.startDate, '2026-10-19');
  assert.equal(project.endDate, '2026-11-06');
  assert.equal(hash(project), hash(before.project), 'Proyecto cambió durante carga de riesgos');
  const currentRisks = await db.select().from(risks).where(eq(risks.projectId, ID));
  const stages = await db.select().from(projectStages).where(eq(projectStages.projectId, ID));
  const billing = await db.select().from(billingMilestones).where(eq(billingMilestones.projectId, ID));
  const wbs = await db.select().from(wbsTasks).where(eq(wbsTasks.projectId, ID));
  const sources = await db.select().from(executiveProjectSources).where(eq(executiveProjectSources.projectId, ID));
  const gates = await db.select().from(executiveContractMilestones).where(eq(executiveContractMilestones.projectId, ID));
  const [setting] = await db.select().from(adminSettings).where(eq(adminSettings.key, `project.internal-work-plan.v1.${ID}`));
  assert(setting?.value, 'Plan interno no persistido');
  const plan = JSON.parse(setting.value);
  assert.equal(currentRisks.length, 18);
  assert.equal(currentRisks.filter(r => r.confirmed).length, 0);
  assert.equal(hash(invariantRisks(currentRisks)), hash(invariantRisks(before.risks)), 'Evaluaciones originales cambiaron');
  assert.equal(new Set(currentRisks.map(r => r.jiraIssueKey)).size, 18);
  assert.equal(hash(ordered(stages)), hash(ordered(before.stages)), 'Etapas cambiaron');
  assert.equal(hash(ordered(billing)), hash(ordered(before.billing)), 'Facturación cambió');
  assert.equal(billing.length, 0);
  assert.equal(hash(ordered(wbs)), hash(ordered(afterPlan.wbs)), 'WBS cambió durante carga de riesgos');
  assert.equal(wbs.length, 24);
  const epicCount = wbs.filter(task => task.issueLevel === 'epic').length;
  assert.equal(epicCount, 5, 'Deben existir cinco épicas WBS verificadas');
  assert.equal(wbs.filter(task => task.issueLevel !== 'epic').length, 19);
  assert.equal(plan.activities.length, 19);
  assert.equal(sources.length, 1);
  assert.equal(sources[0].id, 2010002);
  assert.equal(sources[0].baselineVersion, 'internal-plan-2026-10-19-v1');
  assert.equal(gates.length, 4);
  const expected: Record<string, string> = { G1: '2026-10-21', Infra: '2026-10-23', G2: '2026-10-26', G3: '2026-11-06' };
  for (const gate of gates) {
    assert.equal(gate.baselineDate, expected[gate.milestoneCode]);
    assert.equal(Number(gate.billingWeight), 0);
    assert.equal(gate.semanticStatus, 'pending');
  }
  const issues: any[] = [];
  let token: string | undefined;
  do {
    const page = await searchJiraIssues('project = PMOPRONEX ORDER BY key ASC', { maxResults: 100, nextPageToken: token, fields: ['project', 'summary', 'issuetype', 'status', 'labels', 'description', 'duedate', 'assignee', 'parent', 'priority', 'updated'] });
    issues.push(...page.issues);
    token = page.nextPageToken;
    if (!page.isLast && !token) throw Error('Lectura Jira incompleta, no certificar');
  } while (token);
  assert.equal(issues.length, 42, 'Conteo Jira distinto de 24 originales + 18 riesgos');
  assert.equal(issues.filter(issue => issue.fields.issuetype?.name === 'Epic').length, epicCount, 'Épicas Jira y WBS deben coincidir');
  const byKey = new Map(issues.map(issue => [issue.key, issue]));
  const stableIssue = (issue: any) => ({ id: issue.id, key: issue.key, summary: issue.fields.summary, due: issue.fields.duedate ?? null, type: issue.fields.issuetype?.id, status: issue.fields.status?.id, assignee: issue.fields.assignee?.accountId ?? null, parent: issue.fields.parent?.key ?? null, description: issue.fields.description ?? null, priority: issue.fields.priority?.id ?? null, labels: [...(issue.fields.labels ?? [])].sort(), updated: issue.fields.updated });
  for (const original of originalJira) {
    const current = byKey.get(original.key);
    assert(current, `Original no disponible: ${original.key}`);
    assert.equal(hash(stableIssue(current)), hash(stableIssue(original)), `Issue original cambió: ${original.key}`);
  }
  for (const risk of currentRisks) {
    const issue = byKey.get(risk.jiraIssueKey);
    assert(issue, `Riesgo no disponible: ${risk.riskCode}`);
    assert.equal(issue.fields.project?.key, 'PMOPRONEX');
    assert.equal(issue.fields.issuetype?.name, 'Riesgos PMO');
    assert.equal(issue.fields.status?.name.toLowerCase(), 'identificado');
    assert(issue.fields.labels?.includes(`pmo-risk-${risk.id}`));
    assert(issue.fields.labels?.includes('pmo-risk-proposed'));
    assert(issue.fields.summary.startsWith('[PROPUESTO]'));
    assert(JSON.stringify(issue.fields.description).includes('PENDIENTE DE REVISIÓN'));
    assert.equal(journal.items[risk.id]?.status, 'verified');
  }
  assert.equal(issues.filter(issue => issue.fields.issuetype?.name === 'Riesgos PMO').length, 18);
  const result = { verifiedAt: new Date().toISOString(), projectId: ID, financialMode: project.financialMode, baselineStart: project.startDate, baselineEnd: project.endDate, activities: 19, epics: 5, executiveGates: 4, jiraOriginalsPreserved: 24, jiraRisks: 18, jiraTotal: 42, riskConfirmations: 0, riskReview: 'pending', stagesPreserved: true, billingMilestones: 0, sourceId: sources[0].id, riskBindings: ordered(currentRisks).map(r => ({ id: r.id, riskCode: r.riskCode, jira: r.jiraIssueKey, status: r.jiraStatusName, confirmed: r.confirmed })) };
  const file = `${RISK}/verification.json`;
  const content = JSON.stringify(result, null, 2) + '\n';
  writeFileSync(file, content, { mode: 0o600 });
  writeFileSync(`${file}.sha256`, createHash('sha256').update(content).digest('hex') + '  verification.json\n', { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}
main().then(() => process.exit(0)).catch(error => { console.error(error.message); process.exit(1); });
