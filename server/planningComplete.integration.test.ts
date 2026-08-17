import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const invokeLLMMock = vi.hoisted(() => vi.fn());

vi.mock("./_core/llm", () => ({
  invokeLLM: invokeLLMMock,
}));

import { appRouter } from "./routers";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "planning-complete-test-admin",
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

const structuredWbs = {
  tasks: Array.from({ length: 12 }, (_, index) => {
    const phase = ["preparacion", "inicio", "planificacion", "analisis", "construccion", "cierre"][Math.floor(index / 2)];
    return {
      taskCode: `${Math.floor(index / 2) + 1}.${(index % 2) + 1}`,
      taskName: `Actividad de planificación ${index + 1}`,
      phase,
      optimistic: 1,
      probable: 2,
      pessimistic: 4,
      expected: 99,
      isCritical: index === 8 || index === 9,
      dependencies: index === 0 ? "" : `${Math.floor((index - 1) / 2) + 1}.${((index - 1) % 2) + 1}`,
      assignee: index % 2 ? "QA" : "PM",
    };
  }),
  billingMilestones: [
    { description: "Planificación aprobada", percentage: "30", amount: "3000" },
    { description: "Construcción completada", percentage: "40", amount: "4000" },
    { description: "Cierre aprobado", percentage: "30", amount: "3000" },
  ],
};

describe("planificación completa no optativa", () => {
  it("normaliza PERT y genera ruta crítica, hitos y backlog desde un Gantt", async () => {
    invokeLLMMock.mockReset();
    invokeLLMMock
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(structuredWbs) } }] })
      .mockResolvedValue({ choices: [{ message: { content: "{}" } }] });

    const caller = appRouter.createCaller(createAdminContext());
    const project = await caller.projects.create({
      projectName: `Prueba planificación determinista ${Date.now()}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });

    const wbs = await caller.wbs.generate({ projectId: project.id, context: "Implementar una plataforma con integración y aseguramiento de calidad." });
    expect(wbs.success).toBe(true);
    expect(wbs.tasks).toHaveLength(12);
    expect(wbs.billing).toHaveLength(3);
    expect(wbs.tasks.filter((task: any) => task.isCritical)).toHaveLength(2);
    expect(wbs.tasks.every((task: any) => task.expected === 2.2)).toBe(true);

    const backlog = await caller.wbs.generateBacklogFromGantt({
      projectId: project.id,
      ganttRows: [
        { rowIndex: 1, level: 1, name: "Construcción de plataforma", isHito: false, isSummary: false, duration: "10 días", startDate: "2026-09-01", endDate: "2026-09-12", predecessors: null, resources: "Dev Backend", percentComplete: 0 },
        { rowIndex: 2, level: 2, name: "Implementar integración", isHito: false, isSummary: false, duration: "4 días", startDate: "2026-09-01", endDate: "2026-09-04", predecessors: null, resources: "Dev Backend", percentComplete: 0 },
        { rowIndex: 3, level: 1, name: "Hito de aceptación", isHito: true, isSummary: false, duration: "0 días", startDate: "2026-09-12", endDate: "2026-09-12", predecessors: "2", resources: "PM", percentComplete: 0 },
      ],
    });
    expect(backlog.success).toBe(true);

    const persisted = await caller.wbs.get({ projectId: project.id });
    expect(persisted.some((task: any) => task.issueLevel === "epic")).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "task")).toBe(true);
    expect(persisted.some((task: any) => task.issueLevel === "milestone" && task.isCritical)).toBe(true);
  });
});
