import { describe, expect, it } from "vitest";
import {
  RECURRING_SERVICE_TYPE_LABELS,
  RECURRING_SERVICE_TYPE_OPTIONS,
  RECURRING_SERVICE_TYPE_VALUES,
  recurringServiceTypeSchema,
} from "../shared/recurringServiceTypes";

describe("catálogo de tipos de servicio recurrente", () => {
  it("acepta Staffing como valor canónico", () => {
    expect(recurringServiceTypeSchema.parse("staffing")).toBe("staffing");
    expect(RECURRING_SERVICE_TYPE_VALUES).toContain("staffing");
    expect(RECURRING_SERVICE_TYPE_LABELS.staffing).toBe("Staffing");
  });

  it("mantiene valores únicos y una opción visible para cada tipo", () => {
    const values = RECURRING_SERVICE_TYPE_OPTIONS.map(option => option.value);

    expect(new Set(RECURRING_SERVICE_TYPE_VALUES).size).toBe(RECURRING_SERVICE_TYPE_VALUES.length);
    expect(values).toEqual(RECURRING_SERVICE_TYPE_VALUES);
    expect(RECURRING_SERVICE_TYPE_OPTIONS.every(option => option.label.length > 0)).toBe(true);
  });

  it("rechaza valores fuera del catálogo", () => {
    expect(() => recurringServiceTypeSchema.parse("staff")).toThrow();
  });
});
