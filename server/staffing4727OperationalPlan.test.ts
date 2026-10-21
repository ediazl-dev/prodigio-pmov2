import { describe, expect, it } from "vitest";
import {
  buildStaffing4727OperationalPlan,
  isApprovalControl,
  isSupplementalDefinition,
  STAFFING4727_EXISTING_CONTROL_IDS,
  STAFFING4727_OPERATIONAL_PLAN_SIZE,
  STAFFING4727_SUPPLEMENTAL_KEYS,
} from "./staffing4727OperationalPlan";

describe("Staffing4727 operational plan", () => {
  const plan = buildStaffing4727OperationalPlan();
  const controls = plan.filter(item => !isSupplementalDefinition(item));
  const supplemental = plan.filter(isSupplementalDefinition);

  it("conserva los 24 controles existentes y agrega sólo definiciones condicionales", () => {
    expect(controls).toHaveLength(24);
    expect(controls.map(item => item.workPlanId)).toEqual([
      ...STAFFING4727_EXISTING_CONTROL_IDS,
    ]);
    expect(supplemental).toHaveLength(7);
    expect(plan).toHaveLength(STAFFING4727_OPERATIONAL_PLAN_SIZE);
    expect(STAFFING4727_SUPPLEMENTAL_KEYS).toEqual([
      "definition-1on1-quincenal",
      "definition-burn-rate-quincenal",
      "READINESS-OC",
      "READINESS-FIRMA",
      "READINESS-INICIO",
      "READINESS-ACCESOS",
      "READINESS-CONTRAPARTES",
    ]);
  });

  it("anula sólo las seis fechas de aprobación y no inventa fechas en readiness/quincenales", () => {
    const approvals = plan.filter(isApprovalControl);
    expect(approvals).toHaveLength(6);
    expect(approvals.every(item => item.dueDate === null)).toBe(true);
    expect(approvals.every(item => item.observedDueDate)).toBe(true);
    expect(
      plan
        .filter(item => item.stableKey.startsWith("definition-"))
        .every(item => item.dueDate === null)
    ).toBe(true);
    expect(
      plan
        .filter(item => item.stableKey.startsWith("READINESS-"))
        .every(item => item.dueDate === null)
    ).toBe(true);
    expect(
      plan
        .filter(item => item.stableKey.startsWith("READINESS-"))
        .every(item => item.status === "pendiente")
    ).toBe(true);
  });

  it("representa 1-on-1 y burn-rate como cadencias internas sin portal cliente", () => {
    const oneOnOne = plan.find(
      item => item.stableKey === "definition-1on1-quincenal"
    );
    const burnRate = plan.find(
      item => item.stableKey === "definition-burn-rate-quincenal"
    );
    expect(oneOnOne).toMatchObject({
      frequency: "quincenal",
      period: "M01–M06",
      monthNumber: 1,
      dueDate: null,
      itemType: "tarea_programada",
    });
    expect(burnRate).toMatchObject({
      frequency: "quincenal",
      period: "M01–M06",
      monthNumber: 1,
      dueDate: null,
      itemType: "tarea_programada",
    });
    expect(`${oneOnOne?.description} ${burnRate?.description}`).toMatch(
      /nunca un portal|No se inventa agenda/
    );
  });

  it("mantiene lenguaje de roles no asignados y excluye SLA/DR/24x7", () => {
    expect(plan.every(item => item.status === "pendiente")).toBe(true);
    expect(
      plan.every(
        item =>
          !/SLA|DR|24x7|incidente/i.test(`${item.title} ${item.description}`)
      )
    ).toBe(true);
    expect(
      plan.some(item =>
        /persona no individualizada|por designar|nombres no confirmados/i.test(
          `${item.role} ${item.description}`
        )
      )
    ).toBe(true);
    expect(
      plan.every(
        item =>
          !item.description.includes("asignado a:") &&
          !item.description.includes("assignee")
      )
    ).toBe(true);
  });
});
