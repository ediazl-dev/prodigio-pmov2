import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const jiraReportSource = readFileSync(new URL("../client/src/pages/reports/JiraProjectDashboard.tsx", import.meta.url), "utf8");

function section(startMarker: string, endMarker: string) {
  const start = routersSource.indexOf(startMarker);
  const end = routersSource.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`No se encontró sección ${startMarker} → ${endMarker}`);
  return routersSource.slice(start, end);
}

describe("guardrails transversales de evidencia", () => {
  it("getExecutiveDashboardV2 no consulta Jira live ni escribe observaciones", () => {
    const source = section("getExecutiveDashboardV2:", "generateLinkedVerdict:");
    expect(source).not.toContain("getJiraAdvanceReport(");
    expect(source).not.toContain("updateExecutiveContractMilestoneJiraObservation(");
    expect(source).toContain("buildExecutiveOperationalEvidenceFromSnapshot(portfolioEvidence)");
  });

  it("la portada ejecutiva histórica usa snapshot local y el Deal resuelto por el Portafolio", () => {
    const source = section("getLinkedDashboard:", "/** Preclasificación no persistente");
    expect(source).not.toContain("getJiraAdvanceReport(");
    expect(source).toContain("portfolioEvidence?.dealId || (project as any).dealId || extractDealId(project.projectName)");
  });

  it("los dos análisis agénticos consumen el read model compartido", () => {
    const linkedVerdict = section("generateLinkedVerdict:", "getLatestVerdict:");
    const pmAnalysis = section("generatePMAnalysis:", "// ==================== LINKED PROJECT DOCUMENTS");
    expect(linkedVerdict).not.toContain("getJiraAdvanceReport(");
    expect(pmAnalysis).not.toContain("getJiraAdvanceReport(");
    expect(linkedVerdict).toContain("jiraEvidenceAvailability");
    expect(pmAnalysis).toContain("jiraEvidenceAvailability");
  });

  it("el reporte Jira no llama facturación al cierre de hitos", () => {
    expect(jiraReportSource).toContain('label: "Hitos cerrados"');
    expect(jiraReportSource).toContain("no equivale a facturación");
    expect(jiraReportSource).not.toContain('label: "Facturado"');
  });
});
