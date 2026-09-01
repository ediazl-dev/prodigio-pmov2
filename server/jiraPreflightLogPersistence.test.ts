import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { jiraImportExceptions, jiraProjectOnboardings, jiraSyncLogs } from "../drizzle/schema";
import { getDb } from "./db";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";
import { createJiraPreflightRunner } from "./jiraPreflightRunner";

const shouldRun = Boolean(process.env.DATABASE_URL)
  && process.env.RUN_PERSISTENT_JIRA_SYNC_LOG_TEST === "true";
const testKey = "TSTPMO1234";
const runId = `preflight:${testKey}:${"a".repeat(64)}`;

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  const onboardings = await db.select({ id: jiraProjectOnboardings.id })
    .from(jiraProjectOnboardings)
    .where(eq(jiraProjectOnboardings.jiraProjectKey, testKey));
  if (onboardings.length > 0) {
    await db.delete(jiraImportExceptions).where(inArray(jiraImportExceptions.onboardingId, onboardings.map(item => item.id)));
  }
  await db.delete(jiraSyncLogs).where(eq(jiraSyncLogs.jiraProjectKey, testKey));
  await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.jiraProjectKey, testKey));
}

describe.runIf(shouldRun)("persistencia aislada del log de preflight Jira", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("guarda completo un runId de 85 caracteres y lo reutiliza sin duplicarlo", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const service = createProductionJiraOnboardingService();
    const input = {
      runId,
      jiraProjectKey: testKey,
      source: "preflight" as const,
      status: "running" as const,
      inputCount: 0,
      details: { testOnly: true, jiraReadOnly: true },
      triggeredByName: "Vitest preflight",
    };

    const first = await service.startSyncRun(input);
    const second = await service.startSyncRun(input);
    const rows = await db.select().from(jiraSyncLogs).where(eq(jiraSyncLogs.runId, runId));

    expect(runId).toHaveLength(85);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.record.id).toBe(first.record.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ runId, jiraProjectKey: testKey, source: "preflight" });

    await service.completeSyncRun(first.record, {
      status: "dry_run",
      skippedCount: 0,
      errorCount: 0,
    });
  });

  it("ejecuta el preflight completo dos veces y persiste una sola corrida dry-run", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const runner = createJiraPreflightRunner({
      getProject: async key => ({
        id: `test-${key}`,
        key,
        name: "Prueba aislada preflight",
        projectTypeKey: "software",
        style: "classic",
        avatarUrls: {},
        issueTypes: [{ id: "1", name: "Hito PMO", subtask: false }],
      }),
      getBoards: async () => [{ id: 101, name: "Hito PMO", type: "kanban" }],
      getStatuses: async () => [{ name: "Hito PMO", statuses: [{ name: "Open", id: "1", statusCategory: { name: "To Do" } }] }],
      getReport: async key => ({
        projectKey: key,
        projectName: "Prueba aislada preflight",
        reportDate: "2026-09-01T12:00:00.000Z",
        totalIssues: 1,
        doneCount: 0,
        inProgressCount: 0,
        toDoCount: 1,
        percentComplete: 0,
        byStatus: [],
        byType: [{ type: "Hito PMO", count: 1 }],
        epics: [],
        risks: [],
        scopeChanges: [],
        team: [],
        milestones: [{ key: `${key}-1`, summary: "Hito", status: "Open", statusCategory: "To Do", duedate: "2026-09-30", resolutiondate: null }],
        milestonesCumplidos: 0,
        milestonesPendientes: 1,
        milestoneCompletionPct: 0,
        primaryProgressPct: 0,
        primaryProgressSource: "MILESTONES" as const,
        totalTimeSpentSeconds: 0,
        totalOriginalEstimateSeconds: 0,
        totalTimeSpentHours: 0,
        totalOriginalEstimateHours: 0,
        lastUpdated: "2026-09-01T12:00:00.000Z",
      }),
      getIssues: async key => [{
        id: "1",
        key: `${key}-1`,
        self: `https://example.invalid/${key}-1`,
        fields: {
          summary: "Hito",
          status: { name: "Open", statusCategory: { name: "To Do", key: "new" } },
          issuetype: { name: "Hito PMO", subtask: false },
          assignee: null,
          created: "2026-08-01",
          updated: "2026-09-01",
          duedate: "2026-09-30",
        },
      }],
      getManagedKeys: async () => [],
      onboarding: createProductionJiraOnboardingService(),
    });
    const input = { jiraProjectKey: testKey, asOf: "2026-09-01", actorId: 0, actorName: "Vitest preflight" };

    const first = await runner(input);
    const second = await runner(input);
    const logs = await db.select().from(jiraSyncLogs).where(eq(jiraSyncLogs.jiraProjectKey, testKey));
    const onboardings = await db.select().from(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.jiraProjectKey, testKey));

    expect(first.run.runId).toHaveLength(85);
    expect(second.run).toMatchObject({ id: first.run.id, runId: first.run.runId, created: false, status: "dry_run" });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ runId: first.run.runId, status: "dry_run", source: "preflight" });
    expect(onboardings).toHaveLength(1);
    expect(onboardings[0]).toMatchObject({ jiraProjectKey: testKey, status: "preflight", currentStep: 2, projectId: null });
  });
});
