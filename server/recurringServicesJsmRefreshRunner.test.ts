import { describe, expect, it, vi } from "vitest";
import {
  createScheduledRecurringServicesJsmHandler,
  RECURRING_JSM_TASK_UID_SETTING,
  runRecurringServicesJsmRefresh,
  runScheduledRecurringServicesJsmRefresh,
  type RecurringJsmRefreshDependencies,
} from "./recurringServicesJsmRefreshRunner";
import type { RecurringJsmSnapshotDraft } from "./recurringServicesJsmSnapshot";

const NOW = new Date("2026-09-16T06:00:00.000Z");

function snapshot(
  serviceId: number,
  status: RecurringJsmSnapshotDraft["status"] = "success"
): RecurringJsmSnapshotDraft {
  return {
    serviceId,
    serviceDeskId: `desk-${serviceId}`,
    projectKey: `JSM${serviceId}`,
    capturedAt: NOW,
    source: "manual",
    status,
    incidentCount: status === "error" ? null : 2,
    openIncidentCount: status === "error" ? null : 1,
    criticalOpenCount: status === "error" ? null : 0,
    overdueIncidentCount: status === "error" ? null : 0,
    unresolvedOver30DaysCount: status === "error" ? null : 0,
    firstResponseMeasuredCount: status === "error" ? null : 2,
    firstResponseMetCount: status === "error" ? null : 2,
    firstResponseCompliancePct: status === "error" ? null : "100.00",
    resolutionMeasuredCount: status === "error" ? null : 2,
    resolutionMetCount: status === "error" ? null : 1,
    resolutionCompliancePct: status === "error" ? null : "50.00",
    priorityBreakdown: status === "error" ? null : { high: 1 },
    issueTypeBreakdown: status === "error" ? null : { incident: 2 },
    dataFingerprint: `fingerprint-${serviceId}-${status}`,
    errorCode: status === "success" ? null : "JSM_PARTIAL",
    errorMessage: status === "success" ? null : "Cobertura SLA parcial",
    triggeredBy: 7,
  };
}

function dependencies(
  overrides: Partial<RecurringJsmRefreshDependencies> = {}
): RecurringJsmRefreshDependencies {
  const clock = [NOW, new Date("2026-09-16T06:00:01.000Z")];
  return {
    listServices: vi.fn().mockResolvedValue([
      {
        id: 1,
        serviceName: "Soporte Uno",
        status: "activo",
        jsmProjectKey: "JSM1",
        jsmServiceDeskId: "desk-1",
      },
      {
        id: 2,
        serviceName: "Sin vínculo",
        status: "activo",
        jsmProjectKey: null,
        jsmServiceDeskId: null,
      },
      {
        id: 3,
        serviceName: "Pausado",
        status: "pausado",
        jsmProjectKey: "JSM3",
        jsmServiceDeskId: "desk-3",
      },
    ]),
    collect: vi.fn(async input => snapshot(input.service.id)),
    persist: vi.fn(async draft => ({
      id: draft.serviceId * 10,
      capturedAt: draft.capturedAt,
      created: true,
    })),
    createAudit: vi.fn().mockResolvedValue(undefined),
    findRun: vi.fn().mockResolvedValue(null),
    now: vi.fn(() => clock.shift() ?? NOW),
    ...overrides,
  };
}

describe("runner compartido D9 de snapshots JSM", () => {
  it("procesa sólo activos vinculados y trata faltas de vínculo o inactividad como omitidos, no como errores", async () => {
    const deps = dependencies();
    const outcome = await runRecurringServicesJsmRefresh(
      {
        trigger: "manual",
        actor: { id: 7, name: "PMO", role: "pmo" },
      },
      deps
    );

    expect(outcome).toMatchObject({
      status: "success",
      candidateCount: 3,
      eligibleCount: 1,
      processedCount: 1,
      skippedCount: 2,
      successCount: 1,
      partialCount: 0,
      errorCount: 0,
    });
    expect(outcome.skippedServices.map(item => item.reason).sort()).toEqual([
      "inactive",
      "jsm_not_configured",
    ]);
    expect(deps.collect).toHaveBeenCalledTimes(1);
    expect(deps.createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recurring_service_jsm_refresh_run",
        details: expect.objectContaining({
          operationId: expect.stringContaining("manual:"),
        }),
      })
    );
  });

  it("continúa ante resultados parciales y fallos por servicio, con un resumen degradado trazable", async () => {
    const deps = dependencies({
      listServices: vi.fn().mockResolvedValue([
        {
          id: 1,
          serviceName: "Uno",
          status: "activo",
          jsmProjectKey: "A",
          jsmServiceDeskId: "1",
        },
        {
          id: 2,
          serviceName: "Dos",
          status: "activo",
          jsmProjectKey: "B",
          jsmServiceDeskId: "2",
        },
        {
          id: 3,
          serviceName: "Tres",
          status: "activo",
          jsmProjectKey: "C",
          jsmServiceDeskId: "3",
        },
      ]),
      collect: vi.fn(async input => {
        if (input.service.id === 1) return snapshot(1, "success");
        if (input.service.id === 2) return snapshot(2, "partial");
        throw new Error("JSM temporalmente no disponible");
      }),
    });

    const outcome = await runRecurringServicesJsmRefresh(
      { trigger: "manual" },
      deps
    );
    expect(outcome).toMatchObject({
      status: "partial",
      processedCount: 3,
      successCount: 1,
      partialCount: 1,
      errorCount: 1,
    });
    expect(outcome.results[2]).toMatchObject({
      status: "error",
      errorCode: "JSM_REFRESH_FAILED",
    });
    expect(outcome.results[2].errorMessage).toContain(
      "temporalmente no disponible"
    );
  });

  it("reutiliza la corrida diaria existente y no vuelve a consultar ni persistir snapshots", async () => {
    const previous = {
      status: "success" as const,
      trigger: "scheduled" as const,
      operationId: "scheduled:2026-09-16",
      startedAt: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      candidateCount: 1,
      eligibleCount: 1,
      processedCount: 1,
      deferredCount: 0,
      skippedCount: 0,
      successCount: 1,
      partialCount: 0,
      errorCount: 0,
      reusedCount: 0,
      reused: false,
      skippedServices: [],
      results: [],
    };
    const deps = dependencies({ findRun: vi.fn().mockResolvedValue(previous) });

    const outcome = await runRecurringServicesJsmRefresh(
      { trigger: "scheduled" },
      deps
    );
    expect(outcome).toMatchObject({
      reused: true,
      reusedCount: 1,
      operationId: "scheduled:2026-09-16",
    });
    expect(deps.listServices).not.toHaveBeenCalled();
    expect(deps.collect).not.toHaveBeenCalled();
    expect(deps.persist).not.toHaveBeenCalled();
  });
});

