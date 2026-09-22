import { describe, expect, it } from "vitest";
import { buildExecutiveProjectFinance } from "./executiveProjectFinance";

const contract = {
  id: 19,
  projectId: 180002,
  dealId: "Deal1934",
  clientName: "Banco Tanner",
  contractName: "SFA",
  valorContratadoUF: "8200",
  moneda: "UF",
  esInversionInterna: false,
  estado: "activo",
};

function build(overrides: Partial<Parameters<typeof buildExecutiveProjectFinance>[0]> = {}) {
  return buildExecutiveProjectFinance({
    projectId: 180002,
    dealId: "Deal1934",
    cutoffDate: "2026-09-22",
    financial: {
      valorVentaUF: 8200,
      presupuestoUF: 2050,
      utilizadoUF: 2378.172,
      utilizadoUFPorc: 1.160083902,
      costoProyectadoUF: 5169.9391,
      margenProyectadoUF: 3030.0609,
      margenProyectadoPorc: 0.3695196182,
      margenTargetPorc: 0.5,
      capacityU: 2378.172,
      planificadoUF: 336.24,
      proyectadoUF: 2714.412,
    },
    financialSource: "financial_sync",
    capturedAt: "2026-09-22T03:07:47.000Z",
    milestones: [
      { milestoneCode: "M01", title: "Inicio", billingWeight: "10", acceptanceStatus: "accepted" },
      { milestoneCode: "M02", title: "Diseño", billingWeight: "20", acceptanceStatus: "unverified" },
    ],
    billingMilestones: [],
    contracts: [contract],
    scheduleItems: [
      { id: 1, contractId: 19, milestoneCode: "M01", descripcion: "Inicio", pesoPct: "10", valorUF: "900", fechaPlanificada: "2026-03-20" },
      { id: 2, contractId: 19, milestoneCode: "M02", descripcion: "Diseño", pesoPct: "20", valorUF: "1640", fechaPlanificada: "2026-05-20" },
    ],
    revenueEvents: [
      { id: 1, contractId: 19, milestoneCode: "M01", valorUF: "900", fechaDevengo: "2026-05-25" },
    ],
    invoices: [
      { id: 1, contractId: 19, valorUF: "500", fechaEmision: "2026-06-01", fechaVencimiento: "2026-07-01", estadoSII: "aceptada" },
      { id: 2, contractId: 19, valorUF: "400", fechaEmision: "2026-06-05", fechaVencimiento: "2026-07-05", estadoSII: "borrador" },
    ],
    payments: [
      { id: 1, invoiceId: 1, valorUF: "200", fechaPago: "2026-06-20" },
    ],
    ...overrides,
  });
}

