import { describe, expect, it } from "vitest";
import {
  buildJiraReconciliationPlan,
  mergeRefreshedJiraIssues,
  normalizeRawJiraIssue,
  reconciliationIssueKeys,
  selectApprovedJiraToPmoMappings,
} from "./jiraReconciliation";

const mappings = [
  { sourceKey: "abc-3", targetEntityType: "task", status: "approved", syncDirection: "jira_to_pmo" },
  { sourceKey: "abc-1", targetEntityType: "milestone", status: "approved", syncDirection: "jira_to_pmo", targetEntityId: "M01" },
  { sourceKey: "abc-2", targetEntityType: "risk", status: "proposed", syncDirection: "jira_to_pmo" },
  { sourceKey: "abc-4", targetEntityType: "task", status: "approved", syncDirection: "pmo_to_jira_explicit" },
  { sourceKey: "ABC-3", targetEntityType: "ignored", status: "approved", syncDirection: "jira_to_pmo" },
];

describe("jiraReconciliation H7", () => {
  it("selecciona solo mappings aprobados Jira→PMO y deduplica claves", () => {
    expect(selectApprovedJiraToPmoMappings(mappings)).toMatchObject([
      { sourceKey: "ABC-1", targetEntityType: "milestone" },
      { sourceKey: "ABC-3", targetEntityType: "task" },
    ]);
    expect(reconciliationIssueKeys(mappings)).toEqual(["ABC-1", "ABC-3"]);
  });

  it("normaliza exclusivamente campos observados desde Jira", () => {
    expect(normalizeRawJiraIssue({
      key: "abc-7",
      fields: {
        summary: "  Hito real  ",
        issuetype: { name: "Hito PMO" },
        status: { name: "Cerrado", statusCategory: { key: "done", name: "Completado" } },
        assignee: { accountId: "a-1", displayName: "PM Real" },
        duedate: "2026-08-20",
        resolutiondate: "2026-08-25T10:00:00.000Z",
        parent: { key: "abc-1" },
      },
    })).toEqual({
      key: "ABC-7",
      summary: "Hito real",
      issueType: "Hito PMO",
      statusName: "Cerrado",
      statusCategory: "done",
      assigneeAccountId: "a-1",
      assigneeName: "PM Real",
      dueDate: "2026-08-20",
      resolutionDate: "2026-08-25",
      parentKey: "ABC-1",
    });
  });

  it("reemplaza claves solicitadas, elimina observaciones obsoletas y conserva otras claves", () => {
    const snapshot = mergeRefreshedJiraIssues({
      sourceSnapshot: {
        asOf: "2026-08-01T00:00:00.000Z",
        issues: [
          { key: "ABC-1", summary: "obsoleto", statusName: "Abierto" },
          { key: "ABC-2", summary: "fuera del alcance" },
          { key: "ABC-3", summary: "desaparecido" },
        ],
      },
      requestedKeys: ["ABC-1", "ABC-3"],
      refreshedIssues: [{ key: "ABC-1", fields: { summary: "vigente" } }],
      asOf: "2026-08-29T12:00:00.000Z",
    });
    expect(snapshot.asOf).toBe("2026-08-29T12:00:00.000Z");
    expect(snapshot.issues).toEqual([
      expect.objectContaining({ key: "ABC-1", summary: "vigente" }),
      { key: "ABC-2", summary: "fuera del alcance" },
    ]);
  });

  it("concilia hitos solo con observaciones Jira y mantiene baseline/aceptación fuera del contrato", () => {
    const result = buildJiraReconciliationPlan({
      sourceSnapshot: {
        issues: [{
          key: "ABC-1",
          summary: "Entrega",
          issueType: "Hito PMO",
          statusName: "Cerrado",
          statusCategory: "Completado",
          dueDate: "2026-03-20",
          resolutionDate: "2026-05-25",
        }],
      },
      mappings: [{
        sourceKey: "ABC-1",
        targetEntityType: "milestone",
        targetEntityId: "M01",
        status: "approved",
        syncDirection: "jira_to_pmo",
      }],
      now: new Date("2026-08-29T12:00:00.000Z"),
    });
    expect(result.milestones).toEqual([{
      sourceKey: "ABC-1",
      targetEntityId: "M01",
      jiraStatusName: "Cerrado",
      jiraDueDate: "2026-03-20",
      jiraClosedDate: "2026-05-25",
      semanticStatus: "fulfilled",
    }]);
    expect(result.milestones[0]).not.toHaveProperty("baselineDate");
    expect(result.milestones[0]).not.toHaveProperty("acceptanceDate");
    expect(result.milestones[0]).not.toHaveProperty("evidenceUrl");
  });

  it("no reutiliza el hito obsoleto cuando Jira omite una clave aprobada", () => {
    const refreshed = mergeRefreshedJiraIssues({
      sourceSnapshot: { issues: [{ key: "ABC-1", statusName: "Cerrado", statusCategory: "done" }] },
      requestedKeys: ["ABC-1"],
      refreshedIssues: [],
      asOf: "2026-08-29T12:00:00.000Z",
    });
    const result = buildJiraReconciliationPlan({
      sourceSnapshot: refreshed,
      mappings: [{ sourceKey: "ABC-1", targetEntityType: "milestone", status: "approved", syncDirection: "jira_to_pmo" }],
    });
    expect(result.milestones).toHaveLength(0);
    expect(result.exceptions).toContainEqual(expect.objectContaining({ domain: "milestones", sourceKey: "ABC-1" }));
  });
});
