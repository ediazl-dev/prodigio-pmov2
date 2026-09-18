import { describe, expect, it } from "vitest";
import {
  buildBillingPlan,
  buildDocumentRows,
  buildStagePipeline,
  daysBetween,
  type BillingMonth,
  type ServiceDocument,
  type ServiceStage,
} from "./serviceDetailViewModel";

const CUT_OFF = "2026-09-18";

function month(overrides: Partial<Record<string, unknown>> = {}): BillingMonth {
  return {
    id: 1,
    serviceId: 1,
    monthNumber: 1,
    dueDate: "2026-06-06",
    amount: "94.00",
    currency: "USD",
    status: "pendiente",
    jiraIssueKey: null,
    invoiceNumber: null,
    notes: null,
    createdAt: new Date(),
    ...overrides,
  } as unknown as BillingMonth;
}

describe("buildBillingPlan", () => {
  const months = [
    month({ id: 1, monthNumber: 1, dueDate: "2026-06-06" }),
    month({ id: 2, monthNumber: 2, dueDate: "2026-07-06" }),
    month({ id: 3, monthNumber: 3, dueDate: "2026-08-06" }),
    month({ id: 4, monthNumber: 4, dueDate: "2026-10-06" }),
    month({ id: 5, monthNumber: 5, dueDate: "2026-11-06" }),
    month({ id: 6, monthNumber: 6, dueDate: "2026-12-06" }),
  ];

  it("marca como vencida solo la cuota pendiente cuya fecha ya pasó el corte", () => {
    const plan = buildBillingPlan(months, CUT_OFF, { amount: 564, currency: "USD" });
    expect(plan.rows.filter(row => row.state === "vencida")).toHaveLength(3);
    expect(plan.totals[0].overdueItems).toBe(3);
    expect(plan.totals[0].overdueLabel).toBe("USD 282");
  });

  it("calcula los días de atraso desde el vencimiento hasta el corte", () => {
    const plan = buildBillingPlan(months, CUT_OFF, null);
    expect(plan.rows[0].daysOverdue).toBe(104);
    expect(plan.rows[1].daysOverdue).toBe(74);
    expect(plan.rows[2].daysOverdue).toBe(43);
  });

  it("cuenta facturado incluyendo pagado, y cobrado solo pagado", () => {
    const plan = buildBillingPlan(
      [
        month({ id: 1, monthNumber: 1, status: "pagado" }),
        month({ id: 2, monthNumber: 2, status: "facturado" }),
        month({ id: 3, monthNumber: 3, status: "pendiente" }),
      ],
      CUT_OFF,
      null,
    );
    expect(plan.totals[0].invoicedLabel).toBe("USD 188");
    expect(plan.totals[0].collectedLabel).toBe("USD 94");
  });

  it("no cuenta como vencida una cuota sin fecha, y lo reporta aparte", () => {
    const plan = buildBillingPlan([month({ id: 1, dueDate: null })], CUT_OFF, null);
    expect(plan.rows[0].state).toBe("sin_fecha");
    expect(plan.rows[0].daysOverdue).toBeNull();
    expect(plan.missingDueDates).toBe(1);
  });

  it("detecta el descuadre entre el plan y el monto contratado", () => {
    const plan = buildBillingPlan(months, CUT_OFF, { amount: 600, currency: "USD" });
    expect(plan.planMismatch).not.toBeNull();
    expect(plan.planMismatch?.plannedLabel).toBe("USD 564");
    expect(plan.planMismatch?.expectedLabel).toBe("USD 600");
  });

  it("no afirma descuadre cuando el plan tiene más de una moneda", () => {
    const plan = buildBillingPlan(
      [month({ id: 1, currency: "USD" }), month({ id: 2, monthNumber: 2, currency: "CLP", amount: "80000" })],
      CUT_OFF,
      { amount: 564, currency: "USD" },
    );
    expect(plan.planMismatch).toBeNull();
    expect(plan.totals).toHaveLength(2);
  });

  it("nunca agrega entre monedas distintas", () => {
    const plan = buildBillingPlan(
      [month({ id: 1, currency: "USD", amount: "100" }), month({ id: 2, monthNumber: 2, currency: "CLP", amount: "100" })],
      CUT_OFF,
      null,
    );
    expect(plan.totals.map(total => total.currency).sort()).toEqual(["CLP", "USD"]);
    expect(plan.totals.every(total => total.contracted === 100)).toBe(true);
  });
});

describe("buildStagePipeline", () => {
  const stages = [
    { stageId: "inicializacion", status: "completed", completedAt: "2026-09-15T12:00:00Z" },
    { stageId: "plan_trabajo", status: "completed", completedAt: "2026-09-15T12:00:00Z" },
    { stageId: "jira_setup", status: "in_progress", completedAt: null },
  ] as unknown as ServiceStage[];

  it("arma siempre las cinco etapas, incluso si el servicio no las tiene todas", () => {
    const pipeline = buildStagePipeline(stages);
    expect(pipeline.stages).toHaveLength(5);
    expect(pipeline.stages.map(stage => stage.state)).toEqual(["done", "done", "active", "locked", "locked"]);
  });

  it("identifica la etapa en curso y su posición", () => {
    const pipeline = buildStagePipeline(stages);
    expect(pipeline.activeIndex).toBe(2);
    expect(pipeline.activeStage?.label).toBe("JSM Setup");
    expect(pipeline.progressLabel).toBe("Etapa 3 de 5 en curso");
  });

  it("solo hace navegables las etapas cerradas o en curso", () => {
    const pipeline = buildStagePipeline(stages);
    expect(pipeline.stages.filter(stage => stage.navigable)).toHaveLength(3);
  });
});

describe("buildDocumentRows", () => {
  it("pone primero los documentos exigibles", () => {
    const rows = buildDocumentRows([
      { id: 1, docType: "pl", fileName: "pl.xlsx", fileUrl: "#" },
      { id: 2, docType: "contrato", fileName: "contrato.pdf", fileUrl: "#" },
    ] as unknown as ServiceDocument[]);
    expect(rows[0].typeLabel).toBe("Contrato");
    expect(rows[0].required).toBe(true);
    expect(rows[1].required).toBe(false);
  });
});

describe("daysBetween", () => {
  it("devuelve positivo cuando la fecha ya pasó el corte", () => {
    expect(daysBetween("2026-06-06", "2026-09-18")).toBe(104);
  });

  it("devuelve negativo cuando todavía no vence", () => {
    expect(daysBetween("2026-10-06", "2026-09-18")).toBe(-18);
  });
});
