import { describe, expect, it } from "vitest";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  buildFilterOptions,
  countActiveFilters,
  filterPortfolio,
  moneyList,
  sortPortfolio,
  summarizePortfolio,
  type PortfolioRow,
} from "./portfolioViewModel";

function row(overrides: Partial<Record<string, unknown>> = {}): PortfolioRow {
  return {
    projectId: 1,
    projectName: "Proyecto",
    clientName: "Cliente",
    dealId: "PMO-1",
    projectType: "desarrollo",
    origin: "platform",
    status: "activo",
    stageId: "design",
    stageLabel: "Avance",
    stageIndex: 4,
    totalStages: 6,
    stagesClosed: 3,
    closedStageIds: ["sow", "jira", "risks"],
    daysUsed: 10,
    daysAllowed: 18,
    overDays: -8,
    deadlineState: "on_track",
    pmId: 10,
    pmKey: "10",
    pmName: "Eugenio Díaz",
    amount: 1000,
    currency: "USD",
    amountMissing: false,
    highRisksOpen: 0,
    startDate: null,
    endDate: null,
    ...overrides,
  } as unknown as PortfolioRow;
}

const CARTERA = [
  row({ projectId: 1, projectName: "Nexos SFA", clientName: "Prodigio Tech", stageId: "design", stageIndex: 4, deadlineState: "overdue", overDays: 3, daysUsed: 21, daysAllowed: 18, highRisksOpen: 4, amount: 120000, currency: "USD" }),
  row({ projectId: 2, projectName: "CCLA SRP MVP1", clientName: "CCLA", stageId: "planning", stageIndex: 3, deadlineState: "on_track", overDays: -8, daysUsed: 4, daysAllowed: 12, pmId: null, pmKey: null, pmName: null, amount: null, currency: null, amountMissing: true }),
  row({ projectId: 3, projectName: "MaxAgro Assessment", clientName: "MaxAgro", status: "completado", stageId: "closure", stageIndex: 5, deadlineState: "not_applicable", daysUsed: null, daysAllowed: null, overDays: null, amount: 552, currency: "UF", highRisksOpen: 0 }),
  row({ projectId: 4, projectName: "Producto Apigee", clientName: "Prodigio Tech", stageId: "design", stageIndex: 4, deadlineState: "at_risk", overDays: -2, daysUsed: 16, daysAllowed: 18, highRisksOpen: 2, amount: 88000, currency: "USD" }),
];

describe("filterPortfolio", () => {
  it("sin filtros devuelve todo", () => {
    expect(filterPortfolio(CARTERA, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("busca por nombre, cliente, Deal y PM", () => {
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, search: "nexos" })).toHaveLength(1);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, search: "prodigio" })).toHaveLength(2);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, search: "eugenio" })).toHaveLength(3);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, search: "PMO-1" })).toHaveLength(4);
  });

  it("filtra por estado, cliente, etapa y salud de plazo", () => {
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, status: "completado" })).toHaveLength(1);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, client: "Prodigio Tech" })).toHaveLength(2);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, stage: "design" })).toHaveLength(2);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, health: "overdue" })).toHaveLength(1);
  });

  it("distingue «sin asignar» de un PM concreto", () => {
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, pm: "unassigned" })).toHaveLength(1);
    expect(filterPortfolio(CARTERA, { ...EMPTY_FILTERS, pm: "10" })).toHaveLength(3);
  });

  it("filtra un PM resuelto por nombre desde Jira o datos financieros", () => {
    const rows = [
      ...CARTERA,
      row({ projectId: 180002, pmId: null, pmKey: "name:eduardo mercado", pmName: "Eduardo Mercado" }),
    ];
    expect(filterPortfolio(rows, { ...EMPTY_FILTERS, pm: "name:eduardo mercado" }).map(item => item.projectId))
      .toEqual([180002]);
    expect(buildFilterOptions(rows).pms).toContainEqual({ id: "name:eduardo mercado", name: "Eduardo Mercado" });
  });

  it("combina filtros con AND", () => {
    const result = filterPortfolio(CARTERA, {
      search: "nexos",
      status: "activo",
      client: "Prodigio Tech",
      projectType: "desarrollo",
      stage: "design",
      pm: "10",
      health: "overdue",
    });
    expect(result.map(item => item.projectId)).toEqual([1]);
  });

  it("cuenta los filtros activos sin contar los que están en «todos»", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "  " })).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, search: "x", client: "CCLA" })).toBe(2);
  });
});

