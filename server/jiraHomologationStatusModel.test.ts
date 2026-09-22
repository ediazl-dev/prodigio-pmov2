import { describe, expect, it } from "vitest";
import { buildJiraHomologationStatusModel, type JiraHomologationRun } from "./jiraHomologationStatusModel";

const run = (id: number, status: string = "partial"): JiraHomologationRun => ({
  id,
  runId: `run-${id}`,
  source: id === 5 ? "manual" : "scheduled",
  status,
  inputCount: 37,
  createdCount: 0,
  updatedCount: 31,
  skippedCount: 6,
  errorCount: status === "partial" ? 2 : 0,
  errorMessage: null,
  finishedAt: `2026-09-${String(id).padStart(2, "0")}T04:00:00.000Z`,
  createdAt: `2026-09-${String(id).padStart(2, "0")}T03:59:58.000Z`,
  details: { reconciliationScope: "h7_jira_to_pmo", jiraRead: { requestedCount: 37, returnedCount: 37 } },
});

function baseInput() {
  return {
    project: { projectName: "[PMO] CCLA SRP MVP1 Deal 4728", dealId: null },
    onboardingStatus: "ready",
    financial: {
      dealId: "Deal4728",
      valorVentaUF: "6533.3333",
      presupuestoUF: "2255.0000",
      utilizadoUF: "708.9800",
      costoProyectadoUF: "3544.9000",
      margenProyectadoUF: "2988.4333",
      margenProyectadoPorc: "0.4574132653",
      proyectadoUF: "1522.7720",
      syncedAt: "2026-09-22T03:07:47.000Z",
    },
    counts: {
      risks: { imported: 19, mapped: 0 },
      wbs: { imported: 31, mapped: 31 },
      documents: { sow: 1, gantt: 1, milestoneAcceptances: 0 },
      openExceptions: 2,
    },
    exceptions: [
      {
        id: 90001,
        domain: "planning",
        sourceKey: "PMOCCLSRPM-37",
        reason: "Jira no informa una clave de padre; la jerarquía permanece [POR CONFIRMAR].",
        severity: "warning",
      },
    ],
    reconciliationRuns: [run(5), run(4), run(3), run(2), run(1)],
    totalReconciliationRuns: 16,
    reconciliationStatusCounts: { partial: 16, applied: 0, error: 0, running: 0 },
    visibleHistoryLimit: 3,
  };
}

describe("buildJiraHomologationStatusModel", () => {
  it("resuelve Deal4728 desde el nombre sin fingir una asociación formal y expone cifras UF", () => {
    const model = buildJiraHomologationStatusModel(baseInput());

    expect(model.financial).toMatchObject({
      status: "available",
      dealId: "Deal4728",
      dealSource: "name_match",
      formallyLinked: false,
      contractedUf: 6533.3333,
      consumedUf: 708.98,
      budgetUf: 2255,
      projectedCostUf: 3544.9,
      projectedMarginPct: 0.4574132653,
    });
    expect(model.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "financial",
        label: "Formalizar el vínculo financiero",
        blocksSync: false,
      }),
    ]));
    expect(model.gaps.map((gap) => gap.label)).not.toContain("Identificar Deal financiero");
  });

  it("traduce la excepción de padre faltante a impacto y acción sin bloquear el resto", () => {
    const model = buildJiraHomologationStatusModel(baseInput());
    expect(model.exceptions[0]).toMatchObject({
      title: "Jerarquía Jira incompleta",
      whatHappened: "PMOCCLSRPM-37 no informa una épica o tarea padre.",
      blocksSync: false,
    });
    expect(model.exceptions[0].impact).toContain("no se asigna automáticamente");
    expect(model.exceptions[0].recommendedAction).toContain("Revisar el padre correcto");
  });

  it("limita el cuerpo a tres corridas y conserva el total auditable", () => {
    const model = buildJiraHomologationStatusModel(baseInput());
    expect(model.history.recentRuns.map((item) => item.id)).toEqual([5, 4, 3]);
    expect(model.history).toMatchObject({ totalRuns: 16, hasMore: true, visibleLimit: 3 });
    expect(model.history.statusCounts.partial).toBe(16);
  });

  it("mantiene N/D cuando no existe Deal ni fila financiera", () => {
    const input = baseInput();
    input.project = { projectName: "Proyecto sin referencia financiera", dealId: null };
    input.financial = null;
    const model = buildJiraHomologationStatusModel(input);

    expect(model.financial).toMatchObject({ status: "unlinked", dealId: null, contractedUf: null, consumedUf: null });
    expect(model.gaps).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Identificar Deal financiero", blocksSync: false }),
    ]));
  });

  it("distingue un Deal formal de uno inferido por el nombre", () => {
    const input = baseInput();
    input.project = { projectName: "Proyecto CCLA", dealId: "Deal4728" };
    const model = buildJiraHomologationStatusModel(input);

    expect(model.financial).toMatchObject({ dealSource: "project_field", formallyLinked: true });
    expect(model.gaps.some((gap) => gap.label === "Formalizar el vínculo financiero")).toBe(false);
  });

  it("reconoce un contrato del proyecto como vínculo financiero formal", () => {
    const input = baseInput();
    input.linkedDealIds = ["Deal4728"];
    const model = buildJiraHomologationStatusModel(input);

    expect(model.financial).toMatchObject({ dealSource: "contract_link", formallyLinked: true });
    expect(model.gaps.some((gap) => gap.label === "Formalizar el vínculo financiero")).toBe(false);
  });
});
