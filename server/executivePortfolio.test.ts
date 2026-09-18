import { describe, expect, it } from "vitest";
import { buildExecutivePortfolio, type ExecutivePortfolioInput } from "./executivePortfolio";

function baseInput(overrides: Partial<ExecutivePortfolioInput> = {}): ExecutivePortfolioInput {
  return {
    cutOffDate: "2026-09-18",
    generatedAt: "2026-09-18T13:00:00Z",
    projects: [
      { id: 1, projectName: "Nexos SFA", clientName: "Prodigio Tech", dealId: "PMO-360001", projectType: "desarrollo", status: "activo", currentStage: "design", pmId: 10, totalAmount: "120000", currency: "USD", startDate: "2026-05-01", endDate: null },
      { id: 2, projectName: "CCLA SRP MVP1", clientName: "CCLA", dealId: "PMO-2670001", projectType: "integracion", status: "activo", currentStage: "planning", pmId: null, totalAmount: "64900", currency: "USD", startDate: "2026-08-01", endDate: null },
      { id: 3, projectName: "MaxAgro Assessment", clientName: "MaxAgro", dealId: "PMO-300001", projectType: "data", status: "completado", currentStage: "closure", pmId: 10, totalAmount: "30000", currency: "USD", startDate: "2026-02-01", endDate: "2026-06-01" },
    ],
    compliance: [
      // Proyecto 1: etapa en curso, pasada de plazo
      { projectId: 1, projectName: "Nexos SFA", stageId: "design", status: "in_progress", daysUsed: 21, totalAllowed: 18 },
      // Proyecto 2: etapa en curso, al día
      { projectId: 2, projectName: "CCLA SRP MVP1", stageId: "planning", status: "in_progress", daysUsed: 4, totalAllowed: 12 },
      // Proyecto 3 (cerrado): dos etapas cerradas, una tarde
      { projectId: 3, projectName: "MaxAgro Assessment", stageId: "sow", status: "on_time", daysUsed: 8, totalAllowed: 10 },
      { projectId: 3, projectName: "MaxAgro Assessment", stageId: "risks", status: "late", daysUsed: 14, totalAllowed: 8 },
    ],
    deadlines: [
      { stageId: "sow", maxBusinessDays: 10, label: "SoW" },
      { stageId: "jira", maxBusinessDays: 5, label: "Jira" },
      { stageId: "risks", maxBusinessDays: 8, label: "Riesgos" },
      { stageId: "planning", maxBusinessDays: 12, label: "Planificación" },
      { stageId: "design", maxBusinessDays: 18, label: "Avance" },
      { stageId: "closure", maxBusinessDays: 6, label: "Cierre" },
    ],
    extensions: [
      { projectId: 3, stageId: "risks", type: "extend", extraDays: 4 },
      { projectId: 3, stageId: "risks", type: "pause", extraDays: 0 },
    ],
    risks: [
      { projectId: 1, status: "abierto", impact: "alto", probability: "alta", mitigation: null },
      { projectId: 1, status: "abierto", impact: "alto", probability: "media", mitigation: "Plan B documentado" },
      { projectId: 1, status: "cerrado", impact: "alto", probability: "alta", mitigation: null },
      { projectId: 2, status: "abierto", impact: "medio", probability: "alta", mitigation: null },
    ],
    milestones: [
      { projectId: 1, amount: "40000", currency: "USD", dueDate: "2026-07-01", status: "pendiente" },
      { projectId: 1, amount: "40000", currency: "USD", dueDate: "2026-10-01", status: "facturado" },
      { projectId: 3, amount: "30000", currency: "USD", dueDate: "2026-05-01", status: "pagado" },
    ],
    lessons: [],
    users: [
      { id: 10, name: "Eugenio Díaz" },
      { id: 11, name: "Otro PM" },
    ],
    ...overrides,
  };
}

describe("buildExecutivePortfolio · titular", () => {
  it("cuenta la cartera por estado y detecta las etapas fuera de plazo", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.headline.totalProjects).toBe(3);
    expect(portfolio.headline.active).toBe(2);
    expect(portfolio.headline.closed).toBe(1);
    expect(portfolio.headline.stagesOverdue).toBe(1);
    expect(portfolio.headline.worstOverDays).toBe(3);
  });

  it("no inventa un plazo cuando la etapa en curso no tiene apertura registrada", () => {
    const portfolio = buildExecutivePortfolio(
      baseInput({ compliance: [] }),
    );
    expect(portfolio.headline.stagesUnmeasured).toBe(2);
    expect(portfolio.headline.stagesOverdue).toBe(0);
    expect(portfolio.headline.worstOverDays).toBeNull();
    expect(portfolio.attention.every(row => row.state === "no_deadline")).toBe(true);
  });
});

