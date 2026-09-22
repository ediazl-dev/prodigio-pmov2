import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminEvidenceHistory.tsx"), "utf8");
const app = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const layout = readFileSync(resolve(process.cwd(), "client/src/components/DashboardLayout.tsx"), "utf8");
const audit = readFileSync(resolve(process.cwd(), "client/src/pages/admin/AdminAuditLog.tsx"), "utf8");

describe("AdminEvidenceHistory", () => {
  it("está protegida por AdminGuard y accesible desde Administración", () => {
    expect(app).toContain('<Route path="/admin/evidence-history">{() => <AdminGuard><AdminEvidenceHistory /></AdminGuard>}</Route>');
    expect(layout).toContain('label: "Evidencia documental", path: "/admin/evidence-history"');
  });

  it("ofrece filtros, paginación y gestión segura de pendientes", () => {
    expect(page).toContain("Pendientes vigentes");
    expect(page).toContain("Pendientes expirados");
    expect(page).toContain("Todos los proyectos");
    expect(page).toContain("Página anterior");
    expect(page).toContain("Página siguiente");
    expect(page).toContain("Descartar documento");
    expect(page).toContain("Restaurar");
  });

  it("no expone token, URL, fileKey ni hash en la interfaz", () => {
    expect(page).not.toContain("receiptToken");
    expect(page).not.toContain("fileUrl");
    expect(page).not.toContain("fileKey");
    expect(page).not.toContain("fileSha256");
  });

  it("presenta descarte y restauración con etiquetas legibles en Auditoría", () => {
    expect(audit).toContain('executive_evidence_discarded: "Descartar evidencia"');
    expect(audit).toContain('executive_evidence_restored: "Restaurar evidencia"');
    expect(audit).toContain('executive_evidence_upload: "Evidencia documental"');
  });
});
