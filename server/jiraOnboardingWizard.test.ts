import { describe, expect, it } from "vitest";
import { buildJiraMappingSubmission, resolveJiraWizardStep } from "../client/src/pages/admin/jiraOnboardingWizard";

describe("orquestación del wizard Jira H3", () => {
  it("mantiene bloqueos en preflight y reanuda estados persistidos", () => {
    expect(resolveJiraWizardStep(false, "preflight")).toBe("preflight");
    expect(resolveJiraWizardStep(true, "mapping")).toBe("mapping");
    expect(resolveJiraWizardStep(true, "reconciliation")).toBe("ready");
  });

  it("genera una decisión por candidato y respeta una corrección manual", () => {
    const result = buildJiraMappingSubmission([
      { sourceKey: "PILOT-1", proposedTargetEntityType: "milestone" },
      { sourceKey: "PILOT-2", proposedTargetEntityType: "task" },
    ], { "PILOT-2": "risk" });
    expect(result).toEqual([
      { sourceKey: "PILOT-1", targetEntityType: "milestone", syncDirection: "jira_to_pmo" },
      { sourceKey: "PILOT-2", targetEntityType: "risk", syncDirection: "jira_to_pmo" },
    ]);
  });

  it("recupera mapeos persistidos al reabrir el asistente", () => {
    const [result] = buildJiraMappingSubmission(
      [{ sourceKey: "PILOT-1", proposedTargetEntityType: "task" }],
      {},
      [{ sourceKey: "PILOT-1", targetEntityType: "epic" }],
    );
    expect(result.targetEntityType).toBe("epic");
  });

  it("convierte una exclusión explícita en sincronización deshabilitada", () => {
    const [result] = buildJiraMappingSubmission(
      [{ sourceKey: "PILOT-1", proposedTargetEntityType: "task" }],
      { "PILOT-1": "ignored" },
    );
    expect(result.syncDirection).toBe("none");
  });
});
