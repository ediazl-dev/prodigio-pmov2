import { describe, expect, it } from "vitest";
import { projectDocumentPolicy, recurringServiceDocumentPolicy, resolveDocumentLifecycle } from "./documentCoveragePolicy";

describe("documentCoveragePolicy", () => {
  it("clasifica activos y pausados como abiertos con detalle explícito", () => {
    expect(resolveDocumentLifecycle("activo")).toMatchObject({ lifecycle: "open", detail: "active", label: "Abierto" });
    expect(resolveDocumentLifecycle("pausado")).toMatchObject({ lifecycle: "open", detail: "paused", label: "Abierto pausado" });
  });

  it("clasifica completados y cancelados como históricos", () => {
    expect(resolveDocumentLifecycle("completado")).toMatchObject({ lifecycle: "historical", detail: "completed" });
    expect(resolveDocumentLifecycle("cancelado")).toMatchObject({ lifecycle: "historical", detail: "cancelled" });
  });

  it("no inventa lifecycle cuando falta el estado operativo", () => {
    expect(resolveDocumentLifecycle(null)).toMatchObject({ lifecycle: "unconfirmed", detail: "missing_open_record" });
  });

  it("exige SoW y cierre a proyectos históricos", () => {
    const rules = projectDocumentPolicy({ lifecycle: "historical", currentStage: "closure", hasApprovedBaseline: true, recoveryPlanRequired: false });
    expect(rules.find(rule => rule.kind === "contract_sow")?.applicability).toBe("required");
    expect(rules.find(rule => rule.kind === "gantt_baseline")?.applicability).toBe("required");
    expect(rules.find(rule => rule.kind === "closure_document")?.applicability).toBe("required");
    expect(rules.find(rule => rule.kind === "recovery_plan")?.applicability).toBe("not_applicable");
  });

  it("sólo mide minutas semanales cuando la cadencia está declarada", () => {
    const weekly = projectDocumentPolicy({ lifecycle: "open", currentStage: "design", meetingFrequency: "Reunión semanal", hasApprovedBaseline: true, recoveryPlanRequired: null });
    const monthly = projectDocumentPolicy({ lifecycle: "open", currentStage: "design", meetingFrequency: "Mensual", hasApprovedBaseline: true, recoveryPlanRequired: null });
    expect(weekly.find(rule => rule.kind === "executive_minutes")?.applicability).toBe("required");
    expect(monthly.find(rule => rule.kind === "executive_minutes")?.applicability).toBe("unconfirmed");
  });

  it("no inventa reportes periódicos sin calendario persistido", () => {
    const rules = recurringServiceDocumentPolicy({ lifecycle: "open", serviceType: "mixto", hasReportSchedule: false });
    expect(rules.find(rule => rule.kind === "service_contract")?.applicability).toBe("required");
    expect(rules.find(rule => rule.kind === "service_work_plan")?.applicability).toBe("required");
    expect(rules.find(rule => rule.kind === "service_periodic_report")?.applicability).toBe("unconfirmed");
  });

  it("mantiene el plan de Staffing como condicional", () => {
    const rules = recurringServiceDocumentPolicy({ lifecycle: "open", serviceType: "staffing", hasReportSchedule: true });
    expect(rules.find(rule => rule.kind === "service_work_plan")?.applicability).toBe("conditional");
    expect(rules.find(rule => rule.kind === "service_periodic_report")?.applicability).toBe("required");
  });
});
