import { describe, expect, it } from "vitest";

/**
 * Tests de la lógica del fallback de la Consola de Gobierno para proyectos
 * sin baseline ejecutivo aprobado (Opción A autorizada por Keno 2026-08-20).
 *
 * La lógica se replica aquí de forma pura para validar el contrato:
 * - estado = semáforo del último executive_verdict (o AMARILLO si no hay)
 * - PA alternativo = severidad×0.5 + exposiciónNorm×0.3 + (100−avanceJira)×0.2
 * - sinBaseline = true, gatillos = [], hitosVencidos = 0
 */

const SEVERIDAD_MAP: Record<string, number> = { CRITICO: 100, ROJO: 75, NARANJO: 50, AMARILLO: 25, VERDE: 0 };
const ESTADOS_VALIDOS = ["CRITICO", "ROJO", "NARANJO", "AMARILLO", "VERDE"];

function computeFallback(input: {
  semaphore?: string | null;
  jiraAdvance?: number | null;
  valorVentaUF?: number | null;
}) {
  const estadoRaw = input.semaphore?.toUpperCase() ?? null;
  const estadoValido = ESTADOS_VALIDOS.includes(estadoRaw ?? "") ? estadoRaw! : "AMARILLO";
  const severidad = SEVERIDAD_MAP[estadoValido] ?? 25;
  const exposicionUf = input.valorVentaUF != null ? Number(input.valorVentaUF) : null;
  const exposicionNorm = exposicionUf != null ? Math.min(100, Math.round((exposicionUf / 2000) * 100)) : 0;
  const jiraAdvance = typeof input.jiraAdvance === "number" ? input.jiraAdvance : null;
  const riesgoOperativo = jiraAdvance != null ? Math.max(0, Math.min(100, 100 - jiraAdvance)) : 50;
  const pa = Math.round(severidad * 0.5 + exposicionNorm * 0.3 + riesgoOperativo * 0.2);
  return { estado: estadoValido, pa, ige: jiraAdvance, ufEnRiesgo: exposicionUf, sinBaseline: true, requiereAtencion: estadoValido !== "VERDE" };
}

function extractDealId(projectName: string): string | null {
  const m = projectName.match(/Deal\s*(\d+)/i);
  return m ? `Deal${m[1]}` : null;
}

describe("Fallback Consola de Gobierno — proyectos sin baseline", () => {
  it("usa el semáforo del veredicto IA cuando existe (ROJO)", () => {
    const r = computeFallback({ semaphore: "rojo", jiraAdvance: 22, valorVentaUF: 1100 });
    expect(r.estado).toBe("ROJO");
    expect(r.sinBaseline).toBe(true);
    expect(r.requiereAtencion).toBe(true);
  });

  it("cae en AMARILLO cuando no hay veredicto (Sin evaluar)", () => {
    const r = computeFallback({ semaphore: null, jiraAdvance: null, valorVentaUF: 397 });
    expect(r.estado).toBe("AMARILLO");
    expect(r.ige).toBeNull();
    expect(r.requiereAtencion).toBe(true);
  });

  it("normaliza semáforos en minúscula o mixtos (Amarillo → AMARILLO)", () => {
    expect(computeFallback({ semaphore: "Amarillo" }).estado).toBe("AMARILLO");
    expect(computeFallback({ semaphore: "verde" }).estado).toBe("VERDE");
  });

  it("rechaza semáforos desconocidos y cae en AMARILLO", () => {
    expect(computeFallback({ semaphore: "AZUL_RARO" }).estado).toBe("AMARILLO");
  });

  it("calcula PA alternativo con la fórmula severidad×0.5 + exposición×0.3 + riesgo×0.2", () => {
    // ROJO=75, 1100UF→55, avance 22%→riesgo 78 → 75*0.5 + 55*0.3 + 78*0.2 = 37.5+16.5+15.6 = 69.6 → 70
    const r = computeFallback({ semaphore: "ROJO", jiraAdvance: 22, valorVentaUF: 1100 });
    expect(r.pa).toBe(70);
  });

  it("capa la exposición normalizada en 100 para deals ≥ 2000 UF", () => {
    const r = computeFallback({ semaphore: "VERDE", jiraAdvance: 100, valorVentaUF: 5000 });
    // VERDE=0, expo=100, riesgo=0 → 0 + 30 + 0 = 30
    expect(r.pa).toBe(30);
  });

  it("usa riesgo operativo neutro (50) cuando no hay avance Jira", () => {
    const r = computeFallback({ semaphore: "AMARILLO", jiraAdvance: null, valorVentaUF: null });
    // 25*0.5 + 0 + 50*0.2 = 12.5 + 10 = 22.5 → 23 (Math.round)
    expect(r.pa).toBe(23);
  });

  it("proyecto VERDE no requiere atención", () => {
    const r = computeFallback({ semaphore: "VERDE", jiraAdvance: 95, valorVentaUF: 100 });
    expect(r.requiereAtencion).toBe(false);
  });

  it("extrae Deal ID del nombre del proyecto", () => {
    expect(extractDealId("[PMO Consalud] Implementación Apigee - Deal 4529")).toBe("Deal4529");
    expect(extractDealId("[PMO_ST|Isapre Consalud] Servicio CloudOps|Deal 4687 - Staffing")).toBe("Deal4687");
    expect(extractDealId("[PMO Prodigio] Nexos SFA")).toBeNull();
  });
});
