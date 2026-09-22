import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { JiraHomologationStatusCardBody, type JiraHomologationStatus } from "./JiraHomologationStatusCard";

const historyRun = (id: number) => ({
  id,
  source: id === 20 ? "manual" : "scheduled",
  status: "partial",
  inputCount: 37,
  createdCount: 0,
  updatedCount: 31,
  skippedCount: 6,
  errorCount: 2,
  errorMessage: null,
  createdAt: `2026-09-${id === 20 ? "22" : id === 19 ? "21" : "20"}T04:00:00.000Z`,
  finishedAt: `2026-09-${id === 20 ? "22" : id === 19 ? "21" : "20"}T04:00:03.000Z`,
  details: { jiraRead: { requestedCount: 37, returnedCount: 37 } },
});

const recentRuns = [historyRun(20), historyRun(19), historyRun(18)];

const status: JiraHomologationStatus = {
  project: { dealId: null, projectName: "[PMO] CCLA SRP MVP1 Deal 4728" },
  onboarding: { status: "ready", jiraProjectKey: "PMOCCLSRPM" },
  latestRun: { status: "partial", createdAt: "2026-09-08T20:00:00.000Z", finishedAt: "2026-09-08T20:01:00.000Z" },
  latestReconciliation: recentRuns[0],
  reconciliationHistory: recentRuns,
  history: {
    recentRuns,
    totalRuns: 16,
    hasMore: true,
    visibleLimit: 3,
    statusCounts: { applied: 0, partial: 16, error: 0, running: 0 },
  },
  counts: {
    risks: { imported: 19, mapped: 0 },
    wbs: { imported: 31, mapped: 31 },
    documents: { sow: 1, gantt: 1, milestoneAcceptances: 0 },
    openExceptions: 2,
  },
  financial: {
    status: "available",
    dealId: "Deal4728",
    dealSource: "name_match",
    formallyLinked: false,
    sourceLabel: "Planilla financiera sincronizada",
    syncedAt: "2026-09-22T03:07:47.000Z",
    currency: "UF",
    contractedUf: 6533.3333,
    budgetUf: 2255,
    consumedUf: 708.98,
    projectedCostUf: 3544.9,
    projectedMarginUf: 2988.4333,
    projectedMarginPct: 0.4574132653,
    capacityProjectedUf: 1522.772,
  },
  coverage: [
    { key: "onboarding", label: "Vínculo Jira", status: "available", detail: "Listo para sincronizar" },
    { key: "financial", label: "Datos financieros", status: "available", detail: "Deal4728 disponible" },
    { key: "sow", label: "SoW contractual", status: "available", detail: "1 archivo" },
    { key: "gantt", label: "Gantt contractual", status: "available", detail: "1 archivo" },
    { key: "risks", label: "Riesgos", status: "available", detail: "19/0" },
    { key: "wbs", label: "Backlog", status: "available", detail: "31/31" },
  ],
  gaps: [{
    kind: "financial",
    severity: "info",
    label: "Formalizar el vínculo financiero",
    explanation: "Deal4728 fue detectado en el nombre y coincide con la planilla; las cifras están disponibles, pero el campo Deal de la ficha sigue vacío.",
    recommendedAction: "Validar y guardar el Deal en la ficha para dejar la asociación explícita.",
    blocksSync: false,
  }],
  exceptions: [{
    id: 1,
    domain: "planning",
    sourceKey: "PMOCCLSRPM-37",
    reason: "Jira no informa una clave de padre; la jerarquía permanece [POR CONFIRMAR].",
    severity: "warning",
    title: "Jerarquía Jira incompleta",
    whatHappened: "PMOCCLSRPM-37 no informa una épica o tarea padre.",
    impact: "El ítem se conserva, pero no se asigna automáticamente a una jerarquía para evitar una relación incorrecta.",
    recommendedAction: "Revisar el padre correcto en Jira o aprobar manualmente la relación en la homologación.",
    blocksSync: false,
  }],
  pending: ["Formalizar el vínculo financiero"],
};

describe("JiraHomologationStatusCardBody H7", () => {
  it("muestra finanzas reales, acciones comprensibles y sólo tres corridas recientes", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, {
      status,
      canImport: true,
      onOpenHistory: vi.fn(),
    }));

    expect(html).toContain("Homologación y sincronización Jira → PMO");
    expect(html).toContain("Deal4728");
    expect(html).toContain("Detectado en el nombre · coincide con la planilla");
    expect(html).toContain("UF 6.533,33");
    expect(html).toContain("UF 708,98");
    expect(html).toContain("UF 2.255,00");
    expect(html).toContain("45,7");
    expect(html).toContain("No representan facturación SII ni cobros");
    expect(html).toContain("Formalizar el vínculo financiero");
    expect(html).toContain("NO BLOQUEA");
    expect(html).toContain("Jerarquía Jira incompleta");
    expect(html).toContain("Qué ocurrió:");
    expect(html).toContain("Efecto:");
    expect(html).toContain("Qué hacer:");
    expect(html).toContain("Se muestran las 3 corridas más recientes de 16");
    expect(html).toContain("Ver las 16 corridas");
    expect((html.match(/Jira 37\/37/g) ?? []).length).toBe(3);
    expect(html).not.toContain("[POR CONFIRMAR]");
    expect(html).toContain("Sincronizar ahora");
  });

  it("no expone la acción manual a un rol de solo lectura", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, { status, canImport: false }));
    expect(html).not.toContain("Sincronizar ahora");
    expect(html).toContain("La sincronización no está bloqueada");
  });
});
