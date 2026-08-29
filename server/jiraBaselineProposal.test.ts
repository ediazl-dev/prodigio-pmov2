import { describe, expect, it } from "vitest";
import {
  JIRA_PROVISIONAL_BASELINE_VERSION,
  assessJiraBaselineApproval,
  assessJiraBaselineOperator,
  buildMappedJiraBaselineProposal,
} from "./jiraBaselineProposal";

const snapshot = {
  issues: [
    {
      key: "PILOT-10",
      summary: "Hito con fecha",
      statusName: "Done",
      statusCategory: "done",
      dueDate: "2026-03-20",
      resolutionDate: "2026-05-25T12:00:00.000Z",
    },
    {
      key: "PILOT-11",
      summary: "Hito sin fecha",
      statusName: "En curso",
      statusCategory: "indeterminate",
      dueDate: null,
      resolutionDate: null,
    },
    { key: "PILOT-20", summary: "Riesgo", statusName: "Open", statusCategory: "new" },
  ],
};

describe("jira baseline proposal H5", () => {
  it("incluye solo hitos con mapeo aprobado y no inventa pesos financieros", () => {
    const result = buildMappedJiraBaselineProposal({
      sourceSnapshot: snapshot,
      mappings: [
        { sourceKey: "PILOT-10", targetEntityType: "milestone", targetEntityId: "M01", status: "approved" },
        { sourceKey: "PILOT-11", targetEntityType: "milestone", targetEntityId: "M02", status: "approved" },
        { sourceKey: "PILOT-20", targetEntityType: "risk", status: "approved" },
        { sourceKey: "PILOT-99", targetEntityType: "milestone", status: "excluded" },
      ],
      now: new Date("2026-08-29T12:00:00Z"),
    });

    expect(result.baselineVersion).toBe(JIRA_PROVISIONAL_BASELINE_VERSION);
    expect(result.milestones.map(item => item.milestoneCode)).toEqual(["M01", "M02"]);
    expect(result.milestones.every(item => item.billingWeight === "0.00")).toBe(true);
  });

  it("mantiene separadas baseline propuesta, fecha Jira y cierre Jira", () => {
    const result = buildMappedJiraBaselineProposal({
      sourceSnapshot: snapshot,
      mappings: [{ sourceKey: "PILOT-10", targetEntityType: "milestone", targetEntityId: "M01", status: "approved" }],
    });
    expect(result.milestones[0]).toMatchObject({
      baselineDate: "2026-03-20",
      jiraDueDate: "2026-03-20",
      jiraClosedDate: "2026-05-25",
      semanticStatus: "fulfilled",
    });
  });

  it("mantiene una brecha explícita cuando falta la fecha Jira", () => {
    const result = buildMappedJiraBaselineProposal({
      sourceSnapshot: snapshot,
      mappings: [{ sourceKey: "PILOT-11", targetEntityType: "milestone", targetEntityId: "M02", status: "approved" }],
    });
    expect(result.milestones[0].baselineDate).toBeNull();
    expect(result.missingBaselineIssueKeys).toEqual(["PILOT-11"]);
    expect(result.exceptions[0].reason).toContain("[PENDIENTE]");
  });

  it("impide aprobar una propuesta con fechas contractuales pendientes", () => {
    const result = assessJiraBaselineApproval({
      sourceStatus: "draft",
      milestones: [
        { jiraIssueKey: "PILOT-10", baselineDate: "2026-03-20" },
        { jiraIssueKey: "PILOT-11", baselineDate: null },
      ],
    });
    expect(result.approvable).toBe(false);
    expect(result.missingBaselineIssueKeys).toEqual(["PILOT-11"]);
  });

  it("permite aprobación humana solo cuando el draft tiene hitos y fechas completas", () => {
    expect(assessJiraBaselineApproval({
      sourceStatus: "draft",
      milestones: [{ jiraIssueKey: "PILOT-10", baselineDate: "2026-03-20" }],
    })).toEqual({ approvable: true, reasons: [], missingBaselineIssueKeys: [] });
    expect(assessJiraBaselineApproval({ sourceStatus: "approved", milestones: [] }).approvable).toBe(false);
  });

  it("autoriza Admin/PMO y únicamente al PM asignado para operar el baseline", () => {
    expect(assessJiraBaselineOperator({ role: "admin", userId: 1, identitySnapshot: null }).allowed).toBe(true);
    expect(assessJiraBaselineOperator({ role: "pmo", userId: 2, identitySnapshot: null }).allowed).toBe(true);
    expect(assessJiraBaselineOperator({ role: "pm", userId: 7, identitySnapshot: { pmUserId: 7 } }).allowed).toBe(true);
    expect(assessJiraBaselineOperator({ role: "pm", userId: 8, identitySnapshot: { pmUserId: 7 } })).toMatchObject({
      allowed: false,
      reason: "Solo el PM asignado al proyecto puede operar o aprobar su propuesta de baseline.",
    });
    expect(assessJiraBaselineOperator({ role: "consulta", userId: 7, identitySnapshot: { pmUserId: 7 } }).allowed).toBe(false);
  });
});
