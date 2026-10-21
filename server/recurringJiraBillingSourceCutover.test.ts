import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JiraIssue } from "./jiraClient";

const mocks = vi.hoisted(() => ({
  searchJiraIssues: vi.fn(),
  getAllProjects: vi.fn(),
  getExecutiveProjectSource: vi.fn(),
  getExecutiveContractMilestones: vi.fn(),
  getProjectById: vi.fn(),
  getBillingByProject: vi.fn(),
  getAdminSettingValue: vi.fn(),
  getFinancialDataForDeal: vi.fn(),
  getBillingMonths: vi.fn(),
  getRecurringServiceById: vi.fn(),
  listRecurringServices: vi.fn(),
}));

vi.mock("./jiraClient", () => ({ searchJiraIssues: mocks.searchJiraIssues }));
vi.mock("./db", () => ({
  getAllProjects: mocks.getAllProjects,
  getExecutiveProjectSource: mocks.getExecutiveProjectSource,
  getExecutiveContractMilestones: mocks.getExecutiveContractMilestones,
  getProjectById: mocks.getProjectById,
  getBillingByProject: mocks.getBillingByProject,
  getAdminSettingValue: mocks.getAdminSettingValue,
}));
vi.mock("./financialDataFetcher", () => ({ getFinancialDataForDeal: mocks.getFinancialDataForDeal }));
vi.mock("./recurringServicesDb", () => ({
  getBillingMonths: mocks.getBillingMonths,
  getRecurringServiceById: mocks.getRecurringServiceById,
  listRecurringServices: mocks.listRecurringServices,
}));

import { loadRecurringServiceJiraBillingEvidence } from "./jiraBillingEvidence";

function issue(input: { key: string; month: number; project: string; billing?: string; billingField?: string; globalBilling?: string }): JiraIssue {
  return {
    id: input.key,
    key: input.key,
    self: `https://jira.example/rest/api/3/issue/${input.key}`,
    fields: {
      summary: `Hito de Facturación - Mes ${input.month}`,
      status: { name: "Completed", statusCategory: { name: "Done", key: "done" } },
      issuetype: { name: "Hito PMO", subtask: false },
      project: { id: input.project, key: input.project, name: input.project },
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-10-01T00:00:00.000Z",
      labels: [`mes-${input.month}`],
      duedate: `2026-${String(input.month).padStart(2, "0")}-06`,
      [input.billingField ?? "customfield_11237"]: input.billing ? [{ value: input.billing }] : null,
      ...(input.globalBilling ? { ["customfield_11237"]: [{ value: input.globalBilling }] } : {}),
    },
  };
}

function service(overrides: Record<string, unknown> = {}) {
  return {
    id: 2070001,
    dealId: "4727",
    serviceName: "Deal 4727 Servicio Staffing Arquitectura",
    serviceType: "staffing",
    currency: "UF",
    jsmLinkSource: "linked",
    jsmProjectKey: "CONSALOP02",
    jsmProjectId: "13114",
    jsmBillingSyncMode: "external_reference",
    jsmWorkPlanSyncMode: "external_reference",
    ...overrides,
  };
}

function schedule(months: number[], bound = true) {
  return months.map(month => ({
    id: 2070000 + month,
    serviceId: 2070001,
    monthNumber: month,
    dueDate: `2026-${String(month).padStart(2, "0")}-06`,
    amount: "195.00",
    currency: "UF",
    status: "pendiente",
    jiraIssueKey: bound ? `CONSALOP02-${100 + month}` : null,
    invoiceNumber: null,
    notes: null,
  }));
}

