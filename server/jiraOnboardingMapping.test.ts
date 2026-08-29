import { describe, expect, it } from "vitest";
import {
  buildJiraMappingCandidates,
  classifyJiraIssueType,
  validateJiraOnboardingIdentity,
} from "./jiraOnboardingMapping";

describe("mapeo H3 de onboarding Jira", () => {
  it("clasifica candidatos reconocidos y excluye por defecto tipos desconocidos", () => {
    expect(classifyJiraIssueType("Hito PMO")).toBe("milestone");
    expect(classifyJiraIssueType("Riesgo PMO")).toBe("risk");
    expect(classifyJiraIssueType("Epic")).toBe("epic");
    expect(classifyJiraIssueType("Story")).toBe("task");
    expect(classifyJiraIssueType("Solicitud externa")).toBe("ignored");
  });

  it("conserva key, responsable y fechas observadas sin inventar faltantes", () => {
    const candidates = buildJiraMappingCandidates({ issues: [
      { key: "pilot-2", issueType: "Story", summary: "Historia", statusName: "Open", assigneeAccountId: "jira-1", assigneeName: "Persona Jira", dueDate: null },
      { key: "pilot-1", issueType: "Hito PMO", summary: "", statusName: "Done", dueDate: "2026-09-30" },
    ] });
    expect(candidates.map(item => item.sourceKey)).toEqual(["PILOT-1", "PILOT-2"]);
    expect(candidates[0].summary).toBe("[POR CONFIRMAR]");
    expect(candidates[0].dueDate).toBe("2026-09-30");
    expect(candidates[1].assigneeName).toBe("Persona Jira");
  });

  it("bloquea identidad incompleta y acepta únicamente los campos obligatorios confirmados", () => {
    expect(validateJiraOnboardingIdentity({ projectName: "Proyecto" }).complete).toBe(false);
    const result = validateJiraOnboardingIdentity({
      projectName: "Proyecto", clientName: "Cliente", projectType: "desarrollo",
      pmUserId: 10, pmName: "PM", deliveryUserId: 11, deliveryName: "Delivery", dealId: "Deal5000",
    });
    expect(result).toEqual({ complete: true, missing: [] });
  });
});
