import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminEvidenceHistory.tsx"), "utf8");
const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const audit = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminAuditLog.tsx"), "utf8");

describe("AdminEvidenceHistory", () => {
  it("está disponible como reporte autenticado y conserva redirección desde la URL anterior", () => {
    expect(app).toContain('<Route path="/reports/evidence" component={AdminEvidenceHistory} />');
    expect(app).toContain('<Route path="/admin/evidence-history">{() => <Redirect to="/reports/evidence" />}</Route>');
    expect(layout).toContain('label: "Evidencia documental", path: "/reports/evidence"');
  });

  it("presenta cobertura documental como vista principal", () => {
    expect(page).toContain("Cobertura y cumplimiento documental");
    expect(page).toContain('value="coverage"');
    expect(page).toContain("Entidades evaluadas");
    expect(page).toContain("Cobertura medible");
    expect(page).toContain("Requisitos faltantes");
    expect(page).toContain("Rechazados o vencidos");
    expect(page).toContain("Pendientes de validar");
    expect(page).toContain("trpc.documentGovernance.portfolio.useQuery");
  });

  it("diferencia abiertos, históricos, proyectos y servicios recurrentes", () => {
    expect(page).toContain('<SelectItem value="open">Abiertos</SelectItem>');
    expect(page).toContain('<SelectItem value="historical">Históricos</SelectItem>');
    expect(page).toContain('<SelectItem value="project">Sólo proyectos</SelectItem>');
    expect(page).toContain('<SelectItem value="recurring_service">Sólo servicios recurrentes</SelectItem>');
    expect(page).toContain('<SelectItem value="technical_economic_proposal">Propuesta técnico-económica</SelectItem>');
    expect(page).toContain('<SelectItem value="costed_pnl">P&amp;L con costeo</SelectItem>');
    expect(page).toContain('<SelectItem value="work_plan_milestones">Plan con hitos</SelectItem>');
    expect(page).toContain("Acciones activas");
    expect(page).toContain("Antecedentes del expediente");
  });

  it("conserva el historial técnico como pestaña secundaria con gestión segura", () => {
    expect(page).toContain('value="history"');
    expect(page).toContain("Historial de cargas");
    expect(page).toContain("Pendientes vigentes");
    expect(page).toContain("Pendientes expirados");
    expect(page).toContain("Todos los proyectos");
    expect(page).toContain('aria-label="Página anterior"');
    expect(page).toContain('aria-label="Página siguiente"');
    expect(page).toContain("Descartar documento");
    expect(page).toContain("Restaurar");
  });

  it("no presenta un historial vacío como cumplimiento del expediente", () => {
    expect(page).toContain("Esto no significa que el expediente esté completo");
    expect(page).toContain("Este resultado corresponde sólo al alcance seleccionado");
  });

  it("no expone token, URL ni fileKey y muestra sólo un prefijo de hash trazable", () => {
    expect(page).not.toContain("receiptToken");
    expect(page).not.toContain("fileUrl");
    expect(page).not.toContain("fileKey");
    expect(page).not.toContain("fileSha256");
    expect(page).toContain("sha256?.slice(0, 10)");
  });

  it("presenta descarte y restauración con etiquetas legibles en Auditoría", () => {
    expect(audit).toContain('executive_evidence_discarded: "Descartar evidencia"');
    expect(audit).toContain('executive_evidence_restored: "Restaurar evidencia"');
    expect(audit).toContain('executive_evidence_upload: "Evidencia documental"');
  });
});
