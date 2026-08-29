import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JiraHomologationStatusCardBody, type JiraHomologationStatus } from "./JiraHomologationStatusCard";

const historyRun = {
  id: 20,
  source: "manual",
  status: "applied",
  inputCount: 6,
  createdCount: 1,
  updatedCount: 4,
  skippedCount: 1,
  errorCount: 0,
  errorMessage: null,
  createdAt: "2026-08-29T21:00:00.000Z",
  finishedAt: "2026-08-29T21:00:03.000Z",
  details: { jiraRead: { requestedCount: 6, returnedCount: 6 } },
};

const status: JiraHomologationStatus = {
  project: { dealId: "Deal901" },
  onboarding: { status: "ready", jiraProjectKey: "PILOT" },
  latestRun: { status: "partial", createdAt: "2026-08-29T20:00:00.000Z", finishedAt: "2026-08-29T20:01:00.000Z" },
  latestReconciliation: historyRun,
  reconciliationHistory: [historyRun],
  counts: {
    risks: { imported: 2, mapped: 2 },
    wbs: { imported: 3, mapped: 4 },
    documents: { sow: 1, gantt: 0, milestoneAcceptances: 2 },
    openExceptions: 1,
  },
  exceptions: [{ id: 1, domain: "documents", sourceKey: "PILOT-30", reason: "El mapping no contiene una clave S3 real." }],
  pending: ["Gantt contractual [PENDIENTE]", "Backlog mapeado [POR CONFIRMAR]"],
};

describe("JiraHomologationStatusCardBody H7", () => {
  it("muestra dominios, faltantes, sincronización manual e historial sin ocultar excepciones", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, { status, canImport: true }));
    expect(html).toContain("Homologación Jira → Prodigio");
    expect(html).toContain("Deal901");
    expect(html).toContain("2/2");
    expect(html).toContain("3/4");
    expect(html).toContain("Gantt contractual [PENDIENTE]");
    expect(html).toContain("Backlog mapeado [POR CONFIRMAR]");
    expect(html).toContain("PILOT-30");
    expect(html).toContain("Las actas permanecen asociadas a su hito contractual");
    expect(html).toContain("Sincronizar ahora");
    expect(html).toContain("Historial de sincronización");
    expect(html).toContain("Manual");
    expect(html).toContain("Aplicada");
    expect(html).toContain("Jira 6/6");
  });

  it("no expone la acción manual a un rol de solo lectura", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, { status, canImport: false }));
    expect(html).not.toContain("Sincronizar ahora");
    expect(html).toContain("1 excepciones abiertas");
  });
});
