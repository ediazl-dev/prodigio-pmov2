import { describe, expect, it } from "vitest";
import { isRecurringAnalysisOlderThanConfiguration as older } from "./recurringAnalysisFreshness";
describe("frescura del análisis tras configurar JSM", () => {
  it("invalida el análisis de septiembre tras configurar en octubre", () => expect(older({ configuredAt: "2026-10-21T23:26:00Z", analysisCreatedAt: "2026-09-30T18:08:00Z" })).toBe(true));
  it("mantiene un análisis posterior o de la misma fecha", () => {
    expect(older({ configuredAt: "2026-10-21T23:26:00Z", analysisCreatedAt: "2026-10-22T00:00:00Z" })).toBe(false);
    expect(older({ configuredAt: "2026-10-21T23:26:00Z", analysisCreatedAt: "2026-10-21T23:26:00Z" })).toBe(false);
  });
  it("no invalida servicios sin cambio de configuración fechado", () => expect(older({ analysisCreatedAt: "2026-09-30T18:08:00Z" })).toBe(false));
  it("no acepta un análisis sin fecha o con fecha inválida después de configurar", () => {
    expect(older({ configuredAt: "2026-10-21T23:26:00Z" })).toBe(true);
    expect(older({ configuredAt: "2026-10-21T23:26:00Z", analysisCreatedAt: "incorrecta" })).toBe(true);
  });
});
