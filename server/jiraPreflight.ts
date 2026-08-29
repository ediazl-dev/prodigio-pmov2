import type { JiraAdvanceReport, JiraBoard, JiraProject } from "./jiraClient";
import { normalizeJiraProjectKey } from "./jiraOnboardingService";

type JiraStatusGroup = Array<{
  name: string;
  statuses: Array<{ name: string; id: string; statusCategory: { name: string } }>;
}>;

const REQUIRED_BOARDS = [
  { key: "risks", label: "Riesgos PMO", terms: ["riesgos pmo", "tablero riesgos"] },
  { key: "delivery", label: "Epic/Story/Task", terms: ["gestion pmi", "epic", "story", "task"] },
  { key: "scope", label: "Cambio de Alcance", terms: ["cambio de alcance"] },
  { key: "progress", label: "Proyecto PMO - Avance", terms: ["proyecto pmo", "avance"] },
  { key: "milestones", label: "Hito PMO", terms: ["hito pmo"] },
] as const;

const CANONICAL_ISSUE_TYPES = [
  { domain: "milestone", terms: ["hito", "milestone"] },
  { domain: "risk", terms: ["riesgo", "risk"] },
  { domain: "epic", terms: ["epic", "épica", "epica"] },
  { domain: "story", terms: ["story", "historia"] },
  { domain: "task", terms: ["task", "tarea", "sub-task", "subtarea"] },
  { domain: "scope_change", terms: ["cambio", "change", "avance"] },
] as const;

function classifyIssueType(type: string): string | null {
  const normalized = type.toLowerCase().trim();
  return CANONICAL_ISSUE_TYPES.find(candidate => candidate.terms.some(term => normalized.includes(term)))?.domain ?? null;
}

function isValidDate(value: string | null | undefined): boolean {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value)));
}

export interface JiraPreflightInput {
  project: JiraProject & { issueTypes: any[] };
  boards: JiraBoard[];
  statuses: JiraStatusGroup;
  report: JiraAdvanceReport;
  managedProjectKeys: string[];
  asOf: string;
}

export interface JiraPreflightResult {
  generatedAt: string;
  verdict: "blocked" | "ready_with_warnings" | "ready";
  readyForMapping: boolean;
  project: {
    id: string;
    key: string;
    name: string;
    projectTypeKey: string;
    style: string;
    isAlreadyManaged: boolean;
  };
  corporateAlignment: {
    classification: "corporate" | "non_corporate";
    scorePct: number;
    requiredBoards: number;
    foundBoards: number;
    boardChecks: Array<{ key: string; label: string; found: boolean; boardName: string | null }>;
    issueTypes: Array<{ type: string; count: number; canonicalDomain: string | null }>;
    unmappedIssueTypes: string[];
  };
  inventory: {
    totalIssues: number;
    milestones: number;
    risks: number;
    epics: number;
    scopeChanges: number;
    users: number;
    statuses: Array<{ issueType: string; statusName: string; category: string }>;
  };
  dateQuality: {
    milestoneDueDatePresent: number;
    milestoneDueDateMissing: number;
    milestoneDueDateInvalid: number;
    doneMilestoneResolutionPresent: number;
    doneMilestoneResolutionMissing: number;
    openMilestonesOverdue: number;
    dueDateCompletenessPct: number;
  };
  blockers: string[];
  warnings: string[];
}

