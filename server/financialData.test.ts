import { describe, expect, it, vi, beforeEach } from "vitest";
import { getFinancialDataForDeal, extractDealId } from "./financialDataFetcher";

// Mock the db module to avoid actual database calls in tests
vi.mock("./db", () => ({
  getFinancialDataByDealId: vi.fn(),
  getActiveFinancialData: vi.fn(),
}));

import { getFinancialDataByDealId, getActiveFinancialData } from "./db";

const mockGetFinancialDataByDealId = vi.mocked(getFinancialDataByDealId);
const mockGetActiveFinancialData = vi.mocked(getActiveFinancialData);

// Sample financial data row as it would come from the database
const sampleRutaPass = {
  id: 1,
  dealId: "Deal1996",
  estadoProyecto: "EN EJECUCION",
  projectName: "Ruta Pass - Plan Modernización TI",
  clientName: "Ruta Pass",
  pm: "Franklin H",
  valorVentaUF: "1200.0000",
  presupuestoUF: "571.0000",
  utilizadoUF: "859.9680",
  utilizadoUFPorc: "1.5061",
  presupuestoHH: "1500.0000",
  capacityHH: "1200.0000",
  hhPorcUtilizado: "0.8000",
  margenBrutoNotaVentaUF: "629.0000",
  porcentajeAvanceProyecto: "0.9500",
  costoProyectadoUF: "905.2300",
  margenProyectadoUF: "294.7710",
  margenProyectadoPorc: "0.2456421053",
  margenTargetPorc: "0.5240",
  capacityU: "859.9680",
  planificadoUF: "0.0000",
  proyectadoUF: "859.9680",
  margenProyectadoSegunCapacity: "0.2833",
  notas: "27/11/2025 Estamos en la etapa de cierre",
  otrosCostosUF: null,
  lineaNegocio: "Delivery",
  syncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleTanner = {
  id: 2,
  dealId: "Deal1934",
  estadoProyecto: "EN EJECUCION",
  projectName: "Tanner - Implementacion SFA",
  clientName: "Tanner",
  pm: "Franklin H",
  valorVentaUF: "8200.0000",
  presupuestoUF: "2050.0000",
  utilizadoUF: "663.3840",
  utilizadoUFPorc: "0.3236",
  presupuestoHH: "5000.0000",
  capacityHH: "3000.0000",
  hhPorcUtilizado: "0.6000",
  margenBrutoNotaVentaUF: "6150.0000",
  porcentajeAvanceProyecto: "0.1500",
  costoProyectadoUF: "4422.5600",
  margenProyectadoUF: "3777.4400",
  margenProyectadoPorc: "0.4606634146",
  margenTargetPorc: "0.7500",
  capacityU: "663.3840",
  planificadoUF: "1386.6160",
  proyectadoUF: "2050.0000",
  margenProyectadoSegunCapacity: "0.7800",
  notas: null,
  otrosCostosUF: null,
  lineaNegocio: "Delivery",
  syncedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("extractDealId", () => {
  it("extracts Deal ID from project name with brackets", () => {
    expect(extractDealId("[PMO Ruta Pass] Plan Modernización TI - Deal 1996")).toBe("Deal1996");
  });

  it("extracts Deal ID from project name with parentheses", () => {
    expect(extractDealId("Ruta Pass - Plan Modernización TI (Deal1996)")).toBe("Deal1996");
  });

  it("extracts Deal ID when already in correct format", () => {
    expect(extractDealId("Deal1996")).toBe("Deal1996");
  });

  it("extracts Deal ID from number with Deal prefix and space", () => {
    expect(extractDealId("Deal 1934")).toBe("Deal1934");
  });

  it("returns null for empty string", () => {
    expect(extractDealId("")).toBe(null);
  });

  it("returns null for string without deal ID", () => {
    expect(extractDealId("Some random project name")).toBe(null);
  });

  it("handles standalone number that looks like a deal", () => {
    expect(extractDealId("1996")).toBe("Deal1996");
  });
});

describe("getFinancialDataForDeal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveFinancialData.mockResolvedValue([sampleRutaPass, sampleTanner] as any);
  });

  it("returns financial data for a valid deal ID", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    expect(result.projectFinancial).not.toBeNull();
    expect(result.projectFinancial!.dealId).toBe("Deal1996");
    expect(result.projectFinancial!.clientName).toBe("Ruta Pass");
    expect(result.projectFinancial!.valorVentaUF).toBe(1200);
    expect(result.projectFinancial!.presupuestoUF).toBe(571);
    expect(result.projectFinancial!.utilizadoUF).toBeCloseTo(859.968, 2);
  });

  it("normalizes deal ID without Deal prefix", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("1996");

    expect(mockGetFinancialDataByDealId).toHaveBeenCalledWith("Deal1996");
    expect(result.projectFinancial).not.toBeNull();
  });

  it("returns empty data for unknown deal ID", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(undefined);

    const result = await getFinancialDataForDeal("Deal9999");

    expect(result.projectFinancial).toBeNull();
    expect(result.alerts).toHaveLength(0);
  });

  it("returns empty data for empty deal ID", async () => {
    const result = await getFinancialDataForDeal("");

    expect(result.projectFinancial).toBeNull();
    expect(result.alerts).toHaveLength(0);
    expect(result.portfolioContext).toBeNull();
  });

  it("generates critical alert for budget overrun", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    const budgetAlert = result.alerts.find(a => a.category === "Presupuesto");
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert!.type).toBe("critical");
    expect(budgetAlert!.title).toContain("Sobrecosto");
  });

  it("generates warning alert for margin below target", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    const marginAlert = result.alerts.find(a => a.category === "Margen");
    expect(marginAlert).toBeDefined();
    expect(marginAlert!.type).toBe("critical");
    expect(marginAlert!.title).toContain("target");
  });

  it("generates success alert for controlled budget (Tanner)", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleTanner as any);

    const result = await getFinancialDataForDeal("Deal1934");

    const budgetAlert = result.alerts.find(a => a.category === "Presupuesto");
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert!.type).toBe("success");
    expect(budgetAlert!.title).toContain("controlado");
  });

  it("provides portfolio context with ranking", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    expect(result.portfolioContext).not.toBeNull();
    expect(result.portfolioContext!.totalActiveProjects).toBe(2);
    expect(result.portfolioContext!.projectRank).toBeDefined();
    expect(result.portfolioContext!.avgMargenProyectadoPorc).toBeGreaterThan(0);
  });

  it("handles database errors gracefully", async () => {
    mockGetFinancialDataByDealId.mockRejectedValue(new Error("DB connection failed"));

    const result = await getFinancialDataForDeal("Deal1996");

    expect(result.projectFinancial).toBeNull();
    expect(result.alerts).toHaveLength(0);
  });

  it("generates efficiency alert when budget exceeds advance", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    const efficiencyAlert = result.alerts.find(a => a.category === "Eficiencia");
    expect(efficiencyAlert).toBeDefined();
    expect(efficiencyAlert!.type).toBe("warning");
    expect(efficiencyAlert!.title).toContain("Gasto adelantado");
  });

  it("generates capacity alert when projected exceeds budget", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleRutaPass as any);

    const result = await getFinancialDataForDeal("Deal1996");

    const capacityAlert = result.alerts.find(a => a.category === "Capacity");
    expect(capacityAlert).toBeDefined();
    expect(capacityAlert!.type).toBe("warning");
    expect(capacityAlert!.title).toContain("excede presupuesto");
  });

  it("generates margin difference analysis alert for Tanner", async () => {
    mockGetFinancialDataByDealId.mockResolvedValue(sampleTanner as any);

    const result = await getFinancialDataForDeal("Deal1934");

    const analysisAlert = result.alerts.find(a => a.category === "Análisis");
    expect(analysisAlert).toBeDefined();
    expect(analysisAlert!.type).toBe("info");
    expect(analysisAlert!.title).toContain("Diferencia entre márgenes");
  });
});
