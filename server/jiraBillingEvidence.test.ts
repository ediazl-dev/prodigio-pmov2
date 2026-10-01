import { describe, expect, it } from "vitest";
import type { JiraIssue } from "./jiraClient";
import { buildJiraBillingEvidence, JIRA_BILLING_STATUS_FIELD_ID } from "./jiraBillingEvidence";

function issue(input: {
  key: string;
  summary: string;
  status?: string;
  category?: string;
  labels?: string[];
  dueDate?: string | null;
  updated?: string;
  description?: string;
  billing?: string[];
  project?: string;
}): JiraIssue {
  return {
    id: input.key,
    key: input.key,
    self: `https://jira.example/rest/api/3/issue/${input.key}`,
    fields: {
      summary: input.summary,
      status: {
        name: input.status ?? "Pendiente",
        statusCategory: { name: input.category === "done" ? "Done" : "To Do", key: input.category ?? "new" },
      },
      issuetype: { name: input.project ? "Hito PMO" : "Get IT help", subtask: false },
      project: input.project ? { id: input.project, key: input.project, name: input.project } : undefined,
      created: "2026-06-01T10:00:00.000-0300",
      updated: input.updated ?? "2026-09-28T10:00:00.000-0300",
      labels: input.labels ?? [],
      duedate: input.dueDate ?? null,
      description: input.description ?? null,
      [JIRA_BILLING_STATUS_FIELD_ID]: input.billing?.map(value => ({ value })) ?? null,
    },
  };
}

const localProjectItems = [
  {
    code: "M01",
    title: "Kickoff",
    monthNumber: null,
    amount: 3280,
    currency: "UF",
    amountSource: "sale_weight" as const,
    dueDate: "2026-02-02",
    jiraIssueKey: "PBTISD1-8",
  },
  {
    code: "M02",
    title: "Arquitectura",
    monthNumber: null,
    amount: 820,
    currency: "UF",
    amountSource: "sale_weight" as const,
    dueDate: "2026-10-02",
    jiraIssueKey: "PBTISD1-11",
  },
];

