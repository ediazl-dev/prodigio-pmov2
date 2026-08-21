import { describe, expect, it } from "vitest";
import { bcchDateToISO, parseBcchResponse, parseFindicResponse } from "./ufService";

describe("ufService — parsing", () => {
  it("bcchDateToISO convierte DD-MM-YYYY a YYYY-MM-DD", () => {
    expect(bcchDateToISO("20-08-2026")).toBe("2026-08-20");
    expect(bcchDateToISO("01-01-2026")).toBe("2026-01-01");
  });

  it("parseFindicResponse extrae el valor más reciente", () => {
    const json = {
      codigo: "uf",
      serie: [
        { fecha: "2026-08-20", valor: 40859.28 },
        { fecha: "2026-08-19", valor: 40857.96 },
      ],
    };
    expect(parseFindicResponse(json)).toEqual({ fecha: "2026-08-20", valorCLP: 40859.28 });
  });

  it("parseFindicResponse retorna null con respuesta inválida", () => {
    expect(parseFindicResponse(null)).toBeNull();
    expect(parseFindicResponse({})).toBeNull();
    expect(parseFindicResponse({ serie: [] })).toBeNull();
  });

  it("parseBcchResponse extrae el último valor OK", () => {
    const json = {
      Codigo: 0,
      Series: {
        Obs: [
          { indexDateString: "18-08-2026", value: "40856.64", statusCode: "OK" },
          { indexDateString: "19-08-2026", value: "40857.96", statusCode: "OK" },
          { indexDateString: "20-08-2026", value: "40859.28", statusCode: "OK" },
        ],
      },
    };
    expect(parseBcchResponse(json)).toEqual({ fecha: "2026-08-20", valorCLP: 40859.28 });
  });

  it("parseBcchResponse retorna null con error de la API", () => {
    expect(parseBcchResponse({ Codigo: -50, Series: { Obs: null } })).toBeNull();
    expect(parseBcchResponse({ Codigo: -5 })).toBeNull();
    expect(parseBcchResponse(null)).toBeNull();
  });

  it("parseBcchResponse filtra observaciones con statusCode distinto de OK", () => {
    const json = {
      Codigo: 0,
      Series: {
        Obs: [
          { indexDateString: "18-08-2026", value: "40856.64", statusCode: "OK" },
          { indexDateString: "19-08-2026", value: "", statusCode: "ND" },
        ],
      },
    };
    expect(parseBcchResponse(json)).toEqual({ fecha: "2026-08-18", valorCLP: 40856.64 });
  });
});

describe("ufService — validación del secreto BCCH_API_TOKEN", () => {
  it("el token del Banco Central responde Success para la serie UF F073.UFF.PRE.Z.D", async () => {
    const token = process.env.BCCH_API_TOKEN;
    expect(token, "BCCH_API_TOKEN debe estar configurado").toBeTruthy();
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const url = `https://si3.bcentral.cl/SieteRestWS/SieteRestWS.ashx?token=${encodeURIComponent(token!)}&function=GetSeries&timeseries=F073.UFF.PRE.Z.D&firstdate=${weekAgo}&lastdate=${today}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const json = await res.json();
      expect(json.Codigo).toBe(0);
      expect(json.Series.seriesId).toBe("F073.UFF.PRE.Z.D");
      expect(Array.isArray(json.Series.Obs)).toBe(true);
      expect(json.Series.Obs.length).toBeGreaterThan(0);
      const parsed = parseBcchResponse(json);
      expect(parsed).not.toBeNull();
      expect(parsed!.valorCLP).toBeGreaterThan(30000);
    } finally {
      clearTimeout(timer);
    }
  }, 20000);
});
