import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

describe("Dashboard Ejecutivo v2 — accesibilidad de la navegación", () => {
  it("expone una navegación con nombre accesible y enlaces hacia las siete secciones", () => {
    expect(component).toContain('aria-label="Secciones del dashboard ejecutivo"');
    ["#hitos", "#finanzas", "#exigencias", "#operacion", "#minutas", "#perspectivas", "#trazabilidad"].forEach((target) => {
      expect(component).toContain(`href="${target}"`);
    });
  });

  it("usa pestañas con selección, controles y navegación por flechas", () => {
    expect(component).toContain('role="tablist"');
    expect(component).toContain('role="tab"');
    expect(component).toContain('role="tabpanel"');
    expect(component).toContain("aria-selected={derivedView === view.id}");
    expect(component).toContain('aria-controls={`panel-${view.id}`}');
    expect(component).toContain('event.key === "ArrowRight" || event.key === "ArrowLeft"');
  });

  it("mantiene un foco visible de alto contraste para enlaces, botones y pestañas", () => {
    expect(styles).toContain(".edv2-root :is(a, button, [role=\"tab\"]):focus-visible");
    expect(styles).toContain("outline: 3px solid #e91e8c");
  });

  it("presenta las señales operativas colapsadas y desaturadas, sin atribuirles gobierno del estado", () => {
    expect(component).toContain('tag="no gobierna el estado"');
    expect(component).toContain('className="edv2-card edv2-secondary-signal"');
    expect(component).not.toContain('className="edv2-card" open><summary><span>Jira / backlog</span>');
    expect(styles).toContain(".edv2-root .edv2-secondary-signal");
    expect(styles).toContain("filter: saturate(.35)");
  });
});