export function analyzeJiraPreflight(input: JiraPreflightInput): JiraPreflightResult {
  const projectKey = normalizeJiraProjectKey(input.project.key);
  const isAlreadyManaged = new Set(input.managedProjectKeys.map(normalizeJiraProjectKey)).has(projectKey);
  const boardChecks = REQUIRED_BOARDS.map(requirement => {
    const board = input.boards.find(candidate => requirement.terms.some(term => candidate.name.toLowerCase().includes(term)));
    return { key: requirement.key, label: requirement.label, found: Boolean(board), boardName: board?.name ?? null };
  });
  const foundBoards = boardChecks.filter(item => item.found).length;
  const issueTypes = input.report.byType.map(item => ({
    type: item.type,
    count: item.count,
    canonicalDomain: classifyIssueType(item.type),
  }));
  const unmappedIssueTypes = issueTypes.filter(item => !item.canonicalDomain).map(item => item.type);

  const milestoneDueDatePresent = input.report.milestones.filter(item => isValidDate(item.duedate)).length;
  const milestoneDueDateMissing = input.report.milestones.filter(item => !item.duedate).length;
  const milestoneDueDateInvalid = input.report.milestones.filter(item => Boolean(item.duedate) && !isValidDate(item.duedate)).length;
  const doneMilestones = input.report.milestones.filter(item => item.statusCategory === "Done");
  const doneMilestoneResolutionPresent = doneMilestones.filter(item => isValidDate(item.resolutiondate)).length;
  const doneMilestoneResolutionMissing = doneMilestones.length - doneMilestoneResolutionPresent;
  const asOfTime = Date.parse(`${input.asOf.slice(0, 10)}T23:59:59.999Z`);
  const openMilestonesOverdue = input.report.milestones.filter(item =>
    item.statusCategory !== "Done" && isValidDate(item.duedate) && Date.parse(item.duedate!) < asOfTime,
  ).length;
  const dueDateCompletenessPct = input.report.milestones.length > 0
    ? Math.round((milestoneDueDatePresent / input.report.milestones.length) * 100)
    : 0;

  const blockers: string[] = [];
  const warnings: string[] = [];
  if (isAlreadyManaged) blockers.push(`El proyecto ${projectKey} ya está gestionado en Prodigio PMO.`);
  if (input.report.totalIssues === 0) blockers.push("El proyecto Jira no contiene issues para conciliar.");
  if (foundBoards < REQUIRED_BOARDS.length) warnings.push(`Configuración Jira no corporativa: ${foundBoards} de ${REQUIRED_BOARDS.length} tableros PPDC identificados.`);
  if (input.report.milestones.length === 0) warnings.push("No se detectaron hitos; el baseline deberá cargarse o mapearse manualmente.");
  if (milestoneDueDateMissing + milestoneDueDateInvalid > 0) warnings.push(`${milestoneDueDateMissing + milestoneDueDateInvalid} hitos no tienen una fecha planificada Jira válida.`);
  if (doneMilestoneResolutionMissing > 0) warnings.push(`${doneMilestoneResolutionMissing} hitos cerrados no tienen fecha real de resolución Jira.`);
  if (unmappedIssueTypes.length > 0) warnings.push(`${unmappedIssueTypes.length} tipos de issue requieren mapeo manual.`);
  if (input.report.team.some(member => member.name === "Sin asignar")) warnings.push("Existen issues sin responsable asignado.");

  const readyForMapping = blockers.length === 0;
  return {
    generatedAt: new Date().toISOString(),
    verdict: blockers.length > 0 ? "blocked" : warnings.length > 0 ? "ready_with_warnings" : "ready",
    readyForMapping,
    project: {
      id: input.project.id,
      key: projectKey,
      name: input.project.name,
      projectTypeKey: input.project.projectTypeKey,
      style: input.project.style,
      isAlreadyManaged,
    },
    corporateAlignment: {
      classification: foundBoards === REQUIRED_BOARDS.length ? "corporate" : "non_corporate",
      scorePct: Math.round((foundBoards / REQUIRED_BOARDS.length) * 100),
      requiredBoards: REQUIRED_BOARDS.length,
      foundBoards,
      boardChecks,
      issueTypes,
      unmappedIssueTypes,
    },
    inventory: {
      totalIssues: input.report.totalIssues,
      milestones: input.report.milestones.length,
      risks: input.report.risks.length,
      epics: input.report.epics.length,
      scopeChanges: input.report.scopeChanges.length,
      users: input.report.team.length,
      statuses: input.statuses.flatMap(group => group.statuses.map(status => ({
        issueType: group.name,
        statusName: status.name,
        category: status.statusCategory.name,
      }))),
    },
    dateQuality: {
      milestoneDueDatePresent,
      milestoneDueDateMissing,
      milestoneDueDateInvalid,
      doneMilestoneResolutionPresent,
      doneMilestoneResolutionMissing,
      openMilestonesOverdue,
      dueDateCompletenessPct,
    },
    blockers,
    warnings,
  };
}
