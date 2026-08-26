import { eq } from "drizzle-orm";
import {
  executiveContractMilestones,
  executiveProjectSources,
  projects,
} from "../drizzle/schema";
import { getDb, updateExecutiveContractMilestoneJiraObservation } from "./db";
import {
  normalizeExecutiveMilestoneStatus,
  type ExecutiveSemanticStatus,
} from "./executiveDashboardV2";
import { searchJiraIssues } from "./jiraClient";

type JiraIssueFields = {
  status?: {
    name?: string | null;
    statusCategory?: { key?: string | null } | null;
  } | null;
  duedate?: string | null;
  resolutiondate?: string | null;
};

type JiraIssueSnapshot = {
  key: string;
  fields?: JiraIssueFields | null;
};

export type JiraMilestoneObservation = {
  jiraStatusName: string | null;
  jiraDueDate: string | null;
  jiraClosedDate: string | null;
  semanticStatus: ExecutiveSemanticStatus;
};

export type JiraMilestoneSyncResult = {
  startedAt: string;
  finishedAt: string;
  projectsProcessed: number;
  milestonesObserved: number;
  milestonesChanged: number;
  missingIssueKeys: string[];
  projects: Array<{
    projectId: number;
    projectName: string;
    jiraProjectKey: string;
    milestonesObserved: number;
    milestonesChanged: number;
    missingIssueKeys: string[];
  }>;
  errors: Array<{ projectId: number; projectName: string; message: string }>;
};

function asDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const dateOnly = value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateOnly) ? dateOnly : null;
}

export function deriveJiraMilestoneObservation(
  issue: JiraIssueSnapshot,
  now = new Date(),
): JiraMilestoneObservation {
  const statusName = issue.fields?.status?.name?.trim() || null;
  const dueDate = asDateOnly(issue.fields?.duedate);
  const isDone = issue.fields?.status?.statusCategory?.key?.toLowerCase() === "done";

  return {
    jiraStatusName: statusName,
    jiraDueDate: dueDate,
    jiraClosedDate: isDone ? asDateOnly(issue.fields?.resolutiondate) : null,
    semanticStatus: isDone
      ? "fulfilled"
      : normalizeExecutiveMilestoneStatus(statusName, dueDate, now),
  };
}

export async function syncExecutiveMilestonesFromJira(): Promise<JiraMilestoneSyncResult> {
  const startedAt = new Date().toISOString();
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const rows = await db
    .select({
      milestoneId: executiveContractMilestones.id,
      projectId: projects.id,
      projectName: projects.projectName,
      jiraProjectKey: executiveProjectSources.jiraProjectKey,
      jiraIssueKey: executiveContractMilestones.jiraIssueKey,
      currentStatusName: executiveContractMilestones.jiraStatusName,
      currentDueDate: executiveContractMilestones.jiraDueDate,
      currentClosedDate: executiveContractMilestones.jiraClosedDate,
      currentSemanticStatus: executiveContractMilestones.semanticStatus,
    })
    .from(executiveContractMilestones)
    .innerJoin(
      executiveProjectSources,
      eq(executiveContractMilestones.sourceId, executiveProjectSources.id),
    )
    .innerJoin(projects, eq(executiveContractMilestones.projectId, projects.id))
    .where(eq(executiveProjectSources.sourceStatus, "approved"));

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.projectId}:${row.jiraProjectKey}`;
    const current = groups.get(key) ?? [];
    current.push(row);
    groups.set(key, current);
  }

  const projectResults: JiraMilestoneSyncResult["projects"] = [];
  const errors: JiraMilestoneSyncResult["errors"] = [];
  const missingIssueKeys: string[] = [];
  let milestonesObserved = 0;
  let milestonesChanged = 0;

  for (const projectMilestones of groups.values()) {
    const project = projectMilestones[0];
    const issueKeys = [...new Set(projectMilestones.map((item) => item.jiraIssueKey).filter(Boolean))];
    const projectMissing: string[] = [];
    let projectObserved = 0;
    let projectChanged = 0;

    try {
      const quotedKeys = issueKeys.map((key) => `"${key.replaceAll('"', '\\"')}"`).join(",");
      const page = await searchJiraIssues(`key in (${quotedKeys}) ORDER BY key ASC`, {
        maxResults: Math.max(issueKeys.length, 1),
        fields: ["status", "duedate", "resolutiondate"],
      });
      const issuesByKey = new Map(
        (page.issues as JiraIssueSnapshot[]).map((issue) => [issue.key, issue]),
      );

      for (const milestone of projectMilestones) {
        const issue = issuesByKey.get(milestone.jiraIssueKey);
        if (!issue) {
          projectMissing.push(milestone.jiraIssueKey);
          missingIssueKeys.push(milestone.jiraIssueKey);
          continue;
        }

        const observation = deriveJiraMilestoneObservation(issue);
        const changed =
          milestone.currentStatusName !== observation.jiraStatusName ||
          milestone.currentDueDate !== observation.jiraDueDate ||
          milestone.currentClosedDate !== observation.jiraClosedDate ||
          milestone.currentSemanticStatus !== observation.semanticStatus;

        await updateExecutiveContractMilestoneJiraObservation(
          milestone.milestoneId,
          observation,
        );
        projectObserved += 1;
        milestonesObserved += 1;
        if (changed) {
          projectChanged += 1;
          milestonesChanged += 1;
        }
      }

      projectResults.push({
        projectId: project.projectId,
        projectName: project.projectName,
        jiraProjectKey: project.jiraProjectKey,
        milestonesObserved: projectObserved,
        milestonesChanged: projectChanged,
        missingIssueKeys: projectMissing,
      });
    } catch (error) {
      errors.push({
        projectId: project.projectId,
        projectName: project.projectName,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    projectsProcessed: projectResults.length,
    milestonesObserved,
    milestonesChanged,
    missingIssueKeys: [...new Set(missingIssueKeys)].sort(),
    projects: projectResults,
    errors,
  };
}