describe("buildExecutivePortfolio · atención", () => {
  it("ordena primero lo vencido y por mayor exceso", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.attention[0].projectName).toBe("Nexos SFA");
    expect(portfolio.attention[0].state).toBe("overdue");
    expect(portfolio.attention[0].overDays).toBe(3);
    expect(portfolio.attention[1].state).toBe("on_track");
  });

  it("marca en riesgo la etapa que pasó el 80% de su plazo sin excederlo", () => {
    const input = baseInput();
    input.compliance = [
      { projectId: 2, projectName: "CCLA SRP MVP1", stageId: "planning", status: "in_progress", daysUsed: 10, totalAllowed: 12 },
    ];
    const portfolio = buildExecutivePortfolio(input);
    const row = portfolio.attention.find(item => item.projectId === 2);
    expect(row?.state).toBe("at_risk");
    expect(row?.overDays).toBe(-2);
  });

  it("resuelve el PM y cuenta solo los riesgos altos abiertos", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    const nexos = portfolio.attention.find(row => row.projectId === 1);
    expect(nexos?.pmName).toBe("Eugenio Díaz");
    // 2 altos abiertos: el cerrado y el de impacto medio no cuentan.
    expect(nexos?.highRisksOpen).toBe(2);
    const ccla = portfolio.attention.find(row => row.projectId === 2);
    expect(ccla?.pmName).toBeNull();
    expect(ccla?.highRisksOpen).toBe(0);
  });

  it("solo incluye proyectos activos", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.attention).toHaveLength(2);
    expect(portfolio.attention.some(row => row.projectId === 3)).toBe(false);
  });
});

describe("buildExecutivePortfolio · dinero", () => {
  it("separa contratado activo de contratado cerrado", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    const usd = portfolio.money.find(figure => figure.currency === "USD");
    expect(usd?.contractedActive).toBe(184900);
    expect(usd?.contractedClosed).toBe(30000);
  });

  it("cuenta facturado incluyendo pagado, y cobrado solo pagado", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    const usd = portfolio.money.find(figure => figure.currency === "USD");
    expect(usd?.invoiced).toBe(70000);
    expect(usd?.collected).toBe(30000);
  });

  it("marca vencido el hito pendiente cuya fecha ya pasó el corte", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    const usd = portfolio.money.find(figure => figure.currency === "USD");
    expect(usd?.overdue).toBe(40000);
    expect(usd?.overdueItems).toBe(1);
  });

  it("NUNCA suma monedas distintas: las mantiene en filas separadas", () => {
    const input = baseInput();
    input.projects.push({
      id: 4, projectName: "Proyecto CLP", clientName: "Cliente", dealId: null, projectType: "otro",
      status: "activo", currentStage: "sow", pmId: null, totalAmount: "50000000", currency: "CLP",
      startDate: null, endDate: null,
    });
    const portfolio = buildExecutivePortfolio(input);
    expect(portfolio.money.map(figure => figure.currency)).toEqual(["CLP", "USD"]);
    expect(portfolio.money.find(figure => figure.currency === "CLP")?.contractedActive).toBe(50000000);
    expect(portfolio.money.find(figure => figure.currency === "USD")?.contractedActive).toBe(184900);
  });
});

describe("buildExecutivePortfolio · cumplimiento y cerrados", () => {
  it("calcula la tasa sobre las etapas cerradas de toda la cartera", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.compliance).toMatchObject({ onTime: 1, late: 1, total: 2, ratePercent: 50 });
  });

  it("devuelve null, y no 0%, cuando no hay ninguna etapa cerrada", () => {
    const input = baseInput();
    input.compliance = input.compliance.filter(detail => detail.status === "in_progress");
    const portfolio = buildExecutivePortfolio(input);
    expect(portfolio.compliance.ratePercent).toBeNull();
    expect(portfolio.closed.ratePercent).toBeNull();
    expect(portfolio.closed.avgSlipDays).toBeNull();
  });

  it("promedia el derrape solo sobre las etapas que se pasaron", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.closed.avgSlipDays).toBe(6);
  });

  it("compara duración real contra la planificada en días hábiles de etapa", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.closed.avgRealDurationDays).toBe(22);
    expect(portfolio.closed.avgPlannedDurationDays).toBe(18);
  });

  it("cuenta los cierres sin retrospectiva", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.closed.lessonsRegistered).toBe(0);
    expect(portfolio.closed.lessonsMissing).toBe(1);
    expect(portfolio.closed.avgScore).toBeNull();

    const conLeccion = buildExecutivePortfolio(baseInput({ lessons: [{ projectId: 3, finalScore: 8 }] }));
    expect(conLeccion.closed.lessonsRegistered).toBe(1);
    expect(conLeccion.closed.lessonsMissing).toBe(0);
    expect(conLeccion.closed.avgScore).toBe(8);
  });
});

describe("buildExecutivePortfolio · cuellos de botella", () => {
  it("expone las seis etapas aunque algunas no tengan datos", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.bottlenecks.map(row => row.stageId)).toEqual([
      "sow", "jira", "risks", "planning", "design", "closure",
    ]);
  });

  it("identifica la etapa que se pasa de plazo y acumula extensiones", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    const risks = portfolio.bottlenecks.find(row => row.stageId === "risks");
    expect(risks).toMatchObject({ allowedDays: 8, closedCount: 1, avgUsedDays: 14, overCount: 1, extensionCount: 1, extraDays: 4 });
  });

  it("deja el promedio en null cuando ninguna etapa de esa fase cerró", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.bottlenecks.find(row => row.stageId === "jira")?.avgUsedDays).toBeNull();
  });

  it("no cuenta pausas ni reanudaciones como extensiones de plazo", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    // El input trae un extend y un pause en la etapa de riesgos.
    expect(portfolio.bottlenecks.find(row => row.stageId === "risks")?.extensionCount).toBe(1);
  });
});

describe("buildExecutivePortfolio · distribución por etapa", () => {
  it("separa activos de cerrados en cada etapa", () => {
    const portfolio = buildExecutivePortfolio(baseInput());
    expect(portfolio.stageDistribution.find(row => row.stageId === "design")).toMatchObject({ active: 1, closed: 0 });
    expect(portfolio.stageDistribution.find(row => row.stageId === "closure")).toMatchObject({ active: 0, closed: 1 });
  });
});
