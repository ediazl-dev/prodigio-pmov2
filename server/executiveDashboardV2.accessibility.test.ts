import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const component = readFileSync(new URL("../client/src/pages/stages/ExecutiveDashboardV2.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

function contrastRatio(foreground: string, background: string) {
  const luminance = (hex: string) => {
    const channels = hex.replace("#", "").match(/.{2}/g)!.map((channel) => Number.parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

describe("Dashboard Ejecutivo v2 — accesibilidad de la navegación", () => {
  it("expone un rail lateral con nombre accesible y enlaces hacia las zonas ejecutivas", () => {
    expect(component).toContain('aria-label="Navegación lateral del dashboard ejecutivo"');
    expect(component).toContain('className="edv2-side-nav"');
    ["#veredicto", "#hitos", "#finanzas", "#exigencias", "#operacion", "#minutas", "#perspectivas", "#trazabilidad"].forEach((target) => {
      expect(component).toContain(`href="${target}"`);
    });
    expect(component).toContain('className="edv2-side-nav-return"');
    expect(component).toContain('href={`/projects/${projectId}`}');
    expect(component).toContain("← Volver al proyecto");
  });

  it("aplica un layout lateral visible y una alternativa desplazable para pantallas estrechas", () => {
    expect(component).toContain(".edv2-body-shell{display:flex;align-items:flex-start;gap:0;background:var(--p)}");
    expect(component).toContain(".edv2-side-nav{position:sticky;top:60px;z-index:35;display:flex;flex:0 0 224px");
    expect(component).toContain(".edv2-main-content{min-width:0;flex:1}");
    expect(component).toContain(".edv2-side-nav{position:sticky;top:60px;display:flex;min-height:auto;max-height:none;flex-direction:row;align-items:center;overflow-x:auto");
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

  it("respeta la preferencia de reducción de movimiento sin afectar la lectura del tablero", () => {
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("transition-duration: .01ms !important");
    expect(styles).toContain("animation-duration: .01ms !important");
  });

  it("mantiene reglas adaptativas y contenedores desplazables para pantallas estrechas", () => {
    expect(component).toContain("@media(max-width:980px)");
    expect(component).toContain("@media(max-width:640px)");
    expect(component).toContain(".edv2-table-wrap{overflow:auto}");
    expect(component).toContain(".edv2-kpis{grid-template-columns:1fr}");
    expect(component).toContain(".edv2-gantt-axis,.edv2-gantt-row{grid-template-columns:1fr}");
  });

  it("mantiene contraste WCAG AA para texto y contraste de interfaz para el foco", () => {
    expect(contrastRatio("#0D1117", "#F2F4F7")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#5A6472", "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#E91E8C", "#F2F4F7")).toBeGreaterThanOrEqual(3);
  });
});
