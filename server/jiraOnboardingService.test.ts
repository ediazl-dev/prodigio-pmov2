import { describe, expect, it, vi } from "vitest";
import {
  buildJiraMappingKey,
  createJiraOnboardingService,
  fingerprintJiraSnapshot,
  normalizeJiraProjectKey,
  type JiraOnboardingRepository,
} from "./jiraOnboardingService";

function createMemoryRepository(): JiraOnboardingRepository & {
  onboardings: any[];
  mappings: any[];
  runs: any[];
  exceptions: any[];
} {
  let sequence = 1;
  const repository = {
    onboardings: [] as any[],
    mappings: [] as any[],
    runs: [] as any[],
    exceptions: [] as any[],
    async findOnboardingByProjectKey(jiraProjectKey: string) {
      return this.onboardings.find(item => item.jiraProjectKey === jiraProjectKey) ?? null;
    },
    async createOnboarding(values: Record<string, unknown>) {
      const record = { id: sequence++, ...values };
      this.onboardings.push(record);
      return record;
    },
    async updateOnboarding(id: number, values: Record<string, unknown>) {
      const index = this.onboardings.findIndex(item => item.id === id);
      this.onboardings[index] = { ...this.onboardings[index], ...values };
      return this.onboardings[index];
    },
    async listMappings(onboardingId: number, mappingVersion?: number) {
      return this.mappings.filter(item => item.onboardingId === onboardingId && (mappingVersion == null || item.mappingVersion === mappingVersion));
    },
    async findMappingByKey(mappingKey: string) {
      return this.mappings.find(item => item.mappingKey === mappingKey) ?? null;
    },
    async createMapping(values: Record<string, unknown>) {
      const record = { id: sequence++, ...values };
      this.mappings.push(record);
      return record;
    },
    async updateMapping(id: number, values: Record<string, unknown>) {
      const index = this.mappings.findIndex(item => item.id === id);
      this.mappings[index] = { ...this.mappings[index], ...values };
      return this.mappings[index];
    },
    async findSyncRunByRunId(runId: string) {
      return this.runs.find(item => item.runId === runId) ?? null;
    },
    async createSyncRun(values: Record<string, unknown>) {
      const record = { id: sequence++, ...values };
      this.runs.push(record);
      return record;
    },
    async updateSyncRun(id: number, values: Record<string, unknown>) {
      const index = this.runs.findIndex(item => item.id === id);
      this.runs[index] = { ...this.runs[index], ...values };
      return this.runs[index];
    },
    async findExceptionByNaturalKey(input: { onboardingId: number; domain: string; sourceKey: string | null; reason: string }) {
      return this.exceptions.find(item => item.onboardingId === input.onboardingId
        && item.domain === input.domain
        && item.sourceKey === input.sourceKey
        && item.reason === input.reason) ?? null;
    },
    async createException(values: Record<string, unknown>) {
      const record = { id: sequence++, ...values };
      this.exceptions.push(record);
      return record;
    },
    async updateException(id: number, values: Record<string, unknown>) {
      const index = this.exceptions.findIndex(item => item.id === id);
      this.exceptions[index] = { ...this.exceptions[index], ...values };
      return this.exceptions[index];
    },
  };
  return repository;
}

