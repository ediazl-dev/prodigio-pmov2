import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const runLiveLlmTests = process.env.RUN_LIVE_LLM_TESTS === "true";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "planning-agentic-live-admin",
      email: "admin@prodigio.tech",
      name: "Administrador de Prueba",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {}, cookie: () => {} } as unknown as TrpcContext["res"],
  };
}

describe.runIf(runLiveLlmTests)("planificación agéntica con PERT y Gantt", () => {
  it("genera WBS con PERT normalizado, ruta crítica, hitos y backlog desde un Gantt", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const suffix = Date.now();
    const project = await caller.projects.create({
      projectName: `Prueba planificación ${suffix}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });

    const wbs = await caller.wbs.generate({
      projectId: project.id,
      context: "Implementación de una API de clientes con autenticación, pruebas automatizadas y despliegue productivo.",
    });

    expect(wbs.success).toBe(true);
    expect(wbs.tasks.length).toBeGreaterThanOrEqual(12);
    expect(wbs.billing.length).toBeGreaterThan(0);
    expect(wbs.tasks.some((task: any) => task.isCritical)).toBe(true);

    for (const task of wbs.tasks.filter((item: any) => [item.optimistic, item.probable, item.pessimistic].every((value: unknown) => Number.isFinite(Number(value))))) {
      const expected = Math.round(((Number(task.optimistic) + 4 * Number(task.probable) + Number(task.pessimistic)) / 6) * 10) / 10;
      expect(task.expected).toBe(expected);
    }

    const backlog = await caller.wbs.generateBacklogFromGantt({
      projectId: project.id,
      ganttRows: [
        { rowIndex: 1, level: 1, name: "Construcción de API", isHito: false, isSummary: false, duration: "10 días", startDate: "2026-09-01", endDate: "2026-09-12", predecessors: null, resources: "Dev Backend", percentComplete: 0 },
        { rowIndex: 2, level: 2, name: "Implementar autenticación", isHito: false, isSummary: false, duration: "4 días", startDate: "2026-09-01", endDate: "2026-09-04", predecessors: null, resources: "Dev Backend", percentComplete: 0 },
        { rowIndex: 3, level: 1, name: "Hito de aceptación API", isHito: true, isSummary: false, duration: "0 días", startDate: "2026-09-12", endDate: "2026-09-12", predecessors: "2", resources: "PM", percentComplete: 0 },
      ],
    });

    expect(backlog.success).toBe(true);
    const persisted = await caller.wbs.get({ projectId: project.id });
    expect(persisted.some((task: any) => task.issueLevel === "milestone" && task.isCritical)).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "epic")).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "task")).toBe(true);
  }, 120_000);
});
