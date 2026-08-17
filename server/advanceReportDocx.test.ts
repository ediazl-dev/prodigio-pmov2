import { describe, expect, it } from "vitest";
import { generateAdvanceReportDocx } from "./advanceReportDocx";

describe("generateAdvanceReportDocx", () => {
  it("genera un documento DOCX válido a partir de un reporte de avance", async () => {
    const buffer = await generateAdvanceReportDocx({
      projectName: "Proyecto de validación Prodigio",
      dealId: "DEAL-001",
      report: {
        totalIssues: 12,
        doneCount: 6,
        inProgressCount: 4,
        toDoCount: 2,
        percentComplete: 50,
        lastUpdated: new Date().toISOString(),
        milestonesCumplidos: 1,
        milestonesPendientes: 1,
        milestoneCompletionPct: 50,
        primaryProgressPct: 50,
        primaryProgressSource: "MILESTONES",
        epics: [],
        milestones: [],
        risks: [],
        scopeChanges: [],
        team: [],
        byStatus: [{ status: "En progreso", count: 4, percentage: 33 }],
        byType: [],
      } as any,
      summary: {
        summary: "El proyecto mantiene avance conforme a la planificación de validación.",
        semaphore: "VERDE",
        semaphoreDescription: "Sin bloqueos críticos.",
        nextSteps: [{ title: "Continuar ejecución", description: "Mantener el seguimiento semanal.", priority: "MEDIA" }],
      },
    });

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(1_000);
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });
});
