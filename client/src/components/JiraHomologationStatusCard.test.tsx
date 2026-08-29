import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JiraHomologationStatusCardBody, type JiraHomologationStatus } from "./JiraHomologationStatusCard";

const status: JiraHomologationStatus = {
  project: { dealId: "Deal901" },
  onboarding: { status: "ready", jiraProjectKey: "PILOT" },
  latestRun: { status: "partial", createdAt: "2026-08-29T20:00:00.000Z", completedAt: "2026-08-29T20:01:00.000Z" },
  counts: {
    risks: { imported: 2, mapped: 2 },
    wbs: { imported: 3, mapped: 4 },
    documents: { sow: 1, gantt: 0, milestoneAcceptances: 2 },
    openExceptions: 1,
  },
  exceptions: [{ id: 1, domain: "documents", sourceKey: "PILOT-30", reason: "El mapping no contiene una clave S3 real." }],
  pending: ["Gantt contractual [PENDIENTE]", "Backlog mapeado [POR CONFIRMAR]"],
};

describe("JiraHomologationStatusCardBody H6", () => {
  it("muestra Deal, importados, evidencia real, pendientes y excepciones sin ocultar faltantes", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, { status, canImport: true }));
    expect(html).toContain("Homologación Jira → Prodigio");
    expect(html).toContain("Deal901");
    expect(html).toContain("2/2");
    expect(html).toContain("3/4");
    expect(html).toContain("Gantt contractual [PENDIENTE]");
    expect(html).toContain("Backlog mapeado [POR CONFIRMAR]");
    expect(html).toContain("PILOT-30");
    expect(html).toContain("Las actas permanecen asociadas a su hito contractual");
    expect(html).toContain("Importar dominios aprobados");
  });

  it("no expone la acción de importación a un rol de solo lectura", () => {
    const html = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, { status, canImport: false }));
    expect(html).not.toContain("Importar dominios aprobados");
    expect(html).toContain("1 excepciones abiertas");
  });
});
