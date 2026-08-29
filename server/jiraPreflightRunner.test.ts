import { describe, expect, it, vi } from "vitest";
import { createJiraOnboardingService, type JiraOnboardingRepository } from "./jiraOnboardingService";
import { createJiraPreflightRunner } from "./jiraPreflightRunner";

function createMemoryRepository(): JiraOnboardingRepository & { state: Record<string, any[]> } {
  const state = { onboardings: [] as any[], mappings: [] as any[], runs: [] as any[], exceptions: [] as any[] };
  const insert = (collection: any[], values: Record<string, unknown>) => {
    const record = { id: collection.length + 1, ...values };
    collection.push(record);
    return record;
  };
  const update = (collection: any[], id: number, values: Record<string, unknown>) => {
    const index = collection.findIndex(item => item.id === id);
    collection[index] = { ...collection[index], ...values };
    return collection[index];
  };
  return {
    state,
    findOnboardingByProjectKey: async key => state.onboardings.find(item => item.jiraProjectKey === key) ?? null,
    createOnboarding: async values => insert(state.onboardings, values),
    updateOnboarding: async (id, values) => update(state.onboardings, id, values),
    findMappingByKey: async key => state.mappings.find(item => item.mappingKey === key) ?? null,
    createMapping: async values => insert(state.mappings, values),
    updateMapping: async (id, values) => update(state.mappings, id, values),
    findSyncRunByRunId: async runId => state.runs.find(item => item.runId === runId) ?? null,
    createSyncRun: async values => insert(state.runs, values),
    updateSyncRun: async (id, values) => update(state.runs, id, values),
    findExceptionByNaturalKey: async input => state.exceptions.find(item =>
      item.onboardingId === input.onboardingId && item.domain === input.domain && item.sourceKey === input.sourceKey && item.reason === input.reason,
    ) ?? null,
    createException: async values => insert(state.exceptions, values),
    updateException: async (id, values) => update(state.exceptions, id, values),
  };
}

function buildDependencies(repository: ReturnType<typeof createMemoryRepository>) {
  return {
    getProject: vi.fn(async () => ({
      id: "100001", key: "PILOT", name: "Proyecto piloto sanitizado", projectTypeKey: "software", style: "classic", avatarUrls: {},
      issueTypes: [{ id: "1", name: "Hito PMO", subtask: false }],
    })),
    getBoards: vi.fn(async () => [{ id: 101, name: "Hito PMO", type: "kanban" }]),
    getStatuses: vi.fn(async () => [{ name: "Hito PMO", statuses: [{ name: "Open", id: "1", statusCategory: { name: "To Do" } }] }]),
    getReport: vi.fn(async () => ({
      projectKey: "PILOT", projectName: "Proyecto piloto sanitizado", reportDate: "2026-08-29T12:00:00.000Z",
      totalIssues: 1, doneCount: 0, inProgressCount: 0, toDoCount: 1, percentComplete: 0,
      byStatus: [], byType: [{ type: "Hito PMO", count: 1 }], epics: [], risks: [], scopeChanges: [], team: [],
      milestones: [{ key: "PILOT-1", summary: "Hito", status: "Open", statusCategory: "To Do", duedate: "2026-09-30", resolutiondate: null }],
      milestonesCumplidos: 0, milestonesPendientes: 1, milestoneCompletionPct: 0, primaryProgressPct: 0,
      primaryProgressSource: "MILESTONES" as const, totalTimeSpentSeconds: 0, totalOriginalEstimateSeconds: 0,
      totalTimeSpentHours: 0, totalOriginalEstimateHours: 0, lastUpdated: "2026-08-29T12:00:00.000Z",
    })),
    getManagedKeys: vi.fn(async () => [] as string[]),
    onboarding: createJiraOnboardingService(repository),
  };
}

describe("runner H2 de preflight Jira", () => {
  it("solo invoca dependencias de lectura y persiste un dry-run reanudable", async () => {
    const repository = createMemoryRepository();
    const dependencies = buildDependencies(repository);
    const runner = createJiraPreflightRunner(dependencies);
    const result = await runner({ jiraProjectKey: "pilot", asOf: "2026-08-29", actorId: 7, actorName: "PMO" });

    expect(result.jiraReadOnly).toBe(true);
    expect(result.onboarding.status).toBe("preflight");
    expect(result.onboarding.currentStep).toBe(2);
    expect(result.run.status).toBe("dry_run");
    expect(repository.state.onboardings).toHaveLength(1);
    expect(repository.state.runs).toHaveLength(1);
    expect(repository.state.mappings).toHaveLength(0);
    expect(dependencies.getProject).toHaveBeenCalledWith("PILOT");
  });

  it("reutiliza onboarding, corrida y excepciones cuando el snapshot no cambia", async () => {
    const repository = createMemoryRepository();
    const runner = createJiraPreflightRunner(buildDependencies(repository));
    const input = { jiraProjectKey: "PILOT", asOf: "2026-08-29", actorId: 7, actorName: "PMO" };
    const first = await runner(input);
    const second = await runner(input);

    expect(first.run.runId).toBe(second.run.runId);
    expect(second.onboarding.created).toBe(false);
    expect(second.run.created).toBe(false);
    expect(repository.state.onboardings).toHaveLength(1);
    expect(repository.state.runs).toHaveLength(1);
    expect(repository.state.exceptions).toHaveLength(first.warnings.length + first.blockers.length);
  });
});
