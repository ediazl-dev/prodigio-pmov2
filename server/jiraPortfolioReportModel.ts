import type { PortfolioRow, ProjectStatus } from "./executivePortfolio";
import type { JiraAdvanceReport } from "./jiraClient";
import type { EvidenceAvailability } from "./projectEvidencePolicy";
import type { JiraProgressInsights } from "./jiraProgressInsights";

export interface JiraReportSpaceDescriptor {
  id: number | null;
  projectId: number | null;
  projectKey: string | null;
  projectName: string | null;
  projectUrl: string | null;
  spaceName: string | null;
}

export interface JiraPortfolioReportEntry {
  spaceId: number | null;
  spaceName: string;
  projectKey: string | null;
  projectName: string;
  projectUrl: string | null;
  pmoProjectId: number;
  pmoProjectName: string;
  clientName: string;
  dealNumber: string;
  isLinked: boolean;

  status: ProjectStatus;
  stageLabel: string;
  stagesClosed: number;
  totalStages: number;
  operationalPhase: string | null;
  operationalProgressPct: number | null;
  executiveHealth: string | null;
  pmName: string | null;
  jiraEvidenceAvailability: EvidenceAvailability;
  jiraEvidenceAt: string | null;
  jiraSourceUpdatedAt: string | null;

  total: number | null;
  done: number | null;
  inProgress: number | null;
  toDo: number | null;
  percentComplete: number | null;
  epicsCount: number | null;
  epicsDone: number | null;
  milestonesCount: number | null;
  milestonesDone: number | null;
  risksCount: number | null;
  risksOpen: number | null;
  highRisksOpen: number | null;
  riskSource: PortfolioRow["riskSource"];
  teamSize: number | null;
  insights: JiraProgressInsights | null;
}

function normalizeKey(value: string | null | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? "";
  return normalized || null;
}

export function buildJiraPortfolioReportEntry(
  portfolio: PortfolioRow,
  report: JiraAdvanceReport | null,
  space: JiraReportSpaceDescriptor | null,
): JiraPortfolioReportEntry {
  const projectKey = normalizeKey(portfolio.jiraProjectKey ?? space?.projectKey);
  const insights = report?.insights ?? null;
  const tasksTotal = insights?.progress.issuesTotal ?? null;
  const tasksDone = insights?.progress.issuesDone ?? null;
  const tasksInProgress = insights
    ? insights.workload.reduce((sum, row) => sum + row.inProgress, 0)
    : null;
  const tasksToDo = insights
    ? insights.workload.reduce((sum, row) => sum + row.toDo, 0)
    : null;

  return {
    spaceId: space?.id ?? null,
    spaceName: space?.spaceName ?? portfolio.projectName,
    projectKey,
    projectName: space?.projectName ?? portfolio.projectName,
    projectUrl: space?.projectUrl ?? null,
    pmoProjectId: portfolio.projectId,
    pmoProjectName: portfolio.projectName,
    clientName: portfolio.clientName,
    dealNumber: portfolio.dealId ?? "",
    isLinked: Boolean(projectKey),

    status: portfolio.status,
    stageLabel: portfolio.stageLabel,
    stagesClosed: portfolio.stagesClosed,
    totalStages: portfolio.totalStages,
    operationalPhase: portfolio.operationalPhase,
    operationalProgressPct: portfolio.operationalProgressPct,
    executiveHealth: portfolio.executiveHealth,
    pmName: portfolio.pmName,
    jiraEvidenceAvailability: portfolio.jiraEvidenceAvailability,
    jiraEvidenceAt: portfolio.jiraEvidenceAt,
    jiraSourceUpdatedAt: portfolio.jiraSourceUpdatedAt,

    total: tasksTotal,
    done: tasksDone,
    inProgress: tasksInProgress,
    toDo: tasksToDo,
    percentComplete: insights?.progress.issuePct ?? null,
    epicsCount: insights?.coverage.epicsTotal ?? null,
    epicsDone: report ? report.epics.filter(epic => epic.statusCategory === "Done").length : null,
    milestonesCount: portfolio.milestonesTotal,
    milestonesDone: portfolio.milestonesFulfilled,
    risksCount: portfolio.openRisks,
    risksOpen: portfolio.openRisks,
    highRisksOpen: portfolio.highRisksOpen,
    riskSource: portfolio.riskSource,
    teamSize: insights?.workload.length ?? null,
    insights,
  };
}

export function indexJiraReportsByKey(reports: JiraAdvanceReport[]): Map<string, JiraAdvanceReport> {
  return new Map(reports.map(report => [report.projectKey.trim().toUpperCase(), report]));
}

export function indexJiraSpacesByProjectId(
  spaces: JiraReportSpaceDescriptor[],
): Map<number, JiraReportSpaceDescriptor> {
  return new Map(
    spaces
      .filter(space => space.projectId !== null)
      .map(space => [space.projectId as number, space]),
  );
}
