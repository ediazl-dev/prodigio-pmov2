import { describe, expect, it } from "vitest";
import { buildClaro2397SetupPlan } from "./claro2397SetupPlan";
function fixture() {
  return {
    service: { id: 3090001, dealId: "2397", jsmProjectKey: "MDSCE2937", status: "activo" },
    workItems: Array.from({ length: 32 }, (_, i) => ({ id: 450001 + i, jiraIssueKey: `MDSCE2937-${i + 1}` })),
    workIssues: Array.from({ length: 32 }, (_, i) => ({ key: `MDSCE2937-${i + 1}`, fields: { project: { key: "MDSCE2937" }, summary: `Actividad ${i + 1}` } })),
    billing: Array.from({ length: 12 }, (_, i) => ({ id: 3060001 + i, monthNumber: i + 1, jiraIssueKey: null as string | null })),
    billingIssues: Array.from({ length: 12 }, (_, i) => ({ key: `MDS2937-${i + 56}`, fields: { project: { key: "MDS2937" }, summary: `Facturación Mes ${i + 1} - Renovación Deal 2397` } })),
  };
}
describe("reutilización segura Claro2397", () => {
  it("asocia doce originales sin nuevas creaciones ni modificación de datos", () => {
    const input = fixture(); const before = JSON.stringify(input); const plan = buildClaro2397SetupPlan(input);
    expect(plan.bindings).toHaveLength(12); expect(plan.bindings[0].jiraIssueKey).toBe("MDS2937-56");
    expect(plan.policy.workPlanMode).toBe("external_reference"); expect(plan.policy.billingMode).toBe("external_reference");
    expect(JSON.stringify(input)).toBe(before); expect(plan).not.toHaveProperty("createIssues");
  });
  it("rechaza otra identidad y un hito de otro Deal", () => {
    const input = fixture(); input.service.dealId = "2383"; expect(() => buildClaro2397SetupPlan(input)).toThrow();
    const other = fixture(); other.billingIssues[0].fields.summary = "Facturación Mes 1 Deal 2383"; expect(() => buildClaro2397SetupPlan(other)).toThrow();
  });
  it("rechaza mes incorrecto y cambios de vínculo", () => {
    const input = fixture(); input.billingIssues[0].fields.summary = "Facturación Mes 2 Deal 2397"; expect(() => buildClaro2397SetupPlan(input)).toThrow();
    const linked = fixture(); linked.billing[0].jiraIssueKey = "OTRO-1"; expect(() => buildClaro2397SetupPlan(linked)).toThrow();
  });
  it("rechaza actividad no verificada y admite reanudación de vínculos iguales", () => {
    const input = fixture(); input.workIssues.pop(); expect(() => buildClaro2397SetupPlan(input)).toThrow();
    const linked = fixture(); for (const item of linked.billing) item.jiraIssueKey = `MDS2937-${55 + item.monthNumber}`;
    expect(buildClaro2397SetupPlan(linked).bindings).toHaveLength(12);
  });
});
