import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/ProjectDetail.tsx", import.meta.url), "utf8");
const summary = readFileSync(new URL("../client/src/components/ProjectExecutiveSummary.tsx", import.meta.url), "utf8");
const routes = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("Dashboard Ejecutivo — separación entre portada y pantalla completa", () => {
  it("mantiene el Dashboard v2 exclusivamente como pantalla autónoma", () => {
    expect(dashboard).toContain('data-dashboard-presentation="standalone"');
    expect(dashboard).not.toContain("projectIdOverride");
    expect(dashboard).not.toContain("embedded?: boolean");
    expect(dashboard).not.toContain("edv2-root--embedded");
    expect(dashboard).not.toContain("iframe");
  });

  it("monta una portada ejecutiva compacta en las ramas vinculada y nativa", () => {
    expect(detail).toContain('import { ProjectExecutiveSummary } from "@/components/ProjectExecutiveSummary"');
    expect((detail.match(/<ProjectExecutiveSummary/g) ?? []).length).toBe(2);
    expect(detail).not.toContain("<ExecutiveDashboardV2");
    expect(detail).not.toContain("Dashboard Ejecutivo v2 integrado");
  });

  it("conserva un único acceso a pantalla completa y un fallback histórico sin pantalla muerta", () => {
    expect(summary).toContain("Abrir Dashboard Ejecutivo");
    expect(summary).toContain("/executive-dashboard-v2");
    expect(summary).toContain("/linked-dashboard");
    expect(routes).toContain('<Route path="/projects/:id/executive-dashboard-v2">{() => <ExecutiveDashboardV2 />}</Route>');
  });
});