describe("precedencia de fuente Jira para cuotas recurrentes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllProjects.mockResolvedValue([]);
    mocks.getExecutiveProjectSource.mockResolvedValue(null);
    mocks.getExecutiveContractMilestones.mockResolvedValue([]);
    mocks.getProjectById.mockResolvedValue(null);
    mocks.getBillingByProject.mockResolvedValue([]);
    mocks.getFinancialDataForDeal.mockResolvedValue({ projectFinancial: null });
    mocks.listRecurringServices.mockResolvedValue([]);
    mocks.getAdminSettingValue.mockResolvedValue(null);
  });

  it("con seis bindings canónicos confirmados usa sólo CONSALOP02 y cuenta cada cuota una vez", async () => {
    const canonical = Array.from({ length: 6 }, (_, index) => issue({
      key: `CONSALOP02-${101 + index}`,
      month: index + 1,
      project: "CONSALOP02",
      billing: "✅ Facturado",
    }));
    const legacy = Array.from({ length: 6 }, (_, index) => issue({
      key: `PSCSC4S-${201 + index}`,
      month: index + 1,
      project: "PSCSC4S",
      billing: "✅ Facturado",
    }));
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.searchJiraIssues.mockImplementation(async (jql: string) => jql.includes("project=CONSALOP02")
      ? { issues: canonical }
      : { issues: legacy });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.items).toHaveLength(6);
    expect(result.items.map(item => item.key)).toEqual(canonical.map(item => item.key));
    expect(result.items.every(item => item.billingStatus === "billed")).toBe(true);
    expect(result.summary).toMatchObject({ totalItems: 6, billedItems: 6, unknownItems: 0 });
    expect(result.summary.billedByCurrency).toEqual([{ currency: "UF", amount: 1170, items: 6 }]);
    expect(result.sourceProjectKeys).toEqual(["CONSALOP02"]);
    expect(result.warnings.some(warning => warning.includes("PSCSC4S"))).toBe(false);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(1);
    expect(mocks.searchJiraIssues).toHaveBeenCalledWith(
      "project=CONSALOP02 ORDER BY created ASC",
      expect.any(Object),
    );
  });

  it.each(["linked", "created"])("usa el field financiero local verificado con procedencia %s y lo expone en evidence", async (jsmLinkSource) => {
    const canonical = Array.from({ length: 6 }, (_, index) => issue({
      key: `CONSALOP02-${101 + index}`,
      month: index + 1,
      project: "CONSALOP02",
      billing: "✅ Facturado",
      billingField: "customfield_12127",
      globalBilling: "❌ No facturado",
    }));
    mocks.getRecurringServiceById.mockResolvedValue(service({ jsmLinkSource }));
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.getAdminSettingValue.mockResolvedValue(JSON.stringify({
      version: 1,
      serviceId: 2070001,
      projectId: "13114",
      projectKey: "CONSALOP02",
      fieldId: "customfield_12127",
      fieldName: "Estado de Facturación Staffing",
      verifiedAt: "2026-10-21T19:00:00.000Z",
    }));
    mocks.searchJiraIssues.mockResolvedValue({ issues: canonical });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.field).toEqual({ id: "customfield_12127", name: "Estado de Facturación Staffing" });
    expect(result.items.every(item => item.billingStatus === "billed")).toBe(true);
    expect(mocks.searchJiraIssues).toHaveBeenCalledWith(
      "project=CONSALOP02 ORDER BY created ASC",
      expect.objectContaining({ fields: expect.arrayContaining(["customfield_12127", "customfield_11237"]) }),
    );
  });

  it("reconoce seis hitos CloudOps trasladados sin etiquetas y no factura En Proceso ni vacíos", async () => {
    const canonical = Array.from({ length: 6 }, (_, index) => {
      const i = issue({ key: `CONSALOP03-${index + 1}`, month: index + 1, project: "CONSALOP03", billingField: "customfield_12128", billing: index < 2 ? "Facturado" : index === 2 ? "En Proceso" : undefined });
      i.fields.summary = `Deal 4775_${index + 1}_Mes ${index + 1}`;
      i.fields.labels = [];
      i.fields.issuetype = { name: "Hito de Facturación CloudOps", subtask: false };
      return i;
    });
    mocks.getRecurringServiceById.mockResolvedValue(service({ id: 3300001, dealId: "4775", jsmProjectKey: "CONSALOP03", jsmProjectId: "13149", jsmLinkSource: "created" }));
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]).map((s, index) => ({ ...s, serviceId: 3300001, amount: "160.00", jiraIssueKey: canonical[index].key })));
    mocks.getAdminSettingValue.mockResolvedValue(JSON.stringify({ version: 1, serviceId: 3300001, projectId: "13149", projectKey: "CONSALOP03", fieldId: "customfield_12128", fieldName: "Estado de Facturación CloudOps", verifiedAt: "2026-10-21T21:00:00.000Z" }));
    mocks.searchJiraIssues.mockResolvedValue({ issues: canonical });
    const result = await loadRecurringServiceJiraBillingEvidence(3300001);
    expect(result.items).toHaveLength(6);
    expect(result.items.every(i => i.jiraStatusName === "Completed")).toBe(true);
    expect(result.items[2].billingFieldValues).toEqual(["En Proceso"]);
    expect(result.summary).toMatchObject({ billedItems: 2, unknownItems: 4, duplicateGroups: 0 });
    expect(result.summary.billedByCurrency).toEqual([{ currency: "UF", amount: 320, items: 2 }]);
    expect(result.warnings).toEqual([]);
    expect(result.sourceProjectKeys).toEqual(["CONSALOP03"]);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(1);
  });

  it("mantiene el fallback legado mientras falte al menos un binding de cuota", async () => {
    const canonical = issue({ key: "CONSALOP02-101", month: 1, project: "CONSALOP02", billing: "✅ Facturado" });
    const legacy = issue({ key: "PSCSC4S-202", month: 2, project: "PSCSC4S", billing: "❌ No facturado" });
    legacy.fields.summary = "Deal 4727_H2_Mes 2 · Hito de Facturación";
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue([
      ...schedule([1]),
      { ...schedule([2])[0], jiraIssueKey: null },
    ]);
    mocks.searchJiraIssues.mockImplementation(async (jql: string) => jql.includes("project=CONSALOP02")
      ? { issues: [canonical] }
      : { issues: [legacy] });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.items.map(item => item.key)).toEqual(["CONSALOP02-101", "PSCSC4S-202"]);
    expect(result.items.map(item => item.billingStatus)).toEqual(["billed", "not_billed"]);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(2);
    expect(mocks.searchJiraIssues).toHaveBeenCalledWith(
      'issuetype="Hito PMO" ORDER BY project,key',
      expect.any(Object),
    );
    expect(mocks.getAdminSettingValue).not.toHaveBeenCalled();
  });

  it("mapping canónico inválido deja Jira no disponible y no usa el campo global", async () => {
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.getAdminSettingValue.mockResolvedValue(JSON.stringify({
      version: 1,
      serviceId: 2070001,
      projectId: "99999",
      projectKey: "CONSALOP02",
      fieldId: "customfield_12127",
      fieldName: "Estado de Facturación Staffing",
      verifiedAt: "2026-10-21T19:00:00.000Z",
    }));
    mocks.searchJiraIssues.mockResolvedValue({ issues: Array.from({ length: 6 }, (_, index) => issue({
      key: `CONSALOP02-${101 + index}`,
      month: index + 1,
      project: "CONSALOP02",
      globalBilling: "✅ Facturado",
    })) });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.jiraAvailable).toBe(false);
    expect(result.summary.unknownItems).toBe(6);
    expect(result.summary.billedItems).toBe(0);
    expect(result.warnings.join(" ")).toMatch(/projectId/);
  });

  it("no vuelve al origen si Jira falla después de persistir todos los bindings canónicos", async () => {
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.searchJiraIssues.mockRejectedValue(new Error("HTTP 403"));

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.sourceProjectKeys).toEqual(["CONSALOP02"]);
    expect(result.jiraAvailable).toBe(false);
    expect(result.summary.unknownItems).toBe(6);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(1);
  });

  it("mantiene N/D en hitos canónicos Completed sin campo explícito de facturación", async () => {
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.searchJiraIssues.mockResolvedValue({ issues: Array.from({ length: 6 }, (_, index) => issue({
      key: `CONSALOP02-${101 + index}`, month: index + 1, project: "CONSALOP02",
    })) });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.summary.unknownItems).toBe(6);
    expect(result.items.every(item => item.billingStatus === "unknown")).toBe(true);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(1);
  });

  it("un hito canónico ausente no reactiva PSCSC4S", async () => {
    mocks.getRecurringServiceById.mockResolvedValue(service());
    mocks.getBillingMonths.mockResolvedValue(schedule([1, 2, 3, 4, 5, 6]));
    mocks.searchJiraIssues.mockResolvedValue({ issues: [] });

    const result = await loadRecurringServiceJiraBillingEvidence(2070001);

    expect(result.sourceProjectKeys).toEqual(["CONSALOP02"]);
    expect(result.summary.unknownItems).toBe(6);
    expect(mocks.searchJiraIssues).toHaveBeenCalledTimes(1);
  });
});