describe("programación segura D9", () => {
  it("devuelve orphan en 2xx lógico si el task UID no coincide con la configuración durable", async () => {
    const run = vi.fn();
    const outcome = await runScheduledRecurringServicesJsmRefresh(
      { taskUid: "task-desconocida" },
      {
        getSetting: vi.fn(async key =>
          key === RECURRING_JSM_TASK_UID_SETTING ? "task-vigente" : null
        ),
        run,
        now: () => NOW,
      }
    );
    expect(outcome).toEqual({ status: "skipped", skipped: "orphan" });
    expect(run).not.toHaveBeenCalled();
  });

  it("ejecuta la corrida diaria para el UID configurado y fija un operationId diario estable", async () => {
    const run = vi.fn().mockResolvedValue({ status: "success" });
    const outcome = await runScheduledRecurringServicesJsmRefresh(
      { taskUid: "task-vigente" },
      {
        getSetting: vi.fn().mockResolvedValue("task-vigente"),
        run,
        now: () => NOW,
      }
    );
    expect(outcome).toEqual({ status: "success" });
    expect(run).toHaveBeenCalledWith({
      trigger: "scheduled",
      operationId: "scheduled:2026-09-16",
      maxServices: 25,
    });
  });

  it("rechaza usuarios normales, acepta cron autenticado y entrega diagnóstico JSON en fallos inesperados", async () => {
    const response = () => {
      const res: any = { statusCode: 200, body: null };
      res.status = vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      });
      res.json = vi.fn((body: unknown) => {
        res.body = body;
        return res;
      });
      return res;
    };

    const forbidden = response();
    await createScheduledRecurringServicesJsmHandler({
      authenticateRequest: vi.fn().mockResolvedValue({ isCron: false }),
      run: vi.fn(),
      now: () => NOW,
    })(
      { originalUrl: "/api/scheduled/refreshRecurringServicesJsm" } as any,
      forbidden
    );
    expect(forbidden.statusCode).toBe(403);

    const orphan = response();
    await createScheduledRecurringServicesJsmHandler({
      authenticateRequest: vi
        .fn()
        .mockResolvedValue({ isCron: true, taskUid: "task-x" }),
      run: vi.fn().mockResolvedValue({ status: "skipped", skipped: "orphan" }),
      now: () => NOW,
    })(
      { originalUrl: "/api/scheduled/refreshRecurringServicesJsm" } as any,
      orphan
    );
    expect(orphan.statusCode).toBe(200);
    expect(orphan.body).toEqual({ status: "skipped", skipped: "orphan" });

    const failed = response();
    await createScheduledRecurringServicesJsmHandler({
      authenticateRequest: vi
        .fn()
        .mockResolvedValue({ isCron: true, taskUid: "task-x" }),
      run: vi.fn().mockRejectedValue(new Error("DB fuera de línea")),
      now: () => NOW,
    })(
      { originalUrl: "/api/scheduled/refreshRecurringServicesJsm" } as any,
      failed
    );
    expect(failed.statusCode).toBe(500);
    expect(failed.body).toMatchObject({
      status: "error",
      error: "DB fuera de línea",
      context: {
        url: "/api/scheduled/refreshRecurringServicesJsm",
        taskUid: "task-x",
      },
      timestamp: NOW.toISOString(),
    });
  });
});
