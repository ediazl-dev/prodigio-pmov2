import { describe, expect, it } from "vitest";
import {
  buildComparisonPeriod,
  buildFinancialPortfolioV2,
  canonicalFinancialId,
  deriveFinancialLifecycle,
  extractFinancialIdFromName,
  normalizeFinancialPeriod,
  type FinancialBillingItemInput,
  type FinancialSnapshotInput,
} from "./financialPortfolioV2";

const snapshots: FinancialSnapshotInput[] = [
  {
    dealId: "Deal1934",
    estadoProyecto: "EN EJECUCIÓN",
    projectName: "Tanner SFA",
    clientName: "Tanner",
    valorVentaUF: "8200",
    presupuestoUF: "2050",
    utilizadoUF: "700",
    costoProyectadoUF: "2400",
    margenProyectadoUF: "5800",
    margenProyectadoPorc: "0.7073",
    margenTargetPorc: "0.75",
    lineaNegocio: "Delivery",
    syncedAt: "2026-09-25T03:00:00Z",
  },
  {
    dealId: "Deal4728",
    estadoProyecto: "EN EJECUCIÓN",
    projectName: "CCLA SRP MVP1",
    clientName: "CCLA",
    valorVentaUF: "6533.33",
    presupuestoUF: "2255",
    costoProyectadoUF: "1522.77",
    margenProyectadoUF: "5010.56",
    margenProyectadoPorc: "0.7669",
    margenTargetPorc: "0.35",
    lineaNegocio: "Delivery",
  },
  {
    dealId: "Deal4532",
    estadoProyecto: "CERRADO",
    projectName: "Assessment MaxAgro",
    clientName: "MaxAgro",
    valorVentaUF: "400",
    presupuestoUF: "180",
    costoProyectadoUF: "175",
    margenProyectadoUF: "225",
    margenProyectadoPorc: "0.5625",
    margenTargetPorc: "0.35",
    lineaNegocio: "Consultoría",
  },
  {
    dealId: "INT-Innovacion-2026",
    estadoProyecto: "EN EJECUCIÓN",
    projectName: "Iniciativa interna IA",
    clientName: "Prodigio",
    valorVentaUF: "12000",
    costoProyectadoUF: "3000",
  },
];

const billing: FinancialBillingItemInput[] = [
  {
    sourceKey: "tanner-2026-1",
    dealId: "Deal1934",
    clientName: "Tanner",
    milestoneName: "M01",
    plannedDate: "2026-02-10",
    invoicedAt: "2026-02-15",
    amount: "1000",
    currency: "UF",
    amountUsdSource: "45000",
    billingStatus: "FACTURADO",
  },
  {
    sourceKey: "tanner-2025-1",
    dealId: "Deal1934",
    clientName: "Tanner",
    milestoneName: "M00",
    plannedDate: "2025-02-10",
    invoicedAt: "2025-02-15",
    amount: "500",
    currency: "UF",
    amountUsdSource: "22000",
    billingStatus: "FACTURADO",
  },
  {
    sourceKey: "ccla-2026-1",
    dealId: "Deal4728",
    clientName: "Caja Los Andes",
    milestoneName: "M01",
    plannedDate: "2026-03-01",
    invoicedAt: null,
    amount: "900",
    currency: "UF",
    amountUsdSource: null,
    billingStatus: "NO FACTURADO",
  },
  {
    sourceKey: "maxagro-2024-1",
    dealId: "Deal4532",
    clientName: "MaxAgro",
    milestoneName: "Cierre",
    plannedDate: "2024-10-01",
    invoicedAt: "2024-10-20",
    amount: "30000000",
    currency: "CLP",
    amountUsdSource: "32000",
    billingStatus: "FACTURADO",
  },
];

const operational = [
  { kind: "project" as const, id: 180002, name: "[PMO Banco Tanner] SFA Deal 1934", dealId: "Deal1934", status: "activo" },
  { kind: "project" as const, id: 2670001, name: "[PMO] CCLA SRP MVP1 Deal 4728", dealId: null, status: "activo" },
  { kind: "project" as const, id: 4532001, name: "[PMO MaxAgro] Assessment Deal 4532", dealId: "Deal4532", status: "completado" },
];

describe("identidad financiera canónica", () => {
  it("normaliza Deal y preserva subdeals sin colapsarlos", () => {
    expect(canonicalFinancialId(" deal 1934 ")).toBe("Deal1934");
    expect(canonicalFinancialId("Deal 1742-01")).toBe("Deal1742-01");
    expect(canonicalFinancialId("1742")).toBe("Deal1742");
    expect(canonicalFinancialId("INT-Innovacion-2026")).toBe("INT-Innovacion-2026");
    expect(extractFinancialIdFromName("Proyecto Deal 4728")).toBe("Deal4728");
  });

  it("no vincula un subdeal cerrado al proyecto abierto del Deal base", () => {
    const lifecycle = deriveFinancialLifecycle(
      { dealId: "Deal1742-01", projectName: "Assessment" },
      [{ kind: "service", id: 1, name: "Soporte Deal1742", dealId: "Deal1742", status: "activo" }],
    );
    expect(lifecycle).toMatchObject({ lifecycle: "closed", source: "absent_from_open_universe" });
  });
});