describe("jiraBillingEvidence", () => {
  it("usa Estado de Facturación como verdad operacional aunque el workflow general discrepe", () => {
    const result = buildJiraBillingEvidence({
      entityType: "project",
      entityId: 180002,
      dealId: "1934",
      localItems: localProjectItems,
      jiraIssues: [
        issue({ key: "PBTISD1-8", summary: "H1-F1-40%: Kickoff", status: "Pendiente", billing: ["✅ Facturado"], project: "PBTISD1" }),
        issue({ key: "PBTISD1-11", summary: "H3B-F1-10%", status: "Cumplido (Entregable)", category: "done", billing: ["❌ No facturado"], project: "PBTISD1" }),
      ],
      sourceProjectKeys: ["PBTISD1"],
      allowBillingIssueStatusFallback: false,
      jiraAvailable: true,
    });

    expect(result.items.map(item => item.billingStatus)).toEqual(["billed", "not_billed"]);
    expect(result.items[0].billingStatusSource).toBe("jira_custom_field");
    expect(result.summary.billedByCurrency).toEqual([{ currency: "UF", amount: 3280, items: 1 }]);
    expect(result.summary.notBilledByCurrency).toEqual([{ currency: "UF", amount: 820, items: 1 }]);
  });

  it("no infiere facturación de un Hito PMO cerrado cuando el campo está vacío", () => {
    const result = buildJiraBillingEvidence({
      entityType: "project",
      entityId: 300001,
      dealId: "4532",
      localItems: [localProjectItems[0]],
      jiraIssues: [issue({ key: "PBTISD1-8", summary: "Hito 1", status: "Cumplido", category: "done", project: "PBTISD1" })],
      sourceProjectKeys: ["PBTISD1"],
      allowBillingIssueStatusFallback: false,
      jiraAvailable: true,
    });

    expect(result.items[0].billingStatus).toBe("unknown");
    expect(result.items[0].billingStatusLabel).toBe("Estado de facturación N/D");
  });

  it("Camanchaca no suma duplicados ni usa tickets PMO; Done sin Estado de Facturación es N/D", () => {
    const result = buildJiraBillingEvidence({
      entityType: "recurring_service",
      entityId: 2100001,
      dealId: "2383",
      localItems: [{
        code: "M01",
        title: "Cuota mes 1",
        monthNumber: 1,
        amount: 94,
        currency: "UF",
        amountSource: "billing_schedule",
        dueDate: "2026-07-06",
        jiraIssueKey: null,
      }],
      jiraIssues: [
        issue({ key: "CAMANSOP01-3", summary: "Hito de Facturación - Mes 1", status: "Completed", category: "done", labels: ["facturacion", "mes-1"], dueDate: "2026-07-06" }),
        issue({ key: "CAMANSOP01-20", summary: "Facturación Mes 1 - Soporte y evolutivos", status: "Completed", category: "done", labels: ["facturacion", "mes-1"], dueDate: "2026-07-06", description: "Mensualidad #1: 94.00 UF" }),
        issue({ key: "CAMANSOP01-44", summary: "Hito de Facturación - Mes 1", status: "Done", category: "done", labels: ["pmo-recurring"], description: "Monto: 94.00 USD" }),
      ],
      sourceProjectKeys: ["CAMANSOP01"],
      allowBillingIssueStatusFallback: true,
      jiraAvailable: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].key).toBe("CAMANSOP01-20");
    expect(result.items[0].billingStatus).toBe("unknown");
    expect(result.items[0].amount).toBe(94);
    expect(result.items[0].currency).toBe("UF");
    expect(result.items[0].duplicateCandidates).toEqual(["CAMANSOP01-3"]);
    expect(result.summary.billedByCurrency).toEqual([]);
    expect(result.summary.duplicateGroups).toBe(1);
  });

  it("Deal 4687 excluye los tickets PMO USD terminados: las tres cuotas UF siguen por conciliar", () => {
    const result = buildJiraBillingEvidence({
      entityType: "recurring_service", entityId: 2040001, dealId: "4687",
      localItems: [1, 2, 3].map(month => ({ code: `M0${month}`, title: `Cuota mes ${month}`, monthNumber: month, amount: 160, currency: "UF", amountSource: "billing_schedule" as const, dueDate: `2026-0${5 + month}-01`, jiraIssueKey: null })),
      jiraIssues: [1, 2, 3].flatMap(month => [
        issue({ key: `CONSALOP01-${7 + month}`, summary: `Factura mensual - Mes ${month} (160.00 USD)`, status: "Completed", category: "done", labels: ["pmo-recurring", `pmo-rs-2040001-work-plan-${month}`] }),
        issue({ key: `CONSALOP01-${20 + month}`, summary: `Deal 4687_H${month}_Mes ${month}`, status: "Completed", category: "done", labels: ["Deal4687"], project: "CONSALOP01" }),
      ]),
      sourceProjectKeys: ["CONSALOP01"], allowBillingIssueStatusFallback: true, jiraAvailable: true,
    });
    expect(result.items.map(item => item.key)).toEqual(["CONSALOP01-21", "CONSALOP01-22", "CONSALOP01-23"]);
    expect(result.summary).toMatchObject({ billedItems: 0, notBilledItems: 0, unknownItems: 3 });
    expect(result.items.every(item => item.currency === "UF" && item.billingStatusSource === "missing")).toBe(true);
    expect(result.warnings.join(" ")).toContain("3 ticket(s) generados por PMO excluidos");
  });

  it("bloquea valores oficiales opuestos entre hitos candidatos para la misma cuota", () => {
    const result = buildJiraBillingEvidence({
      entityType: "recurring_service", entityId: 2040001, dealId: "4687",
      localItems: [{ code: "M01", title: "Cuota 1", monthNumber: 1, amount: 160, currency: "UF", amountSource: "billing_schedule", dueDate: "2026-06-01", jiraIssueKey: null }],
      jiraIssues: [
        issue({ key: "CONSALOP01-20", summary: "Deal 4687_H1_Mes 1", billing: ["✅ Facturado"], project: "CONSALOP01" }),
        issue({ key: "CONSALOP01-21", summary: "Deal 4687_H1_Mes 1", billing: ["❌ No facturado"], project: "CONSALOP01" }),
      ], sourceProjectKeys: ["CONSALOP01"], allowBillingIssueStatusFallback: true, jiraAvailable: true,
    });
    expect(result.items[0].billingStatus).toBe("unknown");
    expect(result.summary.billedByCurrency).toEqual([]);
    expect(result.items[0].duplicateCandidates).toHaveLength(1);
  });

  it("deduplica el H1 del Deal 4687 y prefiere el issue cumplido cuando ambos tienen Estado de Facturación", () => {
    const result = buildJiraBillingEvidence({
      entityType: "recurring_service",
      entityId: 2040001,
      dealId: "4687",
      localItems: [{
        code: "M01",
        title: "Cuota mes 1",
        monthNumber: 1,
        amount: 160,
        currency: "UF",
        amountSource: "billing_schedule",
        dueDate: "2026-06-01",
        jiraIssueKey: null,
      }],
      jiraIssues: [
        issue({ key: "PSCSC4S-8", summary: "Deal 4687_H1_Mes 1", status: "Cumplido", category: "done", billing: ["✅ Facturado"], project: "PSCSC4S" }),
        issue({ key: "PSCSC4S-36", summary: "Deal 4687_H1_Mes 1", status: "Pendiente", billing: ["✅ Facturado"], project: "PSCSC4S" }),
      ],
      sourceProjectKeys: ["PSCSC4S"],
      allowBillingIssueStatusFallback: true,
      jiraAvailable: true,
    });

    expect(result.items[0].key).toBe("PSCSC4S-8");
    expect(result.items[0].duplicateCandidates).toEqual(["PSCSC4S-36"]);
    expect(result.summary.billedItems).toBe(1);
  });

  it("mantiene monto y facturación en N/D cuando no existe vínculo Jira", () => {
    const result = buildJiraBillingEvidence({
      entityType: "recurring_service",
      entityId: 2070001,
      dealId: "4727",
      localItems: [{
        code: "M01",
        title: "Cuota mes 1",
        monthNumber: 1,
        amount: 195,
        currency: "UF",
        amountSource: "billing_schedule",
        dueDate: "2026-08-06",
        jiraIssueKey: null,
      }],
      jiraIssues: [],
      sourceProjectKeys: [],
      allowBillingIssueStatusFallback: true,
      jiraAvailable: false,
      error: "Jira no disponible",
    });

    expect(result.items[0].billingStatus).toBe("unknown");
    expect(result.summary.billedItems).toBe(0);
    expect(result.summary.unknownItems).toBe(1);
    expect(result.error).toBe("Jira no disponible");
  });
});
