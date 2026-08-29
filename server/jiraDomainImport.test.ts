import { describe, expect, it } from "vitest";
import { buildMappedJiraDomainImport } from "./jiraDomainImport";

describe("buildMappedJiraDomainImport", () => {
  it("importa solo mappings aprobados y conserva observaciones Jira sin inventar clasificaciones PMO", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: {
        issues: [
          {
            key: "PRJ-10",
            summary: "Dependencia externa pendiente",
            issueType: "Riesgos PMO",
            statusName: "En análisis",
            statusCategory: "In Progress",
            assigneeAccountId: "jira-user-1",
            assigneeName: "Responsable Jira",
            dueDate: "2026-09-30T00:00:00.000Z",
          },
          { key: "PRJ-99", summary: "No aprobado", issueType: "Task" },
        ],
      },
      mappings: [
        { sourceKey: "prj-10", targetEntityType: "risk", targetEntityId: "R-10", status: "approved" },
        { sourceKey: "PRJ-99", targetEntityType: "task", status: "proposed" },
      ],
    });

    expect(result.risks).toEqual([expect.objectContaining({
      riskCode: "R-10",
      description: "Dependencia externa pendiente",
      category: "por_confirmar",
      probability: "por_confirmar",
      impact: "por_confirmar",
      owner: "Responsable Jira",
      dueDate: "2026-09-30",
      jiraIssueKey: "PRJ-10",
      jiraStatusName: "En análisis",
      jiraStatusCategory: "In Progress",
      jiraAssigneeId: "jira-user-1",
      confirmed: false,
    })]);
    expect(result.wbsItems).toEqual([]);
    expect(result.exceptions).toEqual([]);
  });

  it("mantiene faltantes explícitos para riesgos sin resumen, responsable ni fecha", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: { issues: [{ key: "PRJ-20", issueType: "Riesgos PMO" }] },
      mappings: [{ sourceKey: "PRJ-20", targetEntityType: "risk", status: "approved" }],
    });

    expect(result.risks[0]).toMatchObject({
      riskCode: "PRJ-20",
      description: "[POR CONFIRMAR]",
      owner: "[POR CONFIRMAR]",
      dueDate: null,
      jiraStatusName: null,
      jiraStatusCategory: null,
      jiraAssigneeId: null,
    });
  });

  it("conserva jerarquía Epic → Story → Task solo desde parentKey real", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: {
        issues: [
          { key: "PRJ-1", summary: "Epic A", issueType: "Epic" },
          { key: "PRJ-2", summary: "Historia A", issueType: "Story", parentKey: "PRJ-1" },
          { key: "PRJ-3", summary: "Tarea A", issueType: "Task", parentKey: "PRJ-2" },
        ],
      },
      mappings: [
        { sourceKey: "PRJ-1", targetEntityType: "epic", status: "approved" },
        { sourceKey: "PRJ-2", targetEntityType: "task", status: "approved" },
        { sourceKey: "PRJ-3", targetEntityType: "task", status: "approved" },
      ],
    });

    expect(result.wbsItems).toEqual([
      expect.objectContaining({ jiraIssueKey: "PRJ-1", issueLevel: "epic", epicCode: "PRJ-1", storyCode: null, jiraParentKey: null }),
      expect.objectContaining({ jiraIssueKey: "PRJ-2", issueLevel: "story", epicCode: "PRJ-1", storyCode: "PRJ-2", jiraParentKey: "PRJ-1" }),
      expect.objectContaining({ jiraIssueKey: "PRJ-3", issueLevel: "task", epicCode: "PRJ-1", storyCode: "PRJ-2", jiraParentKey: "PRJ-2" }),
    ]);
    expect(result.exceptions).toEqual([]);
  });

  it("registra excepción cuando una tarea carece de parentKey o el padre no está aprobado", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: {
        issues: [
          { key: "PRJ-30", summary: "Tarea sin padre", issueType: "Task" },
          { key: "PRJ-31", summary: "Tarea con padre no mapeado", issueType: "Task", parentKey: "PRJ-200" },
        ],
      },
      mappings: [
        { sourceKey: "PRJ-30", targetEntityType: "task", status: "approved" },
        { sourceKey: "PRJ-31", targetEntityType: "task", status: "approved" },
      ],
    });

    expect(result.wbsItems).toHaveLength(2);
    expect(result.exceptions).toEqual([
      expect.objectContaining({ domain: "planning", sourceKey: "PRJ-30", reason: expect.stringContaining("[POR CONFIRMAR]") }),
      expect.objectContaining({ domain: "planning", sourceKey: "PRJ-31", reason: expect.stringContaining("PRJ-200") }),
    ]);
  });

  it("registra excepción si el padre está aprobado pero ya no está en el snapshot", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: {
        issues: [{ key: "PRJ-32", summary: "Tarea huérfana", issueType: "Task", parentKey: "PRJ-300" }],
      },
      mappings: [
        { sourceKey: "PRJ-32", targetEntityType: "task", status: "approved" },
        { sourceKey: "PRJ-300", targetEntityType: "epic", status: "approved" },
      ],
    });

    expect(result.wbsItems).toEqual([expect.objectContaining({
      jiraIssueKey: "PRJ-32",
      jiraParentKey: "PRJ-300",
      epicCode: null,
    })]);
    expect(result.exceptions).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceKey: "PRJ-32", reason: expect.stringContaining("no está presente") }),
      expect.objectContaining({ sourceKey: "PRJ-300", reason: expect.stringContaining("no está presente") }),
    ]));
    expect(result.exceptions).toHaveLength(2);
  });

  it("omite mappings cuyo issue ya no existe y deja una excepción resoluble por dominio", () => {
    const result = buildMappedJiraDomainImport({
      sourceSnapshot: { issues: [] },
      mappings: [
        { sourceKey: "PRJ-40", targetEntityType: "risk", status: "approved" },
        { sourceKey: "PRJ-41", targetEntityType: "epic", status: "approved" },
        { sourceKey: "PRJ-42", targetEntityType: "milestone", status: "approved" },
      ],
    });

    expect(result.risks).toEqual([]);
    expect(result.wbsItems).toEqual([]);
    expect(result.exceptions).toEqual([
      { domain: "risks", sourceKey: "PRJ-40", reason: "El issue aprobado no está presente en el snapshot Jira vigente." },
      { domain: "planning", sourceKey: "PRJ-41", reason: "El issue aprobado no está presente en el snapshot Jira vigente." },
    ]);
  });
});