describe("rango y comparación financiera", () => {
  it("valida rango y calcula período anterior inclusivo", () => {
    const period = normalizeFinancialPeriod("2026-01-01", "2026-03-31");
    expect(buildComparisonPeriod(period, "previous_period")).toEqual({ from: "2025-10-03", to: "2025-12-31" });
  });

  it("compara mismo rango del año anterior y tolera 29 de febrero", () => {
    expect(buildComparisonPeriod({ from: "2028-02-29", to: "2028-03-31" }, "prior_year")).toEqual({
      from: "2027-02-28",
      to: "2027-03-31",
    });
  });

  it("rechaza fechas invertidas", () => {
    expect(() => normalizeFinancialPeriod("2026-12-31", "2026-01-01")).toThrow(/fecha inicial/);
  });
});

describe("buildFinancialPortfolioV2", () => {
  it("deriva abiertos desde PMO/servicios y asume cerrado cuando no está abierto", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(result.lifecycle).toEqual({ total: 4, open: 2, closed: 1, internal: 1 });
    expect(result.items.find(item => item.financialId === "Deal4728")).toMatchObject({ lifecycle: "open", lifecycleSource: "project_active" });
    expect(result.items.find(item => item.financialId === "Deal4532")).toMatchObject({ lifecycle: "closed", lifecycleSource: "project_closed" });
    expect(result.items.find(item => item.financialId === "INT-Innovacion-2026")).toMatchObject({ lifecycle: "internal", lifecycleSource: "internal_initiative" });
  });

  it("calcula facturación del rango, ranking comparable y comparación interanual", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-12-31",
      granularity: "quarter",
      compareMode: "prior_year",
    });
    expect(result.current.billedNative).toEqual({ UF: 1000 });
    expect(result.current.billedUsdComparable).toBe(45000);
    expect(result.current.topClients[0]).toMatchObject({ client: "Tanner", amountUsdComparable: 45000, sharePct: 100 });
    expect(result.comparison?.billedUsdComparable).toBe(22000);
    expect(result.change).toMatchObject({ billedUsdAbsolute: 23000, billedItemsAbsolute: 0 });
    expect(result.change.billedUsdPct).toBeCloseTo(104.55, 2);
    expect(result.series).toEqual([
      expect.objectContaining({ key: "2026-Q1", billedUsdComparable: 45000, billedNative: { UF: 1000 }, plannedNative: { UF: 1900 } }),
    ]);
  });

  it("preserva monedas nativas por separado y no suma CLP con UF", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2024-01-01",
      to: "2026-12-31",
    });
    expect(result.current.billedNative).toEqual({ UF: 1500, CLP: 30000000 });
    expect(result.current.billedUsdComparable).toBe(99000);
  });

  it("mantiene facturación histórica de proyectos cerrados en el detalle", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-12-31",
    });
    const maxAgro = result.items.find(item => item.financialId === "Deal4532");
    expect(maxAgro).toMatchObject({
      lifecycle: "closed",
      billedRangeNative: {},
      billedHistoricalNative: { CLP: 30000000 },
    });
  });

  it("expone vencidos no facturados y próxima acción sin llamarlos facturas", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-09-30",
    });
    expect(result.current.overdueAtCutoffNative).toEqual({ UF: 900 });
    expect(result.current.overdueAtCutoffItems).toBe(1);
    expect(result.items.find(item => item.financialId === "Deal4728")).toMatchObject({
      overdueAtCutoffNative: { UF: 900 },
      overdueAtCutoffCount: 1,
    });
  });

  it("prioriza sobrecostos y brechas de margen con evidencia numérica", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-12-31",
    });
    expect(result.deviations.costOverruns[0]).toMatchObject({ financialId: "Deal1934", budgetDeltaUF: 350 });
    expect(result.deviations.marginGaps[0]).toMatchObject({ financialId: "Deal1934", marginGapPp: -4.27 });
  });

  it("filtra por lifecycle, cliente, línea y búsqueda sin cambiar la política base", () => {
    const result = buildFinancialPortfolioV2({
      snapshots,
      billingItems: billing,
      operationalItems: operational,
      from: "2026-01-01",
      to: "2026-12-31",
      filters: { lifecycle: "open", client: "CCLA", lineOfBusiness: "Delivery", search: "4728" },
    });
    expect(result.items.map(item => item.financialId)).toEqual(["Deal4728"]);
    expect(result.lifecycle).toEqual({ total: 1, open: 1, closed: 0, internal: 0 });
  });
});
