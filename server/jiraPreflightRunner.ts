import {
  getJiraAdvanceReport,
  getJiraProject,
  getProjectIssues,
  getProjectBoards,
  getProjectStatuses,
  type JiraAdvanceReport,
  type JiraBoard,
  type JiraIssue,
  type JiraProject,
} from "./jiraClient";
import { getManagedJiraProjectKeys } from "./db";
import { analyzeJiraPreflight, type JiraPreflightResult } from "./jiraPreflight";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";
import {
  createJiraOnboardingService,
  fingerprintJiraSnapshot,
  type JiraOnboardingStatus,
} from "./jiraOnboardingService";

type StatusGroups = Awaited<ReturnType<typeof getProjectStatuses>>;
type OnboardingService = ReturnType<typeof createJiraOnboardingService>;

export interface JiraPreflightDependencies {
  getProject(key: string): Promise<JiraProject & { issueTypes: any[] }>;
  getBoards(key: string): Promise<JiraBoard[]>;
  getStatuses(key: string): Promise<StatusGroups>;
  getReport(key: string): Promise<JiraAdvanceReport>;
  getIssues(key: string): Promise<JiraIssue[]>;
  getManagedKeys(): Promise<string[]>;
  onboarding: OnboardingService;
}

export interface RunJiraPreflightInput {
  jiraProjectKey: string;
  asOf: string;
  actorId: number;
  actorName?: string | null;
}

export interface PersistedJiraPreflightResult extends JiraPreflightResult {
  onboarding: {
    id: number;
    status: JiraOnboardingStatus;
    currentStep: number;
    created: boolean;
    sourceFingerprint: string;
  };
  run: { id: number; runId: string; created: boolean; status: string };
  jiraReadOnly: true;
}

function stablePreflightSnapshot(input: {
  project: JiraProject & { issueTypes: any[] };
  boards: JiraBoard[];
  statuses: StatusGroups;
  report: JiraAdvanceReport;
  issues: JiraIssue[];
  managedProjectKeys: string[];
  asOf: string;
  diagnostic: JiraPreflightResult;
}) {
  const { generatedAt: _generatedAt, ...stableDiagnostic } = input.diagnostic;
  return {
    asOf: input.asOf,
    project: {
      id: input.project.id,
      key: input.project.key,
      name: input.project.name,
      projectTypeKey: input.project.projectTypeKey,
      style: input.project.style,
      issueTypes: input.project.issueTypes.map((item: any) => ({ id: item.id, name: item.name, subtask: Boolean(item.subtask) })),
    },
    boards: input.boards.map(board => ({ id: board.id, name: board.name, type: board.type })),
    statuses: input.statuses,
    report: {
      totalIssues: input.report.totalIssues,
      doneCount: input.report.doneCount,
      inProgressCount: input.report.inProgressCount,
      toDoCount: input.report.toDoCount,
      byType: input.report.byType,
      milestones: input.report.milestones,
      risks: input.report.risks,
      epics: input.report.epics,
      scopeChanges: input.report.scopeChanges,
      team: input.report.team.map(member => ({ accountId: member.accountId, name: member.name, total: member.total })),
    },
    issues: input.issues.map(issue => ({
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      issueType: issue.fields.issuetype?.name ?? "[POR CONFIRMAR]",
      statusName: issue.fields.status?.name ?? null,
      statusCategory: issue.fields.status?.statusCategory?.name ?? null,
      assigneeAccountId: issue.fields.assignee?.accountId ?? null,
      assigneeName: issue.fields.assignee?.displayName ?? null,
      dueDate: typeof issue.fields.duedate === "string" ? issue.fields.duedate : null,
      resolutionDate: typeof issue.fields.resolutiondate === "string" ? issue.fields.resolutiondate : null,
      parentKey: typeof issue.fields.parent?.key === "string" ? issue.fields.parent.key : null,
    })).sort((left, right) => left.key.localeCompare(right.key)),
    managedProjectKeys: input.managedProjectKeys.map(key => key.toUpperCase()).sort(),
    diagnostic: stableDiagnostic,
  };
}

