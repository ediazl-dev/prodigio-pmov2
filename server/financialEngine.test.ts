import { describe, it, expect } from "vitest";
import {
  calculateContractFunnel,
  calculatePortfolioFunnel,
  formatUF,
  type ContractData,
  type PaymentScheduleItemData,
  type RevenueEventData,
  type InvoiceData,
  type PaymentData,
} from "./financialEngine";

// ─── Fixtures ────────────────────────────────────────────────────────────────
const CONTRACT_A: ContractData = {
  id: 1, projectId: 100, dealId: "Deal100", clientName: "Cliente A",
  contractName: "Proyecto Alpha", valorContratadoUF: "10000",
  esInversionInterna: false, estado: "activo",
};

const CONTRACT_B: ContractData = {
  id: 2, projectId: 200, dealId: "Deal200", clientName: "Cliente B",
  contractName: "Proyecto Beta", valorContratadoUF: "5000",
  esInversionInterna: false, estado: "activo",
};

const CONTRACT_INTERNO: ContractData = {
  id: 3, projectId: 300, dealId: "Deal300", clientName: "Prodigio",
  contractName: "Inversión Interna", valorContratadoUF: "3000",
  esInversionInterna: true, estado: "activo",
};

const SCHEDULE_A: PaymentScheduleItemData[] = [
  { id: 1, contractId: 1, milestoneCode: "M01", descripcion: "Hito 1", pesoPct: "30", valorUF: "3000", fechaPlanificada: "2026-03-01" },
  { id: 2, contractId: 1, milestoneCode: "M02", descripcion: "Hito 2", pesoPct: "40", valorUF: "4000", fechaPlanificada: "2026-06-01" },
  { id: 3, contractId: 1, milestoneCode: "M03", descripcion: "Hito 3", pesoPct: "30", valorUF: "3000", fechaPlanificada: "2026-09-01" },
];

const REVENUE_A: RevenueEventData[] = [
  { id: 1, contractId: 1, milestoneCode: "M01", valorUF: "3000", fechaDevengo: "2026-03-15" },
  { id: 2, contractId: 1, milestoneCode: "M02", valorUF: "4000", fechaDevengo: "2026-06-10" },
];

const INVOICES_A: InvoiceData[] = [
  { id: 1, contractId: 1, valorUF: "3000", fechaEmision: "2026-04-01", fechaVencimiento: "2026-05-01", estadoSII: "emitida" },
];

const PAYMENTS_A: PaymentData[] = [
  { id: 1, invoiceId: 1, valorUF: "3000", fechaPago: "2026-04-28" },
];

const FECHA_CORTE = "2026-08-20";

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("financialEngine — calculateContractFunnel", () => {
  it("calcula el embudo completo para un contrato con datos parciales", () => {
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE);
    expect(r.contratado).toBe(10000);
    expect(r.devengado).toBe(7000);
    expect(r.facturado).toBe(3000);
    expect(r.cobrado).toBe(3000);
    expect(r.wip).toBe(4000);       // 7000 - 3000
    expect(r.backlog).toBe(3000);   // 10000 - 7000
    expect(r.ar).toBe(0);           // 3000 - 3000
  });

  it("invariante: CONTRATADO = COBRADO + AR + WIP + BACKLOG", () => {
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE);
    expect(r.invarianteOk).toBe(true);
    expect(r.cobrado + r.ar + r.wip + r.backlog).toBeCloseTo(r.contratado, 2);
  });

  it("descalce: real vs plan acumulado", () => {
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE);
    // Plan a 2026-08-20: M01 (3000) + M02 (4000) = 7000 (M03 es 2026-09-01, futuro)
    expect(r.planAcumulado).toBe(7000);
    expect(r.realAcumulado).toBe(7000);
    expect(r.descalce).toBe(0);
  });

  it("porcentajes correctos", () => {
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE);
    expect(r.pctDevengado).toBeCloseTo(70, 1);
    expect(r.pctFacturado).toBeCloseTo(30, 1);
    expect(r.pctCobrado).toBeCloseTo(30, 1);
  });

  it("contrato sin datos: todo en cero, invariante OK", () => {
    const r = calculateContractFunnel(CONTRACT_B, [], [], [], [], FECHA_CORTE);
    expect(r.contratado).toBe(5000);
    expect(r.devengado).toBe(0);
    expect(r.facturado).toBe(0);
    expect(r.cobrado).toBe(0);
    expect(r.wip).toBe(0);
    expect(r.backlog).toBe(5000);
    expect(r.ar).toBe(0);
    expect(r.invarianteOk).toBe(true);
  });

  it("respeta fecha de corte: eventos futuros no cuentan", () => {
    const earlyDate = "2026-03-01";
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, earlyDate);
    expect(r.devengado).toBe(0); // M01 devenga 2026-03-15 > 2026-03-01
    expect(r.facturado).toBe(0);
    expect(r.cobrado).toBe(0);
  });

  it("excluye facturas anuladas", () => {
    const invoicesWithAnulada: InvoiceData[] = [
      ...INVOICES_A,
      { id: 99, contractId: 1, valorUF: "9999", fechaEmision: "2026-05-01", fechaVencimiento: "2026-06-01", estadoSII: "anulada" },
    ];
    const r = calculateContractFunnel(CONTRACT_A, SCHEDULE_A, REVENUE_A, invoicesWithAnulada, PAYMENTS_A, FECHA_CORTE);
    expect(r.facturado).toBe(3000); // No incluye la anulada
  });
});

describe("financialEngine — calculatePortfolioFunnel", () => {
  it("agrega múltiples contratos correctamente", () => {
    const r = calculatePortfolioFunnel(
      [CONTRACT_A, CONTRACT_B],
      SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE
    );
    expect(r.contratado).toBe(15000);
    expect(r.devengado).toBe(7000);
    expect(r.facturado).toBe(3000);
    expect(r.cobrado).toBe(3000);
    expect(r.totalContratos).toBe(2);
    expect(r.contratosActivos).toBe(2);
  });

  it("excluye inversión interna de los ratios de cartera", () => {
    const r = calculatePortfolioFunnel(
      [CONTRACT_A, CONTRACT_B, CONTRACT_INTERNO],
      SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE
    );
    expect(r.contratado).toBe(15000); // No incluye los 3000 de inversión interna
    expect(r.inversionInterna).toBe(3000);
    expect(r.totalContratos).toBe(3);
  });

  it("invariante a nivel cartera", () => {
    const r = calculatePortfolioFunnel(
      [CONTRACT_A, CONTRACT_B],
      SCHEDULE_A, REVENUE_A, INVOICES_A, PAYMENTS_A, FECHA_CORTE
    );
    expect(r.invarianteOk).toBe(true);
    expect(r.cobrado + r.ar + r.wip + r.backlog).toBeCloseTo(r.contratado, 2);
  });

  it("cartera vacía: todo en cero", () => {
    const r = calculatePortfolioFunnel([], [], [], [], [], FECHA_CORTE);
    expect(r.contratado).toBe(0);
    expect(r.devengado).toBe(0);
    expect(r.invarianteOk).toBe(true);
    expect(r.totalContratos).toBe(0);
  });
});

describe("financialEngine — formatUF", () => {
  it("formatea valores grandes con K", () => {
    expect(formatUF(1500)).toBe("1.5K");
    expect(formatUF(10000)).toBe("10.0K");
  });

  it("formatea valores pequeños sin K", () => {
    expect(formatUF(500)).toBe("500.0");
    expect(formatUF(0)).toBe("0");
  });
});
