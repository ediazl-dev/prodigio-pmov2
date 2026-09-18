import { describe, expect, it } from "vitest";
import {
  buildActionQueue,
  defaultEvidenceTab,
  overdueBreakdown,
  specForSignal,
  type EvidenceTab,
  type MatrixRow,
} from "./recurringDashboardV3ViewModel";

/** Fixture mínimo: solo los campos que el view model lee. */
function row(overrides: Partial<Record<string, unknown>> = {}): MatrixRow {
  return {
    serviceId: 1,
    clientName: "Cliente",
    serviceName: "Servicio",
    dealId: "1000",
    serviceType: "staffing",
    status: "activo",
    currentStage: "jira_setup",
    health: "critical",
    healthSignals: [],
    evidenceCoveragePercent: 60,
    financeByCurrency: {},
    reports: { planned: 0, due: 0, completedDue: 0, overdue: 0, deliveryRate: null, onTimeRate: null },
    formalization: { required: ["contrato", "sow"], present: [], missing: [], coveragePercent: 100, status: "complete" },
    incidents: { availability: "not_configured", observedAt: null, total: null, open: null, criticalOpen: null, highOpen: null, overdueOpen: null, unresolvedOver30Days: null },
    sla: { configuredRules: 0, availability: "not_configured", observedAt: null, firstResponseCompliance: null, resolutionCompliance: null },
    quality: { serviceId: 1, score: 50, status: "warning", issues: [] },
    ...overrides,
  } as unknown as MatrixRow;
}

function currency(code: string, overdue: number, contracted: number, items: number) {
  return {
    currency: code,
    contracted,
    scheduled: contracted,
    invoiced: 0,
    collected: 0,
    accountsReceivable: 0,
    pending: overdue,
    overdue,
    overdueItems: items,
  };
}

describe("overdueBreakdown", () => {
  it("no suma monedas distintas: las lista por separado", () => {
    const result = overdueBreakdown({
      USD: currency("USD", 480, 480, 3),
      CLP: currency("CLP", 1_200_000, 2_000_000, 2),
    });

    expect(result.byCurrency).toHaveLength(2);
    expect(result.label).toContain("USD");
    expect(result.label).toContain("CLP");
    expect(result.label).toContain("+");
    // La clave de orden es el mayor monto de UNA moneda, nunca la suma.
    expect(result.sortKey).toBe(1_200_000);
    // El porcentaje solo existe cuando hay una única moneda.
    expect(result.percentOfContracted).toBeNull();
  });

  it("calcula el porcentaje cuando hay una sola moneda", () => {
    const result = overdueBreakdown({ USD: currency("USD", 390, 1170, 2) });
    expect(result.percentOfContracted).toBe(33);
    expect(result.items).toBe(2);
  });

  it("devuelve 'Sin vencidos' cuando no hay saldo vencido", () => {
    const result = overdueBreakdown({ USD: currency("USD", 0, 500, 0) });
    expect(result.label).toBe("Sin vencidos");
    expect(result.sortKey).toBe(0);
  });
});

describe("buildActionQueue", () => {
  const matrix = [
    row({
      serviceId: 1,
      serviceName: "Camanchaca",
      financeByCurrency: { USD: currency("USD", 282, 564, 3) },
      healthSignals: [
        { code: "OVERDUE_BILLING", level: "critical", message: "3 cuotas vencidas." },
        { code: "JSM_EVIDENCE_UNAVAILABLE", level: "attention", message: "Evidencia JSM no vigente." },
      ],
    }),
    row({
      serviceId: 2,
      serviceName: "Consalud Staffing",
      financeByCurrency: { USD: currency("USD", 480, 480, 3) },
      healthSignals: [{ code: "OVERDUE_BILLING", level: "critical", message: "3 cuotas vencidas." }],
    }),
  ];

  it("aplana las señales: una fila por hallazgo, no por servicio", () => {
    const queue = buildActionQueue(matrix);
    expect(queue).toHaveLength(3);
  });

  it("ordena por severidad y luego por monto vencido", () => {
    const queue = buildActionQueue(matrix);
    expect(queue.map(item => item.code)).toEqual([
      "OVERDUE_BILLING",
      "OVERDUE_BILLING",
      "JSM_EVIDENCE_UNAVAILABLE",
    ]);
    // Entre los dos críticos, primero el de mayor monto expuesto.
    expect(queue[0].serviceName).toBe("Consalud Staffing");
    expect(queue[0].impactValue).toContain("480");
    expect(queue[1].impactNote).toBe("50% de lo contratado");
  });

  it("asigna una acción a cada código conocido y un fallback al resto", () => {
    expect(specForSignal("OVERDUE_BILLING").action).toBe("Gestionar cobro");
    expect(specForSignal("CODIGO_NUEVO_QUE_NO_EXISTE").action).toBe("Abrir servicio");
    expect(specForSignal("CODIGO_NUEVO_QUE_NO_EXISTE").domain).toBe("operacion");
  });

  it("no inventa cifras cuando la señal no es financiera", () => {
    const queue = buildActionQueue(matrix);
    const jsm = queue.find(item => item.code === "JSM_EVIDENCE_UNAVAILABLE");
    expect(jsm?.impactValue).toBe("Sin medición");
    expect(jsm?.impactIsMoney).toBe(false);
  });

  it("usa las etiquetas de etapa cuando se le pasan", () => {
    const queue = buildActionQueue(matrix, { stageLabels: { jira_setup: "JSM Setup" } });
    expect(queue[0].stageLabel).toBe("JSM Setup");
  });
});

describe("defaultEvidenceTab", () => {
  const tab = (over: Partial<EvidenceTab>): EvidenceTab => ({
    key: "finanzas",
    label: "Financiero",
    findings: 0,
    hasEvidence: true,
    emptyTitle: "",
    emptyReason: "",
    emptyAction: "",
    tone: "calm",
    badge: "0",
    ...over,
  });

  it("abre la primera pestaña con hallazgos", () => {
    const tabs = [
      tab({ key: "finanzas", findings: 0 }),
      tab({ key: "formalidad", findings: 6 }),
      tab({ key: "operacion", findings: 3 }),
    ];
    expect(defaultEvidenceTab(tabs)).toBe("formalidad");
  });

  it("ignora una pestaña con hallazgos pero sin evidencia que mostrar", () => {
    const tabs = [
      tab({ key: "finanzas", findings: 0, hasEvidence: true }),
      tab({ key: "operacion", findings: 9, hasEvidence: false }),
    ];
    expect(defaultEvidenceTab(tabs)).toBe("finanzas");
  });

  it("cae en la primera con evidencia cuando no hay hallazgos", () => {
    const tabs = [tab({ key: "operacion", hasEvidence: false }), tab({ key: "entregables", hasEvidence: true })];
    expect(defaultEvidenceTab(tabs)).toBe("entregables");
  });
});
