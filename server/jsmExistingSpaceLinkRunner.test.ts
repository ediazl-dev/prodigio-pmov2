import { describe, expect, it, vi } from "vitest";
import {
  createExistingJsmLinkDependencies,
  JsmExistingSpaceRunnerError,
  linkExistingJsmSpace,
  listExistingJsmSpaces,
  preflightExistingJsmSpace,
  revalidateExistingJsmSpace,
  unlinkExistingJsmSpace,
} from "./jsmExistingSpaceLinkRunner";
import { RecurringServiceJsmDbError } from "./recurringServicesDb";
import type { JsmExistingSpacePreflight } from "../shared/jsmExistingSpace";

const actor = { id: 41, name: "PMO Test" };

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
    serviceDeskId: "25",
    projectId: "10250",
    projectKey: "MSC",
    projectName: "Mesa Cliente",
    projectTypeKey: "service_desk",
    archived: false,
    canBrowseProject: true,
    canCreateIssues: true,
    issueTypes: [
      { id: "10001", name: "Solicitud", subtask: false },
      { id: "10002", name: "Incidente", subtask: false },
    ],
    agentUrl:
      "https://example.atlassian.net/jira/servicedesk/projects/MSC/boards",
    portalUrl: "https://example.atlassian.net/servicedesk/customer/portal/25",
    inspectedAt: "2026-09-16T12:00:00.000Z",
    ...overrides,
  };
}

function makePreflight(
  overrides: Partial<JsmExistingSpacePreflight> = {}
): JsmExistingSpacePreflight {
  return {
    status: "ready",
    canLink: true,
    blockers: [],
    warnings: [
      "Los tipos de issue para plan de trabajo y facturación deben configurarse antes de sincronizar.",
    ],
    snapshot: makeSnapshot(),
    ...overrides,
  };
}

function makeHarness(
  options: {
    owner?: any;
    service?: Record<string, unknown>;
    inspectResults?: JsmExistingSpacePreflight[];
    unlinkError?: Error;
  } = {}
) {
  const service: any = {
    id: 9001,
    serviceName: "Servicio Recurrente Test",
    clientName: "Cliente Test",
    jsmLinkSource: null,
    jsmProjectId: null,
    jsmProjectKey: null,
    jsmProjectName: null,
    jsmServiceDeskId: null,
    jsmAgentUrl: null,
    jsmPortalUrl: null,
    jsmLinkHealth: null,
    jsmLastVerifiedAt: null,
    jsmLinkedAt: null,
    jsmLinkedBy: null,
    ...options.service,
  };
  let nextId = 1;
  const runs: any[] = [];
  const inspectResults = options.inspectResults ?? [makePreflight()];
  let inspectIndex = 0;
  const inspect = vi.fn(
    async () =>
      inspectResults[Math.min(inspectIndex++, inspectResults.length - 1)]
  );
  const linkLocal = vi.fn(async (input: any) => {
    const reused = service.jsmServiceDeskId === input.snapshot.serviceDeskId;
    if (!reused) {
      Object.assign(service, {
        jsmLinkSource: "linked",
        jsmProjectId: input.snapshot.projectId,
        jsmProjectKey: input.snapshot.projectKey,
        jsmProjectName: input.snapshot.projectName,
        jsmServiceDeskId: input.snapshot.serviceDeskId,
        jsmAgentUrl: input.snapshot.agentUrl,
        jsmPortalUrl: input.snapshot.portalUrl,
        jsmLinkHealth: input.health,
        jsmLinkedBy: input.linkedBy,
      });
    }
    return { reused, serviceName: service.serviceName };
  });
  const updateVerification = vi.fn(async (input: any) => {
    service.jsmLinkHealth = input.health;
  });
  const unlinkLocal = vi.fn(async () => {
    if (options.unlinkError) throw options.unlinkError;
    const priorIdentity = {
      projectId: service.jsmProjectId,
      projectKey: service.jsmProjectKey,
      projectName: service.jsmProjectName,
      serviceDeskId: service.jsmServiceDeskId,
      agentUrl: service.jsmAgentUrl,
      portalUrl: service.jsmPortalUrl,
    };
    service.jsmProjectId = null;
    service.jsmProjectKey = null;
    service.jsmServiceDeskId = null;
    return {
      reused: false,
      serviceName: service.serviceName,
      priorIdentity,
      workPlanKeys: 0,
      billingKeys: 0,
    };
  });
  const repository: any = {
    getService: vi.fn(async () => service),
    findOwner: vi.fn(async () => options.owner ?? null),
    listOwners: vi.fn(async () => (options.owner ? [options.owner] : [])),
    listMappings: vi.fn(async () => []),
    listRuns: vi.fn(async () => runs),
    getRun: vi.fn(
      async (runId: string) => runs.find(run => run.runId === runId) ?? null
    ),
    createOrReuseRun: vi.fn(async (data: any) => {
      const existing = runs.find(
        run => run.fingerprint === data.fingerprint || run.runId === data.runId
      );
      if (existing) return { run: existing, reused: true };
      const run = {
        id: nextId++,
        createdAt: new Date(),
        startedAt: new Date(),
        finishedAt: null,
        ...data,
      };
      runs.push(run);
      return { run, reused: false };
    }),
    finishRun: vi.fn(async (runId: string, status: string, data: any = {}) => {
      const run = runs.find(candidate => candidate.runId === runId);
      Object.assign(run, data, { status, finishedAt: new Date() });
      return run;
    }),
    linkLocal,
    updateVerification,
    unlinkLocal,
  };
  const dependencies = createExistingJsmLinkDependencies({
    repository,
    inspect: inspect as any,
    listServiceDesks: vi.fn(async () => []),
    now: () => new Date("2026-09-16T12:00:00.000Z"),
    createRunId: source => `${source}:test-${nextId}`,
  });
  return {
    dependencies,
    repository,
    service,
    runs,
    inspect,
    linkLocal,
    updateVerification,
    unlinkLocal,
  };
}

