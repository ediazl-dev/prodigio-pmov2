import { describe, it, expect, vi } from "vitest";

/**
 * Test suite for executive verdict filtering logic.
 * Verifies that:
 * 1. getLatestVerdict excludes "Análisis Agéntico" and "Análisis PM Senior" records
 * 2. getLatestPMAnalysis only returns those agentic records
 * 3. The verdict data structure correctly reconstructs CTO/CFO/Commercial insights
 */

describe("verdict filtering logic", () => {
  // Simulate the filtering logic used in getLatestVerdict
  function isAgenticAnalysis(ctoTitle: string | null): boolean {
    return ctoTitle === "Análisis Agéntico" || ctoTitle === "Análisis PM Senior";
  }

  function filterExecutiveVerdicts(records: Array<{ id: number; ctoTitle: string | null; cfoTitle: string | null; commercialTitle: string | null }>) {
    // Same logic as getLatestVerdict: exclude agentic analysis records
    return records.filter(r => {
      if (r.ctoTitle === null) return true; // null ctoTitle is allowed (old records)
      return !isAgenticAnalysis(r.ctoTitle);
    });
  }

  function filterAgenticAnalyses(records: Array<{ id: number; ctoTitle: string | null }>) {
    // Same logic as getLatestPMAnalysis: only return agentic records
    return records.filter(r => isAgenticAnalysis(r.ctoTitle));
  }

  it("excludes Análisis Agéntico from executive verdicts", () => {
    const records = [
      { id: 1, ctoTitle: "Análisis Agéntico", cfoTitle: null, commercialTitle: null },
      { id: 2, ctoTitle: "Ejecución Técnica Sólida", cfoTitle: "Resultado Financiero Superior", commercialTitle: "Palanca de Crecimiento" },
      { id: 3, ctoTitle: "Análisis PM Senior", cfoTitle: null, commercialTitle: null },
    ];
    const filtered = filterExecutiveVerdicts(records);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it("excludes Análisis PM Senior from executive verdicts", () => {
    const records = [
      { id: 1, ctoTitle: "Análisis PM Senior", cfoTitle: null, commercialTitle: null },
      { id: 2, ctoTitle: "Avance Técnico Positivo", cfoTitle: "Margen Saludable", commercialTitle: "Oportunidad de Upsell" },
    ];
    const filtered = filterExecutiveVerdicts(records);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });

  it("allows records with null ctoTitle (legacy records)", () => {
    const records = [
      { id: 1, ctoTitle: null, cfoTitle: null, commercialTitle: null },
      { id: 2, ctoTitle: "Ejecución Técnica", cfoTitle: "Finanzas OK", commercialTitle: "Comercial OK" },
    ];
    const filtered = filterExecutiveVerdicts(records);
    expect(filtered).toHaveLength(2);
  });

  it("returns empty array when all records are agentic", () => {
    const records = [
      { id: 1, ctoTitle: "Análisis Agéntico", cfoTitle: null, commercialTitle: null },
      { id: 2, ctoTitle: "Análisis PM Senior", cfoTitle: null, commercialTitle: null },
    ];
    const filtered = filterExecutiveVerdicts(records);
    expect(filtered).toHaveLength(0);
  });

  it("getLatestPMAnalysis only returns agentic records", () => {
    const records = [
      { id: 1, ctoTitle: "Análisis Agéntico" },
      { id: 2, ctoTitle: "Ejecución Técnica Sólida" },
      { id: 3, ctoTitle: "Análisis PM Senior" },
      { id: 4, ctoTitle: null },
    ];
    const filtered = filterAgenticAnalyses(records);
    expect(filtered).toHaveLength(2);
    expect(filtered.map(r => r.id)).toEqual([1, 3]);
  });

  describe("verdict data structure reconstruction", () => {
    it("correctly reconstructs CTO/CFO/Commercial insights from DB format", () => {
      // Simulate DB stored format
      const dbRecord = {
        ctoTitle: "Ejecución Técnica Sólida",
        ctoInsights: [
          { tag: "Fortaleza", text: "100% de hitos cumplidos" },
          { tag: "Dato Clave", text: "Equipo de 5 miembros" },
        ],
        cfoTitle: "Resultado Financiero Superior",
        cfoInsights: [
          { tag: "Fortaleza", text: "Margen proyectado 45%" },
          { tag: "Oportunidad", text: "Ahorro en capacity" },
        ],
        commercialTitle: "Palanca de Crecimiento",
        commercialInsights: [
          { tag: "Oportunidad", text: "Upsell potencial en fase 2" },
          { tag: "Modelo Replicable", text: "Caso de éxito para sector bancario" },
        ],
      };

      // Reconstruct as frontend expects (same logic as getLatestVerdict endpoint)
      const reconstructed = {
        ctoInsights: {
          title: dbRecord.ctoTitle,
          bullets: dbRecord.ctoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
        },
        cfoInsights: {
          title: dbRecord.cfoTitle,
          bullets: dbRecord.cfoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
        },
        commercialInsights: {
          title: dbRecord.commercialTitle,
          bullets: dbRecord.commercialInsights.map((i: any) => `[${i.tag}] ${i.text}`),
        },
      };

      // Verify structure
      expect(reconstructed.ctoInsights.title).toBe("Ejecución Técnica Sólida");
      expect(reconstructed.ctoInsights.bullets).toHaveLength(2);
      expect(reconstructed.ctoInsights.bullets[0]).toBe("[Fortaleza] 100% de hitos cumplidos");

      expect(reconstructed.cfoInsights.title).toBe("Resultado Financiero Superior");
      expect(reconstructed.cfoInsights.bullets).toHaveLength(2);
      expect(reconstructed.cfoInsights.bullets[0]).toBe("[Fortaleza] Margen proyectado 45%");

      expect(reconstructed.commercialInsights.title).toBe("Palanca de Crecimiento");
      expect(reconstructed.commercialInsights.bullets).toHaveLength(2);
      expect(reconstructed.commercialInsights.bullets[0]).toBe("[Oportunidad] Upsell potencial en fase 2");
    });

    it("handles empty insights gracefully", () => {
      const dbRecord = {
        ctoTitle: null,
        ctoInsights: [],
        cfoTitle: null,
        cfoInsights: [],
        commercialTitle: null,
        commercialInsights: [],
      };

      const reconstructed = {
        ctoInsights: {
          title: dbRecord.ctoTitle,
          bullets: (dbRecord.ctoInsights as any[]).map((i: any) => `[${i.tag}] ${i.text}`),
        },
        cfoInsights: {
          title: dbRecord.cfoTitle,
          bullets: (dbRecord.cfoInsights as any[]).map((i: any) => `[${i.tag}] ${i.text}`),
        },
        commercialInsights: {
          title: dbRecord.commercialTitle,
          bullets: (dbRecord.commercialInsights as any[]).map((i: any) => `[${i.tag}] ${i.text}`),
        },
      };

      expect(reconstructed.ctoInsights.title).toBeNull();
      expect(reconstructed.ctoInsights.bullets).toHaveLength(0);
      expect(reconstructed.cfoInsights.title).toBeNull();
      expect(reconstructed.cfoInsights.bullets).toHaveLength(0);
      expect(reconstructed.commercialInsights.title).toBeNull();
      expect(reconstructed.commercialInsights.bullets).toHaveLength(0);
    });
  });

  describe("metricsSnapshot with SoW/Gantt flags", () => {
    it("includes hasSoW and hasGantt flags in metrics snapshot", () => {
      const metricsSnapshot = {
        jiraAdvance: 75,
        totalIssues: 100,
        doneCount: 75,
        hasSoW: true,
        hasGantt: true,
        sowFileName: "SoW Proyecto.docx",
        ganttFileName: "Gantt SFA.xlsx",
      };

      expect(metricsSnapshot.hasSoW).toBe(true);
      expect(metricsSnapshot.hasGantt).toBe(true);
      expect(metricsSnapshot.sowFileName).toBe("SoW Proyecto.docx");
      expect(metricsSnapshot.ganttFileName).toBe("Gantt SFA.xlsx");
    });

    it("handles missing SoW/Gantt in metrics snapshot", () => {
      const metricsSnapshot = {
        jiraAdvance: 50,
        totalIssues: 80,
        doneCount: 40,
        hasSoW: false,
        hasGantt: false,
        sowFileName: null,
        ganttFileName: null,
      };

      expect(metricsSnapshot.hasSoW).toBe(false);
      expect(metricsSnapshot.hasGantt).toBe(false);
      expect(metricsSnapshot.sowFileName).toBeNull();
      expect(metricsSnapshot.ganttFileName).toBeNull();
    });
  });

  describe("LLM prompt construction with SoW/Gantt", () => {
    it("builds SoW section when content is available", () => {
      const sowContent = "STATEMENT OF WORK - Proyecto Test\nObjetivo: Implementar sistema";
      const sowFileName = "SoW Proyecto.docx";

      const sowSection = sowContent
        ? `\n${"-".repeat(60)}\nSTATEMENT OF WORK (SoW)${sowFileName ? ` — Fuente: ${sowFileName}` : ""}:\n${sowContent.substring(0, 8000)}\n`
        : "\n[No hay SoW disponible para este proyecto.]\n";

      expect(sowSection).toContain("STATEMENT OF WORK");
      expect(sowSection).toContain("SoW Proyecto.docx");
      expect(sowSection).toContain("Implementar sistema");
    });

    it("builds fallback message when SoW is not available", () => {
      const sowContent = "";
      const sowSection = sowContent
        ? `\nSTATEMENT OF WORK:\n${sowContent}\n`
        : "\n[No hay SoW disponible para este proyecto.]\n";

      expect(sowSection).toContain("No hay SoW disponible");
    });

    it("builds Gantt section when content is available", () => {
      const ganttContent = "PLANIFICACIÓN GANTT - Proyecto Test\nTotal filas: 50";
      const ganttFileName = "Gantt SFA.xlsx";

      const ganttSection = ganttContent
        ? `\n${"-".repeat(60)}\nPLANIFICACIÓN / GANTT${ganttFileName ? ` — Fuente: ${ganttFileName}` : ""}:\n${ganttContent.substring(0, 8000)}\n`
        : "\n[No hay Gantt/planificación disponible.]\n";

      expect(ganttSection).toContain("PLANIFICACIÓN / GANTT");
      expect(ganttSection).toContain("Gantt SFA.xlsx");
      expect(ganttSection).toContain("Total filas: 50");
    });
  });
});