describe("servicio idempotente de onboarding Jira", () => {
  it("normaliza claves y estabiliza fingerprints aunque cambie el orden de campos", () => {
    expect(normalizeJiraProjectKey(" pilot ")).toBe("PILOT");
    expect(fingerprintJiraSnapshot({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(fingerprintJiraSnapshot({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it("reanuda el mismo proyecto sin duplicar el onboarding", async () => {
    const repository = createMemoryRepository();
    const service = createJiraOnboardingService(repository);
    const input = {
      jiraProjectKey: "pilot",
      jiraProjectName: "Piloto",
      sourceSnapshot: { issueCount: 3 },
      initiatedBy: 7,
    };

    expect((await service.startOrResume(input)).created).toBe(true);
    expect((await service.startOrResume({ ...input, sourceSnapshot: { issueCount: 4 } })).created).toBe(false);
    expect(repository.onboardings).toHaveLength(1);
    expect(repository.onboardings[0].sourceSnapshot).toEqual({ issueCount: 4 });
  });

  it("bloquea saltos de estado y pasos fuera del asistente de siete pasos", async () => {
    const repository = createMemoryRepository();
    const service = createJiraOnboardingService(repository);
    const onboarding = { id: 1, status: "draft" as const, jiraProjectKey: "PILOT" };

    await expect(service.transition({ onboarding, status: "ready", currentStep: 7, actorId: 7 }))
      .rejects.toThrow("draft → ready");
    await expect(service.transition({ onboarding, status: "preflight", currentStep: 8, actorId: 7 }))
      .rejects.toThrow("entre 1 y 7");
  });

  it("actualiza un mapeo por clave natural en vez de duplicarlo", async () => {
    const repository = createMemoryRepository();
    const service = createJiraOnboardingService(repository);
    const base = {
      onboardingId: 11,
      mappingVersion: 1,
      sourceKey: "pilot-10",
      targetEntityType: "milestone" as const,
    };

    expect((await service.upsertMapping(base)).created).toBe(true);
    expect((await service.upsertMapping({ ...base, status: "approved", actorId: 7 })).created).toBe(false);
    expect(repository.mappings).toHaveLength(1);
    expect(repository.mappings[0].status).toBe("approved");
    expect(repository.mappings[0].mappingKey).toBe(buildJiraMappingKey(base));
  });

  it("guarda identidad confirmada y reanuda el estado con los mapeos de su versión", async () => {
    const repository = createMemoryRepository();
    const service = createJiraOnboardingService(repository);
    const started = await service.startOrResume({
      jiraProjectKey: "PILOT", jiraProjectName: "Piloto", sourceSnapshot: { issues: [] }, initiatedBy: 7,
    });
    const preflight = await service.transition({ onboarding: started.record, status: "preflight", currentStep: 2, actorId: 7 });
    const mapping = await service.saveIdentity({
      onboarding: preflight,
      identitySnapshot: { projectName: "Piloto", clientName: "Cliente", dealId: "Deal1" },
      actorId: 7,
    });
    await service.upsertMapping({ onboardingId: mapping.id, mappingVersion: 1, sourceKey: "PILOT-1", targetEntityType: "milestone" });

    const state = await service.getState("pilot");
    expect(state?.onboarding.status).toBe("mapping");
    expect(state?.onboarding.currentStep).toBe(3);
    expect(state?.mappings).toHaveLength(1);
  });

  it("reutiliza runId y excepción natural sin crear duplicados", async () => {
    const repository = createMemoryRepository();
    const service = createJiraOnboardingService(repository);
    const run = { runId: "run-001", jiraProjectKey: "pilot", source: "preflight" as const };
    const exception = { onboardingId: 11, domain: "baseline", sourceKey: "PILOT-10", reason: "Sin fecha contractual" };

    expect((await service.startSyncRun(run)).created).toBe(true);
    expect((await service.startSyncRun(run)).created).toBe(false);
    expect((await service.upsertException(exception)).created).toBe(true);
    expect((await service.upsertException({ ...exception, severity: "blocking" })).created).toBe(false);
    expect(repository.runs).toHaveLength(1);
    expect(repository.exceptions).toHaveLength(1);
    expect(repository.exceptions[0].severity).toBe("blocking");
  });

  it("no interrumpe la operación si la auditoría falla", async () => {
    const repository = createMemoryRepository();
    const auditSink = vi.fn().mockRejectedValue(new Error("auditoría no disponible"));
    const service = createJiraOnboardingService(repository, auditSink);

    const result = await service.startOrResume({
      jiraProjectKey: "PILOT",
      jiraProjectName: "Piloto",
      sourceSnapshot: {},
      initiatedBy: 7,
    });

    expect(result.created).toBe(true);
    expect(auditSink).toHaveBeenCalledOnce();
  });
});
