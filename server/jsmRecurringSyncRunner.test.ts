import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  associateExistingJiraIssue,
  calculateJsmSetupReadiness,
  configureJsmIssueTypeMappings,
  confirmJsmSync,
  dryRunJsmSync,
  JsmRecurringSyncError,
  type JsmRecurringSyncDependencies,
} from "./jsmRecurringSyncRunner";

function createHarness() {
  const runs = new Map<string, any>();
  const links: Array<{
    category: string;
    entityId: number;
    jiraIssueKey: string;
  }> = [];
  let workItems: any[] = [
    {
      id: 11,
      title: "Revisión mensual",
      description: "Validar operación",
      dueDate: "2026-09-30",
      jiraIssueKey: null,
    },
  ];
  let billing: any[] = [
    {
      id: 21,
      monthNumber: 1,
      amount: "100",
      currency: "UF",
      dueDate: "2026-09-25",
      jiraIssueKey: null,
    },
  ];
  let mappings: any[] = [
    {
      id: 1,
      serviceId: 7,
      category: "work_plan",
      issueTypeId: "100",
      issueTypeName: "Solicitud",
      status: "active",
    },
    {
      id: 2,
      serviceId: 7,
      category: "billing",
      issueTypeId: "200",
      issueTypeName: "Hito de facturación",
      status: "active",
    },
  ];
  const issueTypes = [
    { id: "100", name: "Solicitud", subtask: false },
    { id: "200", name: "Hito de facturación", subtask: false },
    { id: "300", name: "Subtarea", subtask: true },
  ];
  const createIssue = vi
    .fn()
    .mockResolvedValueOnce({
      id: "501",
      key: "OPS-1",
      self: "https://jira.test/OPS-1",
    })
    .mockResolvedValueOnce({
      id: "502",
      key: "OPS-2",
      self: "https://jira.test/OPS-2",
    });
  const findByExternalId = vi.fn().mockResolvedValue([]);
  const getIssue = vi.fn().mockImplementation(async (key: string) => ({
    id: key === "OPS-20" ? "520" : "510",
    key,
    self: `https://jira.test/${key}`,
    fields: {
      summary: "Issue existente",
      description: null,
      status: { id: "1", name: "Abierto" },
      issuetype: { id: "100", name: "Solicitud" },
      project: { id: "900", key: "OPS", name: "Operaciones" },
      labels: [],
    },
  }));
  const repository: any = {
    getService: vi.fn().mockResolvedValue({
      id: 7,
      serviceName: "Servicio recurrente",
      jsmPlatform: "prodigio",
      jsmProjectId: "900",
      jsmProjectKey: "OPS",
      jsmProjectName: "Operaciones",
      jsmServiceDeskId: "45",
      jsmClientPlatformUrl: null,
    }),
    getWorkItems: vi.fn().mockImplementation(async () => workItems),
    getBilling: vi.fn().mockImplementation(async () => billing),
    listMappings: vi.fn().mockImplementation(async () => mappings),
    saveMappings: vi.fn().mockImplementation(async (input: any) => {
      mappings = input.mappings.map((mapping: any, index: number) => ({
        id: index + 10,
        serviceId: input.serviceId,
        status: "active",
        ...mapping,
      }));
      return mappings;
    }),
    getRun: vi
      .fn()
      .mockImplementation(async (runId: string) => runs.get(runId) ?? null),
    createOrReuseRun: vi.fn().mockImplementation(async (data: any) => {
      const existing = runs.get(data.runId);
      if (existing) {
        if (existing.fingerprint !== data.fingerprint)
          throw new Error("operationId incompatible");
        return { run: existing, reused: true };
      }
      const byFingerprint = [...runs.values()].find(
        run =>
          run.serviceId === data.serviceId &&
          run.fingerprint === data.fingerprint
      );
      if (byFingerprint) return { run: byFingerprint, reused: true };
      const run = {
        id: runs.size + 1,
        ...data,
        result: null,
        errorMessage: null,
      };
      runs.set(data.runId, run);
      return { run, reused: false };
    }),
    claimRun: vi.fn().mockImplementation(async (runId: string) => {
      const run = runs.get(runId);
      if (!run || run.status !== "ready") return false;
      run.status = "applying";
      return true;
    }),
    updateRun: vi
      .fn()
      .mockImplementation(
        async (runId: string, status: string, data: any = {}) => {
          const run = runs.get(runId);
          Object.assign(
            run,
            { status },
            data.plan === undefined ? {} : { plan: data.plan },
            data.result === undefined ? {} : { result: data.result },
            { errorMessage: data.errorMessage ?? null }
          );
          return run;
        }
      ),
    listRuns: vi.fn().mockImplementation(async () => [...runs.values()]),
    linkItem: vi.fn().mockImplementation(async (input: any) => {
      links.push(input);
      if (input.category === "work_plan")
        workItems = workItems.map(item =>
          item.id === input.entityId
            ? { ...item, jiraIssueKey: input.jiraIssueKey }
            : item
        );
      if (input.category === "billing")
        billing = billing.map(item =>
          item.id === input.entityId
            ? { ...item, jiraIssueKey: input.jiraIssueKey }
            : item
        );
      return { ...input, reused: false };
    }),
  };
  const dependencies: JsmRecurringSyncDependencies = {
    repository,
    getProject: vi
      .fn()
      .mockResolvedValue({
        id: "900",
        key: "OPS",
        name: "Operaciones",
        projectTypeKey: "service_desk",
        archived: false,
        issueTypes: [],
      }),
    getPermissions: vi.fn().mockResolvedValue({
      BROWSE_PROJECTS: {
        id: "1",
        key: "BROWSE_PROJECTS",
        name: "Browse",
        havePermission: true,
      },
      CREATE_ISSUES: {
        id: "2",
        key: "CREATE_ISSUES",
        name: "Create",
        havePermission: true,
      },
    }),
    getIssueTypes: vi.fn().mockResolvedValue(issueTypes),
    findByExternalId,
    getIssue,
    createIssue,
    now: () => new Date("2026-09-16T15:00:00.000Z"),
    createRunId: () => "jsm-sync:test-run",
  };
  return {
    dependencies,
    repository,
    createIssue,
    findByExternalId,
    getIssue,
    links,
    runs,
    setWorkItems: (value: any[]) => {
      workItems = value;
    },
    setBilling: (value: any[]) => {
      billing = value;
    },
    setMappings: (value: any[]) => {
      mappings = value;
    },
  };
}