describe("sortPortfolio", () => {
  it("por urgencia pone lo vencido primero y lo cerrado al final", () => {
    const sorted = sortPortfolio(CARTERA, DEFAULT_SORT);
    expect(sorted.map(item => item.deadlineState)).toEqual(["overdue", "at_risk", "on_track", "not_applicable"]);
  });

  it("ordena montos en el sentido anunciado y deja ausentes al final", () => {
    const asc = sortPortfolio(CARTERA, { key: "amount", direction: "asc" });
    expect(asc.map(item => item.amount)).toEqual([552, 88000, 120000, null]);

    const desc = sortPortfolio(CARTERA, { key: "amount", direction: "desc" });
    expect(desc.map(item => item.amount)).toEqual([120000, 88000, 552, null]);
  });

  it("ordena plazos en el sentido anunciado y deja no medibles al final", () => {
    const asc = sortPortfolio(CARTERA, { key: "plazo", direction: "asc" });
    const desc = sortPortfolio(CARTERA, { key: "plazo", direction: "desc" });
    expect(asc.map(item => item.overDays)).toEqual([-8, -2, 3, null]);
    expect(desc.map(item => item.overDays)).toEqual([3, -2, -8, null]);
  });

  it("ordena riesgos en el sentido anunciado", () => {
    expect(sortPortfolio(CARTERA, { key: "risks", direction: "asc" }).map(item => item.highRisksOpen)).toEqual([
      0,
      0,
      2,
      4,
    ]);
    expect(sortPortfolio(CARTERA, { key: "risks", direction: "desc" }).map(item => item.highRisksOpen)).toEqual([
      4,
      2,
      0,
      0,
    ]);
  });

  it("ordena por nombre y por cliente en ambas direcciones", () => {
    const asc = sortPortfolio(CARTERA, { key: "name", direction: "asc" });
    expect(asc[0].projectName).toBe("CCLA SRP MVP1");
    const desc = sortPortfolio(CARTERA, { key: "name", direction: "desc" });
    expect(desc[0].projectName).toBe("Producto Apigee");
  });

  it("no muta el arreglo original", () => {
    const original = CARTERA.map(item => item.projectId);
    sortPortfolio(CARTERA, { key: "name", direction: "desc" });
    expect(CARTERA.map(item => item.projectId)).toEqual(original);
  });
});

describe("buildFilterOptions", () => {
  it("arma las listas sin duplicados y ordenadas", () => {
    const options = buildFilterOptions(CARTERA);
    expect(options.clients).toEqual(["CCLA", "MaxAgro", "Prodigio Tech"]);
    expect(options.stages.map(stage => stage.id).sort()).toEqual(["closure", "design", "planning"]);
  });

  it("cuenta los proyectos sin PM para ofrecer la opción", () => {
    expect(buildFilterOptions(CARTERA).unassignedCount).toBe(1);
    expect(buildFilterOptions([row({ pmId: 10 })]).unassignedCount).toBe(0);
  });
});

describe("summarizePortfolio", () => {
  it("resume el universo filtrado contra el total", () => {
    const summary = summarizePortfolio(CARTERA.slice(0, 2), CARTERA);
    expect(summary.count).toBe(2);
    expect(summary.total).toBe(4);
    expect(summary.active).toBe(2);
    expect(summary.overdue).toBe(1);
    expect(summary.highRisks).toBe(4);
  });

  it("NUNCA suma monedas distintas", () => {
    const summary = summarizePortfolio(CARTERA, CARTERA);
    expect(summary.amountByCurrency).toEqual([
      { currency: "UF", value: 552 },
      { currency: "USD", value: 208000 },
    ]);
    expect(moneyList(summary.amountByCurrency)).toBe("UF 552 + USD 208.000");
  });

  it("cuenta aparte los proyectos sin monto cargado", () => {
    expect(summarizePortfolio(CARTERA, CARTERA).withoutAmount).toBe(1);
  });

  it("dice «sin monto cargado» en vez de un cero cuando no hay nada", () => {
    const summary = summarizePortfolio([row({ amount: null, currency: null, amountMissing: true })], CARTERA);
    expect(summary.amountByCurrency).toEqual([]);
    expect(moneyList(summary.amountByCurrency)).toBe("Sin monto cargado");
  });
});
