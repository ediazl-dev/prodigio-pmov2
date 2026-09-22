import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/ProjectDetail.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("Dashboard Ejecutivo v2 — integración obligatoria en detalle", () => {
  it("ofrece un único componente con modo autónomo e integrado", () => {
    expect(dashboard).toContain("projectIdOverride?: number");
    expect(dashboard).toContain("embedded?: boolean");
    expect(dashboard).toContain('data-dashboard-presentation={embedded ? "embedded" : "standalone"}');
    expect(dashboard).toContain("edv2-root--embedded");
    expect(dashboard).not.toContain("iframe");
  });

  it("monta el contenido v2 en las ramas vinculada y nativa del detalle", () => {
    expect(detail).toContain("function IntegratedExecutiveDashboard");
    expect(detail).toContain("<ExecutiveDashboardV2 projectIdOverride={projectId} embedded />");
    expect(detail).toContain("<IntegratedExecutiveDashboard projectId={projectId} isLinked onNavigate={setLocation} />");
    expect(detail).toContain("<IntegratedExecutiveDashboard projectId={projectId} isLinked={false} onNavigate={setLocation} />");
    expect((detail.match(/<IntegratedExecutiveDashboard/g) ?? []).length).toBe(2);
  });

  it("conserva la pantalla autónoma sólo como acceso secundario", () => {
    expect(detail).toContain("Abrir en pantalla completa");
    expect(routes).toContain('<Route path="/projects/:id/executive-dashboard-v2">{() => <ExecutiveDashboardV2 />}</Route>');
  });
});
