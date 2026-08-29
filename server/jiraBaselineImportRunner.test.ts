import { describe, expect, it, vi } from "vitest";
import { runInitialJiraBaselineImport, type JiraBaselineImportDependencies } from "./jiraBaselineImportRunner";

function createDependencies(overrides: Partial<JiraBaselineImportDependencies> = {}): JiraBaselineImportDependencies {
  return {
    loadContext: vi.fn(async () => ({
      onboarding: {
        id: 55,
        projectId: 901,
        jiraProjectKey: "PILOT",
        status: "reconciliation",
        mappingVersion: 1,
        sourceFingerprint: "abc123",
        sourceSnapshot: {
          issues: [
            { key: "PILOT-10", summary: "Hito uno", statusName: "Open", statusCategory: "new", dueDate: "2026-09-10" },
            { key: "PILOT-11", summary: "Hito dos", statusName: "Open", statusCategory: "new", dueDate: null },
          ],
        },
        identitySnapshot: { dealId: "Deal901" },
      },
      mappings: [
        { sourceKey: "PILOT-10", targetEntityType: "milestone", targetEntityId: "M01", status: "approved" },
        { sourceKey: "PILOT-11", targetEntityType: "milestone", targetEntityId: "M02", status: "approved" },
      ],
    })),
    startSyncRun: vi.fn(async () => ({ record: { id: 77, status: "running" }, created: true })),
    completeSyncRun: vi.fn(async (_run, result) => result),
    upsertException: vi.fn(async input => ({ record: input, created: true })),
    transition: vi.fn(async input => input),
    persistProposal: vi.fn(async () => ({ sourceId: 88, sourceStatus: "draft", reused: false })),
    ...overrides,
  };
}

describe("initial Jira baseline import H5", () => {
  it("persiste un draft desde hitos aprobados y registra brechas sin escribir Jira", async () => {
    const dependencies = createDependencies();
    const result = await runInitialJiraBaselineImport({ projectId: 901, actorId: 1, actorName: "PMO" }, dependencies);
    expect(result).toMatchObject({ sourceId: 88, sourceStatus: "draft", milestonesImported: 2, exceptions: 1 });
    expect(dependencies.persistProposal).toHaveBeenCalledWith(expect.objectContaining({
      dealId: "Deal901",
      milestones: expect.arrayContaining([expect.objectContaining({ billingWeight: "0.00" })]),
    }));
    expect(dependencies.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "partial" }));
    expect(dependencies.transition).toHaveBeenCalledWith(expect.objectContaining({ status: "reconciliation", currentStep: 6 }));
  });

  it("reutiliza una corrida terminada con la misma huella sin volver a persistir", async () => {
    const persistProposal = vi.fn();
    const dependencies = createDependencies({
      persistProposal,
      startSyncRun: vi.fn(async () => ({
        record: { id: 77, status: "partial", createdCount: 2, errorCount: 1, details: { sourceId: 88, sourceStatus: "draft" } },
        created: false,
      })),
    });
    const result = await runInitialJiraBaselineImport({ projectId: 901, actorId: 1 }, dependencies);
    expect(result.reused).toBe(true);
    expect(persistProposal).not.toHaveBeenCalled();
  });

  it("rechaza proyectos sin Deal confirmado antes de abrir una corrida", async () => {
    const startSyncRun = vi.fn();
    const dependencies = createDependencies({
      startSyncRun,
      loadContext: vi.fn(async () => ({
        onboarding: {
          id: 55, projectId: 901, jiraProjectKey: "PILOT", status: "reconciliation", mappingVersion: 1,
          sourceFingerprint: "abc123", sourceSnapshot: { issues: [] }, identitySnapshot: {},
        },
        mappings: [],
      })),
    });
    await expect(runInitialJiraBaselineImport({ projectId: 901, actorId: 1 }, dependencies)).rejects.toThrow("Deal financiero");
    expect(startSyncRun).not.toHaveBeenCalled();
  });

  it("registra la corrida como error si falla la persistencia", async () => {
    const completeSyncRun = vi.fn(async (_run, result) => result);
    const dependencies = createDependencies({
      completeSyncRun,
      persistProposal: vi.fn(async () => { throw new Error("fallo controlado"); }),
    });
    await expect(runInitialJiraBaselineImport({ projectId: 901, actorId: 1 }, dependencies)).rejects.toThrow("fallo controlado");
    expect(completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "error", errorCount: 1 }));
  });
});
