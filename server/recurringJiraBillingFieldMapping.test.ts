import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminSettingValue: vi.fn(),
}));

vi.mock("./db", () => ({ getAdminSettingValue: mocks.getAdminSettingValue }));

import {
  getRecurringJiraBillingFieldMappingKey,
  loadRecurringJiraBillingFieldMapping,
  parseRecurringJiraBillingFieldMapping,
} from "./recurringJiraBillingFieldMapping";

const scope = { serviceId: 2070001, projectId: "13114", projectKey: "CONSALOP02" };
const valid = {
  version: 1,
  serviceId: 2070001,
  projectId: "13114",
  projectKey: "CONSALOP02",
  fieldId: "customfield_12127",
  fieldName: "Estado de Facturación Staffing",
  verifiedAt: "2026-10-21T19:00:00.000Z",
};

describe("recurringJiraBillingFieldMapping", () => {
  beforeEach(() => vi.clearAllMocks());

  it("construye una clave determinista por servicio", () => {
    expect(getRecurringJiraBillingFieldMappingKey(2070001)).toBe("recurring-jira-billing-field:2070001");
  });

  it("parsea el contrato y conserva el scope exacto del servicio/JSM", () => {
    expect(parseRecurringJiraBillingFieldMapping(JSON.stringify(valid), scope)).toEqual(valid);
  });

  it("rechaza serviceId, projectId y projectKey fuera de scope", () => {
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, serviceId: 2070002 }, scope)).toThrow(/serviceId/);
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, projectId: "99999" }, scope)).toThrow(/projectId/);
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, projectKey: "PSCSC4S" }, scope)).toThrow(/projectKey/);
  });

  it("rechaza fieldId no custom, nombre vacío y fecha inválida", () => {
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, fieldId: "status" }, scope)).toThrow(/fieldId/);
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, fieldName: "  " }, scope)).toThrow(/fieldName/);
    expect(() => parseRecurringJiraBillingFieldMapping({ ...valid, verifiedAt: "no-es-fecha" }, scope)).toThrow(/verifiedAt/);
  });

  it("distingue ausencia compatible de registro inválido y no lo convierte en fallback silencioso", async () => {
    mocks.getAdminSettingValue.mockResolvedValueOnce(null);
    await expect(loadRecurringJiraBillingFieldMapping(scope)).resolves.toEqual({ mapping: null, present: false, error: null });

    mocks.getAdminSettingValue.mockResolvedValueOnce(JSON.stringify({ ...valid, serviceId: 999 }));
    const invalid = await loadRecurringJiraBillingFieldMapping(scope);
    expect(invalid.present).toBe(true);
    expect(invalid.mapping).toBeNull();
    expect(invalid.error).toMatch(/serviceId/);
    expect(mocks.getAdminSettingValue).toHaveBeenLastCalledWith("recurring-jira-billing-field:2070001");
  });
});