describe("J3 JSM existing Space link runner", () => {
  it("persiste un preflight ready con snapshot y resultado final", async () => {
    const harness = makeHarness();
    const result = await preflightExistingJsmSpace(
      {
        serviceId: harness.service.id,
        serviceDeskId: "25",
        operationId: "preflight:test-ready",
        actor,
      },
      harness.dependencies
    );

    expect(result.preflight.status).toBe("ready");
    expect(result.preflight.canLink).toBe(true);
    expect(result.reused).toBe(false);
    expect(harness.runs).toHaveLength(1);
    expect(harness.runs[0]).toMatchObject({
      source: "preflight",
      status: "ready",
      candidateServiceDeskId: "25",
    });
    expect(harness.runs[0].snapshot.projectId).toBe("10250");
  });

  it("reutiliza el mismo preflight estable sin duplicar corridas", async () => {
    const harness = makeHarness({
      inspectResults: [
        makePreflight(),
        makePreflight({
          snapshot: makeSnapshot({ inspectedAt: "2026-09-16T12:05:00.000Z" }),
        }),
      ],
    });
    const first = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );
    const repeated = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );

    expect(repeated.runId).toBe(first.runId);
    expect(repeated.reused).toBe(true);
    expect(harness.runs).toHaveLength(1);
  });

  it("bloquea el preflight cuando la identidad pertenece a otro servicio", async () => {
    const harness = makeHarness({
      owner: {
        id: 9002,
        serviceName: "Otro servicio",
        clientName: "Otro cliente",
        jsmProjectId: "10250",
        jsmProjectKey: "MSC",
        jsmServiceDeskId: "25",
      },
    });
    const result = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );

    expect(result.preflight.status).toBe("linked_to_other_service");
    expect(result.preflight.canLink).toBe(false);
    expect(harness.runs[0].status).toBe("blocked");
    expect(harness.linkLocal).not.toHaveBeenCalled();
  });

  it("bloquea el preflight si el servicio actual ya está vinculado a otro Space JSM", async () => {
    const harness = makeHarness({
      service: {
        jsmProjectId: "10999",
        jsmProjectKey: "OTRO",
        jsmServiceDeskId: "99",
      },
    });
    const result = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );

    expect(result.preflight.status).toBe("linked_to_other_service");
    expect(result.preflight.canLink).toBe(false);
    expect(result.preflight.blockers[0]).toContain(
      "ya está vinculado a otro Space JSM"
    );
    expect(harness.runs[0].status).toBe("blocked");
  });

  it("revalida y guarda el vínculo local completo sin invocar métodos Jira de escritura", async () => {
    const harness = makeHarness();
    const jiraWrite = vi.fn();
    (harness.dependencies as any).createJiraIssue = jiraWrite;
    const preflight = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );
    const linked = await linkExistingJsmSpace(
      {
        serviceId: 9001,
        preflightRunId: preflight.runId,
        operationId: "link:test-ready",
        actor,
      },
      harness.dependencies
    );

    expect(linked.linked).toBe(true);
    expect(harness.linkLocal).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 9001,
        linkedBy: 41,
        health: "warning",
        snapshot: expect.objectContaining({
          projectId: "10250",
          projectKey: "MSC",
          serviceDeskId: "25",
          agentUrl: expect.stringContaining(
            "/jira/servicedesk/projects/MSC/boards"
          ),
          portalUrl: expect.stringContaining("/servicedesk/customer/portal/25"),
        }),
      })
    );
    expect(harness.service.jsmProjectId).toBe("10250");
    expect(harness.runs.at(-1).status).toBe("linked");
    expect(jiraWrite).not.toHaveBeenCalled();
  });

  it("rechaza una confirmación cuando cambió el snapshot desde el preflight", async () => {
    const harness = makeHarness({
      inspectResults: [
        makePreflight(),
        makePreflight({ snapshot: makeSnapshot({ canCreateIssues: false }) }),
      ],
    });
    const preflight = await preflightExistingJsmSpace(
      { serviceId: 9001, serviceDeskId: "25", actor },
      harness.dependencies
    );

    await expect(
      linkExistingJsmSpace(
        {
          serviceId: 9001,
          preflightRunId: preflight.runId,
          actor,
        },
        harness.dependencies
      )
    ).rejects.toMatchObject({ code: "STALE_PREFLIGHT" });
    expect(harness.linkLocal).not.toHaveBeenCalled();
  });

  it("revalida un vínculo existente y actualiza su salud sin tocar Jira", async () => {
    const harness = makeHarness({
      service: {
        jsmLinkSource: "linked",
        jsmProjectId: "10250",
        jsmProjectKey: "MSC",
        jsmProjectName: "Mesa Cliente",
        jsmServiceDeskId: "25",
      },
    });
    const result = await revalidateExistingJsmSpace(
      { serviceId: 9001, actor },
      harness.dependencies
    );

    expect(result.preflight.status).toBe("already_linked_same_service");
    expect(harness.updateVerification).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 9001,
        health: "warning",
        updateIdentityMetadata: true,
      })
    );
    expect(harness.linkLocal).not.toHaveBeenCalled();
  });

  it("propaga el bloqueo de desvinculación cuando existen jiraIssueKey asociados", async () => {
    const harness = makeHarness({
      service: {
        jsmProjectId: "10250",
        jsmProjectKey: "MSC",
        jsmServiceDeskId: "25",
      },
      unlinkError: new RecurringServiceJsmDbError(
        "SYNCED_ISSUES_BLOCK_UNLINK",
        "No se puede desvincular mientras existan actividades o hitos de facturación con jiraIssueKey."
      ),
    });

    await expect(
      unlinkExistingJsmSpace(
        {
          serviceId: 9001,
          reason: "Cambio controlado de plataforma",
          actor,
        },
        harness.dependencies
      )
    ).rejects.toBeInstanceOf(RecurringServiceJsmDbError);
    expect(harness.runs.at(-1).status).toBe("blocked");
  });

  it("desvincula localmente cuando no existen jiraIssueKey y conserva la identidad en la corrida", async () => {
    const harness = makeHarness({
      service: {
        jsmProjectId: "10250",
        jsmProjectKey: "MSC",
        jsmProjectName: "Mesa Cliente",
        jsmServiceDeskId: "25",
        jsmAgentUrl:
          "https://example.atlassian.net/jira/servicedesk/projects/MSC/boards",
        jsmPortalUrl:
          "https://example.atlassian.net/servicedesk/customer/portal/25",
      },
    });
    const result = await unlinkExistingJsmSpace(
      {
        serviceId: 9001,
        reason: "Cambio controlado de plataforma",
        operationId: "unlink:test-allowed",
        actor,
      },
      harness.dependencies
    );

    expect(result.unlinked).toBe(true);
    expect(harness.unlinkLocal).toHaveBeenCalledWith(9001);
    expect(harness.runs.at(-1)).toMatchObject({
      status: "unlinked",
      source: "unlink",
    });
    expect(harness.runs.at(-1).snapshot.serviceDeskId).toBe("25");
  });

  it("rechaza operationId malformado antes de persistir una corrida", async () => {
    const harness = makeHarness();
    await expect(
      preflightExistingJsmSpace(
        {
          serviceId: 9001,
          serviceDeskId: "25",
          operationId: "bad id",
          actor,
        },
        harness.dependencies
      )
    ).rejects.toBeInstanceOf(JsmExistingSpaceRunnerError);
    expect(harness.runs).toHaveLength(0);
  });
});

