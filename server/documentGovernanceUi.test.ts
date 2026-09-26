import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const panel = readFileSync(new URL("../client/src/components/DocumentGovernancePanel.tsx", import.meta.url), "utf8");
const recurring = readFileSync(new URL("../client/src/pages/recurring/RSInitStage.tsx", import.meta.url), "utf8");
const project = readFileSync(new URL("../client/src/pages/ProjectDetail.tsx", import.meta.url), "utf8");
const report = readFileSync(new URL("../client/src/pages/admin/AdminEvidenceHistory.tsx", import.meta.url), "utf8");

describe("document governance UI", () => {
  it("usa el mismo expediente canónico en servicios y proyectos", () => {
    expect(recurring).toContain('<DocumentGovernancePanel entityType="recurring_service"');
    expect(project).toContain('<DocumentGovernancePanel entityType="project"');
    expect(report).toContain("trpc.documentGovernance.portfolio.useQuery");
  });

  it("expone estados, nueva versión, revisión, descarga, archivo e historial", () => {
    for (const label of ["Cumple", "Pendiente de validación", "Faltante", "Vencido", "Rechazado", "No aplica", "Por confirmar"]) {
      expect(panel).toContain(label);
    }
    expect(panel).toContain("Nueva versión");
    expect(panel).toContain("Registrar decisión");
    expect(panel).toContain("Descargar");
    expect(panel).toContain("Archivar");
    expect(panel).toContain("Historial ·");
  });

  it("exige el checklist financiero y permite snapshot del plan sin validarlo automáticamente", () => {
    for (const label of ["Ingreso o presupuesto", "Costos", "Margen", "Moneda", "Fecha de corte", "Aprobación financiera"]) {
      expect(panel).toContain(label);
    }
    expect(panel).toContain("snapshotProjectWorkPlan");
    expect(panel).toContain("requiere validación");
  });

  it("retira el diálogo legacy de carga recurrente y no mantiene un fallback USD", () => {
    expect(recurring).not.toContain("Subir Documento del Servicio");
    expect(recurring).not.toContain('svc.currency || "USD"');
  });
});
