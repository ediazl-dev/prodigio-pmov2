import { describe, expect, it, vi } from "vitest";

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "{}" } }] })),
}));

import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "planning-fallback-admin",
      email: "admin@prodigio.tech",
      name: "Administrador Prodigio",
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

describe("contingencia determinista de planificación", () => {
  it("crea una WBS y backlog válidos cuando la IA devuelve una estructura vacía", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    const project = await caller.projects.create({
      projectName: `Prueba contingencia planificación ${Date.now()}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });

    const wbs = await caller.wbs.generate({
      projectId: project.id,
      context: "Implementación de portal de proyectos con integración Jira y gestión de riesgos.",
    });
    expect(wbs.success).toBe(true);
    expect(wbs.tasks.length).toBeGreaterThanOrEqual(12);
    expect(wbs.tasks.some((task: any) => task.isCritical)).toBe(true);

    const backlog = await caller.wbs.generateBacklogFromGantt({
      projectId: project.id,
      ganttRows: [
        { rowIndex: 1, level: 1, name: "Construcción", isHito: false, isSummary: false, duration: "5 días", startDate: "2026-09-01", endDate: "2026-09-05", predecessors: null, resources: "Desarrollo", percentComplete: 0 },
        { rowIndex: 2, level: 2, name: "Configurar integración", isHito: false, isSummary: false, duration: "3 días", startDate: "2026-09-01", endDate: "2026-09-03", predecessors: null, resources: "Desarrollo", percentComplete: 0 },
        { rowIndex: 3, level: 1, name: "Hito de entrega", isHito: true, isSummary: false, duration: "0 días", startDate: "2026-09-05", endDate: "2026-09-05", predecessors: "2", resources: "PM", percentComplete: 0 },
      ],
    });
    expect(backlog.success).toBe(true);

    const persisted = await caller.wbs.get({ projectId: project.id });
    expect(persisted.some((task: any) => task.issueLevel === "epic")).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "task")).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "milestone" && task.isCritical)).toBe(true);
  });
});
