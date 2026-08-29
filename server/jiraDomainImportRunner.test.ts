import { describe, expect, it, vi } from "vitest";
import { runInitialJiraDomainImport, type JiraDomainImportDependencies } from "./jiraDomainImportRunner";

function context(overrides: Record<string, unknown> = {}) {
  return {
    onboarding: {
      id: 90,
      projectId: 901,
      jiraProjectKey: "PILOT",
      status: "ready" as const,
      mappingVersion: 2,
      sourceFingerprint: "h6-fingerprint",
      sourceSnapshot: {
        issues: [
          { key: "PILOT-10", summary: "Riesgo", issueType: "Riesgos PMO", statusName: "Abierto" },
          { key: "PILOT-20", summary: "Épica", issueType: "Epic", statusName: "En curso" },
          { key: "PILOT-21", summary: "Tarea", issueType: "Task", parentKey: "PILOT-20" },
        ],
      },
      identitySnapshot: { dealId: "Deal901" },
      ...overrides,
    },
    mappings: [
      { sourceKey: "PILOT-10", targetEntityType: "risk", status: "approved" },
      { sourceKey: "PILOT-20", targetEntityType: "epic", status: "approved" },
      { sourceKey: "PILOT-21", targetEntityType: "task", status: "approved" },
    ],
  };
}

function dependencies(overrides: Partial<JiraDomainImportDependencies> = {}): JiraDomainImportDependencies {
  return {
    loadContext: vi.fn(async () => context()),
    startSyncRun: vi.fn(async () => ({ record: { id: 700, status: "running" }, created: true })),
    completeSyncRun: vi.fn(async (_run, result) => result),
    upsertException: vi.fn(async input => ({ record: input, created: true })),
    persistRisks: vi.fn(async (_projectId, risks) => ({ createdCount: risks.length, updatedCount: 0 })),
    persistWbs: vi.fn(async (_projectId, tasks) => ({ createdCount: tasks.length, updatedCount: 0 })),
    linkDeal: vi.fn(async (_projectId, dealId) => ({ linked: true, reused: false, dealId, reason: null })),
    ...overrides,
  };
}

describe("runInitialJiraDomainImport", () => {
  it("persiste riesgos, WBS y Deal con una corrida H6 diferenciada", async () => {
    const deps = dependencies();
    const result = await runInitialJiraDomainImport({ projectId: 901, actorId: 1, actorName: "PMO" }, deps);

    expect(result).toMatchObject({
      runId: expect.stringMatching(/^initial_import_h6:90:[a-f0-9]{32}$/),
      reused: false,
      risks: { createdCount: 1, updatedCount: 0 },
      wbs: { createdCount: 2, updatedCount: 0 },
      finance: { linked: true, dealId: "Deal901" },
      exceptions: 0,
    });
    expect(deps.persistRisks).toHaveBeenCalledWith(901, expect.arrayContaining([expect.objectContaining({ jiraIssueKey: "PILOT-10" })]));
    expect(deps.persistWbs).toHaveBeenCalledWith(901, expect.arrayContaining([expect.objectContaining({ jiraParentKey: "PILOT-20" })]));
    expect(deps.linkDeal).toHaveBeenCalledWith(901, "Deal901");
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: "applied",
      createdCount: 4,
      errorCount: 0,
    }));
  });

  it("registra mappings documentales como pendientes cuando Jira no aporta un archivo S3 real", async () => {
    const base = context();
    const deps = dependencies({
      loadContext: vi.fn(async () => ({
        ...base,
        onboarding: {
          ...base.onboarding,
          sourceSnapshot: {
            issues: [
              ...(base.onboarding.sourceSnapshot as any).issues,
              { key: "PILOT-30", summary: "Acta", issueType: "Documento" },
            ],
          },
        },
        mappings: [
          ...base.mappings,
          { sourceKey: "PILOT-30", targetEntityType: "stage_evidence", status: "approved" },
        ],
      })),
    });

    const result = await runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps);
    expect(result).toMatchObject({
      documents: { mappedCount: 1, linkedCount: 0, pendingCount: 1 },
      exceptions: 1,
    });
    expect(deps.upsertException).toHaveBeenCalledWith(expect.objectContaining({
      domain: "documents",
      sourceKey: "PILOT-30",
      reason: expect.stringContaining("S3 real"),
    }));
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: "partial",
      skippedCount: 1,
      errorCount: 1,
      details: expect.objectContaining({ documents: { mappedCount: 1, linkedCount: 0, pendingCount: 1 } }),
    }));
  });

  it("deja el Deal inválido por confirmar y registra una excepción financiera sin inferir", async () => {
    const deps = dependencies({
      linkDeal: vi.fn(async (_projectId, dealId) => ({
        linked: false,
        reused: false,
        dealId,
        reason: `El Deal confirmado ${dealId} no existe en financial_data; permanece [POR CONFIRMAR].`,
      })),
    });

    const result = await runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps);
    expect(result).toMatchObject({ finance: { linked: false, dealId: "Deal901" }, exceptions: 1 });
    expect(deps.upsertException).toHaveBeenCalledWith(expect.objectContaining({
      domain: "finance",
      sourceKey: "Deal901",
      reason: expect.stringContaining("[POR CONFIRMAR]"),
    }));
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "partial", errorCount: 1 }));
  });

  it("reutiliza una corrida terminada con la misma versión y huella", async () => {
    const deps = dependencies({
      startSyncRun: vi.fn(async () => ({
        record: {
          id: 700,
          status: "applied",
          errorCount: 0,
          details: {
            risks: { createdCount: 1, updatedCount: 0 },
            wbs: { createdCount: 2, updatedCount: 0 },
            finance: { linked: true, reused: false, dealId: "Deal901" },
          },
        },
        created: false,
      })),
    });

    const result = await runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps);
    expect(result.reused).toBe(true);
    expect(deps.persistRisks).not.toHaveBeenCalled();
    expect(deps.persistWbs).not.toHaveBeenCalled();
    expect(deps.linkDeal).not.toHaveBeenCalled();
  });

  it("reanuda idempotentemente una corrida anterior con error", async () => {
    const deps = dependencies({
      startSyncRun: vi.fn(async () => ({ record: { id: 700, status: "error" }, created: false })),
    });

    const result = await runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps);
    expect(result.reused).toBe(false);
    expect(deps.persistRisks).toHaveBeenCalledTimes(1);
    expect(deps.persistWbs).toHaveBeenCalledTimes(1);
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "applied" }));
  });

  it("rechaza importaciones antes de que el onboarding esté ready", async () => {
    const deps = dependencies({ loadContext: vi.fn(async () => context({ status: "reconciliation" })) });
    await expect(runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps)).rejects.toThrow("onboarding ready");
    expect(deps.startSyncRun).not.toHaveBeenCalled();
  });

  it("cierra la corrida como error si falla la persistencia", async () => {
    const deps = dependencies({ persistRisks: vi.fn(async () => { throw new Error("fallo de persistencia"); }) });
    await expect(runInitialJiraDomainImport({ projectId: 901, actorId: 1 }, deps)).rejects.toThrow("fallo de persistencia");
    expect(deps.completeSyncRun).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: "error",
      errorMessage: "fallo de persistencia",
    }));
  });
});
