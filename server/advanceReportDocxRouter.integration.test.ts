import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const getJiraAdvanceReportMock = vi.hoisted(() => vi.fn());
const storagePutMock = vi.hoisted(() => vi.fn());

vi.mock("./jiraClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./jiraClient")>()),
  getJiraAdvanceReport: getJiraAdvanceReportMock,
}));

vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePut: storagePutMock,
}));

import { appRouter } from "./routers";
import { createJiraSpaceRecord } from "./db";

function createAdminContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "advance-docx-router-admin",
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

describe("exportación integrada de reporte DOCX", () => {
  it("obtiene el avance, genera el documento, lo almacena y devuelve una URL descargable", async () => {
    getJiraAdvanceReportMock.mockResolvedValue({
      totalIssues: 12, doneCount: 6, inProgressCount: 4, toDoCount: 2, percentComplete: 50,
      lastUpdated: new Date().toISOString(), milestonesCumplidos: 1, milestonesPendientes: 1,
      milestoneCompletionPct: 50, primaryProgressPct: 50, primaryProgressSource: "MILESTONES",
      epics: [], milestones: [], risks: [], scopeChanges: [], team: [], byStatus: [], byType: [],
    });
    storagePutMock.mockResolvedValue({ key: "advance-reports/test.docx", url: "https://storage.example/prodigio-avance.docx" });

    const caller = appRouter.createCaller(createAdminContext());
    const project = await caller.projects.create({
      projectName: `Avance DOCX ${Date.now()}`,
      clientName: "Cliente de prueba",
      projectType: "desarrollo",
    });
    await createJiraSpaceRecord({
      projectId: project.id,
      spaceName: `Space DOCX ${project.id}`,
      jiraProjectKey: "PDOCX",
      jiraProjectId: "PDOCX-1",
      status: "linked",
      createdBy: 1,
      createdByName: "Administrador de Prueba",
    });

    const result = await caller.advance.generateDocx({
      projectId: project.id,
      summary: {
        summary: "Avance controlado para validar el flujo DOCX.",
        semaphore: "VERDE",
        semaphoreDescription: "Sin bloqueos críticos.",
        nextSteps: [{ title: "Continuar ejecución", description: "Mantener el seguimiento semanal.", priority: "MEDIA" }],
      },
    });

    expect(getJiraAdvanceReportMock).toHaveBeenCalledWith("PDOCX");
    expect(storagePutMock).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^advance-reports/${project.id}/`)),
      expect.any(Buffer),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result).toMatchObject({ success: true, url: "https://storage.example/prodigio-avance.docx" });
    expect(result.fileName).toMatch(/^Reporte_.*\.docx$/);
  });
});