describe("buildExecutiveProjectFinance", () => {
  it("expone venta, costos, margen y embudo financiero sin llamar hito facturado", () => {
    const result = build();

    expect(result.overview).toEqual({
      contractedUf: 8200,
      contractedSource: "financial_sync",
      acceptedUf: 900,
      milestoneAmountCoverage: { withAmount: 2, total: 2 },
    });
    expect(result.costs.consumedUf).toBe(2378.172);
    expect(result.margin.gapPp).toBeCloseTo(-13.04803818);
    expect(result.billing).toMatchObject({
      available: true,
      accruedUf: 900,
      billedUf: 500,
      collectedUf: 200,
      wipUf: 400,
      accountsReceivableUf: 300,
      backlogUf: 7300,
      invoiceCount: 2,
      paymentCount: 1,
    });
  });

  it("prioriza el monto explícito del calendario sobre venta por peso", () => {
    const result = build();
    expect(result.milestones[0]).toMatchObject({ amountUf: 900, amountSource: "payment_schedule", acceptedAmountUf: 900 });
    expect(result.milestones[1]).toMatchObject({ amountUf: 1640, amountSource: "payment_schedule", acceptedAmountUf: 0 });
  });

  it("calcula monto por hito desde venta UF y peso cuando no hay contrato financiero", () => {
    const result = build({
      projectId: 2670001,
      dealId: "Deal4728",
      contracts: [],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
      financial: { valorVentaUF: 6533.3333, presupuestoUF: 2255, utilizadoUF: 708.98 },
      milestones: [
        { milestoneCode: "H01", title: "Hito 1", billingWeight: "16", acceptanceStatus: "accepted" },
        { milestoneCode: "H02", title: "Hito 2", billingWeight: "17", acceptanceStatus: "unverified" },
      ],
    });

    expect(result.milestones[0]).toMatchObject({ amountSource: "sale_weight", accepted: true });
    expect(result.milestones[0].amountUf).toBeCloseTo(1045.333328);
    expect(result.milestones[1].amountUf).toBeCloseTo(1110.666661);
    expect(result.billing).toMatchObject({
      available: false,
      accruedUf: null,
      billedUf: null,
      collectedUf: null,
    });
    expect(result.warnings).toContain("No existe contrato enlazado al proyecto o Deal; devengo, facturación y cobro permanecen N/D.");
  });

  it("recupera el porcentaje explícito del título cuando el campo de peso quedó en cero", () => {
    const result = build({
      projectId: 2670001,
      dealId: "Deal4728",
      contracts: [],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
      financial: { valorVentaUF: 6533.3333 },
      milestones: [
        { milestoneCode: "H01", title: "HITO 1: Kickoff (20%)", billingWeight: "0.00", acceptanceStatus: "unverified" },
        { milestoneCode: "H00", title: "Semana 0: Setup", billingWeight: "0.00", acceptanceStatus: "unverified" },
      ],
    });

    expect(result.milestones[0]).toMatchObject({ weightPct: 20, weightSource: "title", amountSource: "sale_weight" });
    expect(result.milestones[0].amountUf).toBeCloseTo(1306.66666);
    expect(result.milestones[1]).toMatchObject({ weightPct: 0, weightSource: "field", amountUf: 0 });
    expect(result.warnings).toContain("1 hito(s) recuperaron el peso desde su título contractual porque el campo numérico estaba en cero.");
  });

  it("usa el contrato como base cuando no existe venta sincronizada", () => {
    const result = build({
      financial: null,
      financialSource: "POR_CONFIRMAR",
      milestones: [{ milestoneCode: "M01", title: "Inicio", billingWeight: "10", acceptanceStatus: "unverified" }],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
    });

    expect(result.overview).toMatchObject({ contractedUf: 8200, contractedSource: "contract" });
    expect(result.milestones[0]).toMatchObject({ amountUf: 820, amountSource: "contract_weight" });
    expect(result.billing.billedUf).toBe(0);
  });

  it("bloquea un monto directo si su moneda no es UF y no lo suma", () => {
    const result = build({
      contracts: [],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
      financial: { valorVentaUF: 1000 },
      milestones: [{ milestoneCode: "M01", title: "Inicio", billingWeight: "10", acceptanceStatus: "unverified" }],
      billingMilestones: [{ milestoneNumber: 1, amount: 1000000, currency: "CLP" }],
    });

    expect(result.milestones[0]).toMatchObject({ amountUf: null, amountSource: "currency_blocked" });
    expect(result.overview.milestoneAmountCoverage).toEqual({ withAmount: 0, total: 1 });
  });

  it("excluye contratos en moneda distinta de UF de todos los agregados", () => {
    const result = build({
      financial: null,
      financialSource: "POR_CONFIRMAR",
      contracts: [{ ...contract, moneda: "CLP" }],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
      milestones: [{ milestoneCode: "M01", title: "Inicio", billingWeight: "10", acceptanceStatus: "unverified" }],
    });

    expect(result.overview.contractedUf).toBeNull();
    expect(result.billing.available).toBe(false);
    expect(result.warnings).toContain("1 contrato(s) excluido(s) por moneda distinta o no informada; no se suman monedas.");
  });

  it("conserva N/D cuando faltan venta, contrato y pesos", () => {
    const result = build({
      financial: null,
      financialSource: "POR_CONFIRMAR",
      contracts: [],
      scheduleItems: [],
      revenueEvents: [],
      invoices: [],
      payments: [],
      milestones: [{ milestoneCode: "M01", title: "Inicio", billingWeight: null, acceptanceStatus: "accepted" }],
    });

    expect(result.overview.contractedUf).toBeNull();
    expect(result.overview.acceptedUf).toBeNull();
    expect(result.milestones[0]).toMatchObject({ amountUf: null, acceptedAmountUf: null, amountSource: "missing" });
  });
});