describe("J4 — mappings y sincronización segura JSM", () => {
  let harness: ReturnType<typeof createHarness>;

  beforeEach(() => {
    harness = createHarness();
  });

  it("resuelve y persiste los nombres desde issue types reales, no desde texto enviado", async () => {
    const result = await configureJsmIssueTypeMappings(
      {
        serviceId: 7,
        actor: { id: 1, name: "PMO" },
        mappings: [
          { category: "work_plan", issueTypeId: "100" },
          { category: "billing", issueTypeId: "200" },
        ],
      },
      harness.dependencies
    );

    expect(
      result.map(mapping => [mapping.category, mapping.issueTypeName])
    ).toEqual([
      ["work_plan", "Solicitud"],
      ["billing", "Hito de facturación"],
    ]);
    expect(harness.repository.saveMappings).toHaveBeenCalledOnce();
  });

  it("rechaza mappings incompletos o tipos no disponibles", async () => {
    await expect(
      configureJsmIssueTypeMappings(
        {
          serviceId: 7,
          actor: { id: 1, name: "PMO" },
          mappings: [{ category: "work_plan", issueTypeId: "100" }],
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "INVALID_MAPPING_SELECTION" });

    await expect(
      configureJsmIssueTypeMappings(
        {
          serviceId: 7,
          actor: { id: 1, name: "PMO" },
          mappings: [
            { category: "work_plan", issueTypeId: "999" },
            { category: "billing", issueTypeId: "200" },
          ],
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "MAPPING_NOT_AVAILABLE" });
  });

  it("genera un dry-run determinista sin invocar creación de issues", async () => {
    const first = await dryRunJsmSync(
      {
        serviceId: 7,
        actor: { id: 1, name: "PMO" },
        operationId: "dry-run:001",
      },
      harness.dependencies
    );
    const repeated = await dryRunJsmSync(
      {
        serviceId: 7,
        actor: { id: 1, name: "PMO" },
        operationId: "dry-run:002",
      },
      harness.dependencies
    );

    expect(first.plan.canSync).toBe(true);
    expect(first.plan.counts).toEqual({
      total: 2,
      toCreate: 2,
      alreadyLinked: 0,
      blocked: 0,
    });
    expect(repeated.runId).toBe(first.runId);
    expect(repeated.reused).toBe(true);
    expect(harness.createIssue).not.toHaveBeenCalled();
    expect(harness.findByExternalId).toHaveBeenCalledWith(
      "OPS",
      "pmo-rs-7-work-plan-11"
    );
    expect(harness.findByExternalId).toHaveBeenCalledWith(
      "OPS",
      "pmo-rs-7-billing-21"
    );
  });

  it("bloquea el dry-run si falta un mapping y no realiza escrituras Jira", async () => {
    harness.setMappings([
      {
        id: 1,
        serviceId: 7,
        category: "work_plan",
        issueTypeId: "100",
        issueTypeName: "Solicitud",
        status: "active",
      },
    ]);
    const result = await dryRunJsmSync(
      { serviceId: 7, actor: { id: 1, name: "PMO" } },
      harness.dependencies
    );

    expect(result.status).toBe("blocked");
    expect(result.plan.canSync).toBe(false);
    expect(result.plan.counts.blocked).toBe(2);
    expect(harness.createIssue).not.toHaveBeenCalled();
  });

  it("confirma solo un dry-run vigente y crea con issueTypeId explícito", async () => {
    const dryRun = await dryRunJsmSync(
      { serviceId: 7, actor: { id: 1, name: "PMO" } },
      harness.dependencies
    );
    const result = await confirmJsmSync(
      { serviceId: 7, dryRunId: dryRun.runId, actor: { id: 1, name: "PMO" } },
      harness.dependencies
    );

    expect(result.status).toBe("applied");
    expect(harness.createIssue).toHaveBeenCalledTimes(2);
    expect(
      harness.createIssue.mock.calls.map(call => call[0].issueTypeId)
    ).toEqual(["100", "200"]);
    expect(
      harness.createIssue.mock.calls.every(
        call => call[0].issueTypeName === undefined
      )
    ).toBe(true);
    expect(harness.links.map(link => link.jiraIssueKey)).toEqual([
      "OPS-1",
      "OPS-2",
    ]);
  });

  it("marca stale cuando cambian los elementos después del dry-run", async () => {
    const dryRun = await dryRunJsmSync(
      { serviceId: 7, actor: { id: 1, name: "PMO" } },
      harness.dependencies
    );
    harness.setWorkItems([
      {
        id: 11,
        title: "Título modificado",
        description: "Validar operación",
        dueDate: "2026-09-30",
        jiraIssueKey: null,
      },
    ]);

    await expect(
      confirmJsmSync(
        { serviceId: 7, dryRunId: dryRun.runId, actor: { id: 1, name: "PMO" } },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "STALE_DRY_RUN" });
    expect(harness.runs.get(dryRun.runId)?.status).toBe("stale");
    expect(harness.createIssue).not.toHaveBeenCalled();
  });

  it("no asocia por título: bloquea un externalId existente y exige asociación explícita por clave", async () => {
    harness.findByExternalId
      .mockResolvedValueOnce([await harness.getIssue("OPS-20")])
      .mockResolvedValueOnce([]);
    const dryRun = await dryRunJsmSync(
      { serviceId: 7, actor: { id: 1, name: "PMO" } },
      harness.dependencies
    );

    expect(dryRun.plan.items[0]).toMatchObject({
      action: "blocked",
      jiraIssueKey: "OPS-20",
    });
    expect(harness.createIssue).not.toHaveBeenCalled();

    const linked = await associateExistingJiraIssue(
      {
        serviceId: 7,
        category: "work_plan",
        entityId: 11,
        jiraIssueKey: "ops-20",
      },
      harness.dependencies
    );
    expect(linked.jiraIssueKey).toBe("OPS-20");
    expect(harness.repository.linkItem).toHaveBeenCalledWith({
      serviceId: 7,
      category: "work_plan",
      entityId: 11,
      jiraIssueKey: "OPS-20",
    });
  });

  it("rechaza una asociación manual fuera del proyecto vinculado", async () => {
    harness.getIssue.mockResolvedValueOnce({
      id: "1",
      key: "OTHER-1",
      self: "https://jira.test/OTHER-1",
      fields: {
        summary: "Otro",
        description: null,
        status: { id: "1", name: "Abierto" },
        issuetype: { id: "100", name: "Solicitud" },
        project: { id: "901", key: "OTHER", name: "Otro" },
      },
    });
    await expect(
      associateExistingJiraIssue(
        {
          serviceId: 7,
          category: "work_plan",
          entityId: 11,
          jiraIssueKey: "OTHER-1",
        },
        harness.dependencies
      )
    ).rejects.toBeInstanceOf(JsmRecurringSyncError);
    expect(harness.repository.linkItem).not.toHaveBeenCalled();
  });

  it("exige plan y facturación completos para cerrar JSM Setup", () => {
    const blocked = calculateJsmSetupReadiness({
      platform: "prodigio",
      projectKey: "OPS",
      workItems: [{ jiraIssueKey: "OPS-1" }],
      billing: [{ jiraIssueKey: null }],
      mappings: [{ category: "work_plan" }, { category: "billing" }],
    });
    expect(blocked.canClose).toBe(false);
    expect(blocked.totalUnsynced).toBe(1);

    const ready = calculateJsmSetupReadiness({
      platform: "prodigio",
      projectKey: "OPS",
      workItems: [{ jiraIssueKey: "OPS-1" }],
      billing: [{ jiraIssueKey: "OPS-2" }],
      mappings: [{ category: "work_plan" }, { category: "billing" }],
    });
    expect(ready).toMatchObject({
      canClose: true,
      totalApplicable: 2,
      totalUnsynced: 0,
    });
  });
});