describe("J6 JSM Spaces inventory", () => {
  it("combina catálogo y vínculos, calcula métricas y filtra sin ejecutar escrituras", async () => {
    const harness = makeHarness();
    const linkedOwners = [
      {
        id: 9001,
        serviceName: "Mesa Cliente Norte",
        clientName: "Cliente Norte",
        status: "active",
        currentStage: "jira_setup",
        jsmLinkSource: "created",
        jsmProjectId: "10250",
        jsmProjectKey: "MSC",
        jsmProjectName: "Mesa Cliente Norte",
        jsmServiceDeskId: "25",
        jsmAgentUrl: null,
        jsmPortalUrl: null,
        jsmLinkHealth: "healthy",
        jsmLastVerifiedAt: new Date("2026-09-16T12:00:00.000Z"),
        jsmLinkedAt: new Date("2026-09-15T12:00:00.000Z"),
      },
      {
        id: 9002,
        serviceName: "Mesa Cliente Sur",
        clientName: "Cliente Sur",
        status: "active",
        currentStage: "ejecucion",
        jsmLinkSource: null,
        jsmProjectId: "10252",
        jsmProjectKey: "MSS",
        jsmProjectName: "Mesa Cliente Sur",
        jsmServiceDeskId: "27",
        jsmAgentUrl: null,
        jsmPortalUrl: null,
        jsmLinkHealth: "warning",
        jsmLastVerifiedAt: null,
        jsmLinkedAt: null,
      },
    ];
    harness.repository.listOwners.mockResolvedValue(linkedOwners);
    harness.dependencies.listServiceDesks = vi.fn(async () => [
      {
        id: "25",
        projectId: "10250",
        projectKey: "MSC",
        projectName: "Mesa Cliente Norte",
      },
      {
        id: "26",
        projectId: "10251",
        projectKey: "LIBRE",
        projectName: "Mesa Disponible",
      },
      {
        id: "27",
        projectId: "10252",
        projectKey: "MSS",
        projectName: "Mesa Cliente Sur",
      },
    ]);

    const result = await listExistingJsmSpaces(
      {
        search: "cliente norte",
        linkStatus: "linked",
        health: "healthy",
        origin: "created",
        page: 1,
        pageSize: 20,
      },
      harness.dependencies
    );

    expect(result.stats).toMatchObject({
      total: 3,
      linked: 2,
      available: 1,
      healthy: 1,
      warning: 1,
      created: 1,
      legacy: 1,
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toMatchObject({
      id: "25",
      linkStatus: "linked",
      linkOrigin: "created",
      linkedService: {
        id: 9001,
        serviceName: "Mesa Cliente Norte",
        health: "healthy",
      },
    });
    expect(result.items[0].agentUrl).toContain(
      "/jira/servicedesk/projects/MSC/boards"
    );
    expect(harness.inspect).not.toHaveBeenCalled();
    expect(harness.linkLocal).not.toHaveBeenCalled();
  });
});