export function createJiraPreflightRunner(dependencies: JiraPreflightDependencies) {
  return async function runJiraPreflight(input: RunJiraPreflightInput): Promise<PersistedJiraPreflightResult> {
    const startedAt = new Date();
    const key = input.jiraProjectKey.trim().toUpperCase();
    const [project, boards, statuses, report, issues, managedProjectKeys] = await Promise.all([
      dependencies.getProject(key),
      dependencies.getBoards(key),
      dependencies.getStatuses(key),
      dependencies.getReport(key),
      dependencies.getIssues(key),
      dependencies.getManagedKeys(),
    ]);
    const diagnostic = analyzeJiraPreflight({ project, boards, statuses, report, managedProjectKeys, asOf: input.asOf });
    const sourceSnapshot = stablePreflightSnapshot({ project, boards, statuses, report, issues, managedProjectKeys, asOf: input.asOf, diagnostic });
    const sourceFingerprint = fingerprintJiraSnapshot(sourceSnapshot as any);

    const onboardingResult = await dependencies.onboarding.startOrResume({
      jiraProjectKey: key,
      jiraProjectId: project.id,
      jiraProjectName: project.name,
      sourceSnapshot: sourceSnapshot as any,
      initiatedBy: input.actorId,
      initiatedByName: input.actorName,
    });
    let onboarding = onboardingResult.record;
    if (["draft", "failed", "preflight"].includes(onboarding.status)) {
      onboarding = await dependencies.onboarding.transition({
        onboarding,
        status: "preflight",
        currentStep: 2,
        actorId: input.actorId,
        actorName: input.actorName,
      });
    }

    const runId = `preflight:${key}:${sourceFingerprint}`;
    const runResult = await dependencies.onboarding.startSyncRun({
      runId,
      onboardingId: onboarding.id,
      projectId: onboarding.projectId ?? null,
      jiraProjectKey: key,
      source: "preflight",
      status: "running",
      inputCount: report.totalIssues,
      details: { jiraReadOnly: true, asOf: input.asOf, verdict: diagnostic.verdict },
      triggeredBy: input.actorId,
      triggeredByName: input.actorName,
    });

    for (const reason of diagnostic.blockers) {
      await dependencies.onboarding.upsertException({ onboardingId: onboarding.id, projectId: onboarding.projectId ?? null, domain: "jira", reason, severity: "blocking" });
    }
    for (const reason of diagnostic.warnings) {
      await dependencies.onboarding.upsertException({ onboardingId: onboarding.id, projectId: onboarding.projectId ?? null, domain: "jira", reason, severity: "warning" });
    }

    const completedRun = runResult.created
      ? await dependencies.onboarding.completeSyncRun(runResult.record, {
          status: "dry_run",
          skippedCount: report.totalIssues,
          errorCount: diagnostic.blockers.length,
          details: {
            jiraReadOnly: true,
            asOf: input.asOf,
            verdict: diagnostic.verdict,
            blockers: diagnostic.blockers.length,
            warnings: diagnostic.warnings.length,
          },
          startedAt,
        })
      : runResult.record;

    return {
      ...diagnostic,
      onboarding: {
        id: onboarding.id,
        status: onboarding.status,
        currentStep: onboarding.currentStep,
        created: onboardingResult.created,
        sourceFingerprint,
      },
      run: { id: completedRun.id, runId, created: runResult.created, status: completedRun.status },
      jiraReadOnly: true,
    };
  };
}

export function runProductionJiraPreflight(input: RunJiraPreflightInput) {
  return createJiraPreflightRunner({
    getProject: getJiraProject,
    getBoards: getProjectBoards,
    getStatuses: getProjectStatuses,
    getReport: getJiraAdvanceReport,
    getIssues: async key => {
      const issues: JiraIssue[] = [];
      let nextPageToken: string | undefined;
      for (let page = 0; page < 100; page += 1) {
        const result = await getProjectIssues(key, {
          maxResults: 100,
          nextPageToken,
        });
        issues.push(...result.issues);
        if (result.isLast || !result.nextPageToken) break;
        nextPageToken = result.nextPageToken;
      }
      return issues;
    },
    getManagedKeys: getManagedJiraProjectKeys,
    onboarding: createProductionJiraOnboardingService(),
  })(input);
}
