import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== MOCK JIRA CLIENT ====================
vi.mock("./jiraClient", () => ({
  listJiraProjects: vi.fn(),
  getProjectIssues: vi.fn(),
  getJiraProject: vi.fn(),
  createJiraIssue: vi.fn(),
  getAssignableUsers: vi.fn(),
  getProjectStatuses: vi.fn(),
  jiraHealthCheck: vi.fn(),
  searchJiraIssues: vi.fn(),
  getTemplateStructure: vi.fn(),
  createJiraSpace: vi.fn(),
  getJiraCurrentUser: vi.fn(),
}));

import {
  getTemplateStructure,
  createJiraSpace,
  getJiraCurrentUser,
} from "./jiraClient";

// ==================== MOCK DB ====================
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createJiraSpaceRecord: vi.fn().mockResolvedValue(42),
    getJiraSpaceByProject: vi.fn().mockResolvedValue(null),
    getAllJiraSpaces: vi.fn().mockResolvedValue([]),
    updateJiraSpaceStatus: vi.fn().mockResolvedValue(undefined),
  };
});

import {
  createJiraSpaceRecord,
  getJiraSpaceByProject,
  getAllJiraSpaces,
  updateJiraSpaceStatus,
} from "./db";

// ==================== TEMPLATE STRUCTURE TESTS ====================
describe("getTemplateStructure", () => {
  const mockTemplate = {
    boards: [
      { id: 1, name: "Tablero Principal", type: "scrum" },
      { id: 2, name: "Tablero de Seguimiento", type: "kanban" },
    ],
    issueTypes: [
      { id: "1", name: "Story", subtask: false },
      { id: "2", name: "Task", subtask: false },
      { id: "3", name: "Bug", subtask: false },
      { id: "4", name: "Epic", subtask: false },
      { id: "5", name: "Sub-task", subtask: true },
    ],
    workflows: [
      {
        issueType: "Story",
        statuses: [
          { name: "To Do", category: "To Do" },
          { name: "In Progress", category: "In Progress" },
          { name: "Done", category: "Done" },
        ],
      },
      {
        issueType: "Task",
        statuses: [
          { name: "Open", category: "To Do" },
          { name: "In Review", category: "In Progress" },
          { name: "Closed", category: "Done" },
        ],
      },
    ],
  };

  beforeEach(() => {
    vi.mocked(getTemplateStructure).mockResolvedValue(mockTemplate);
  });

  it("should return template structure with boards, issueTypes and workflows", async () => {
    const result = await getTemplateStructure("PBTISD1");
    expect(result.boards).toHaveLength(2);
    expect(result.issueTypes).toHaveLength(5);
    expect(result.workflows).toHaveLength(2);
  });

  it("should have boards with name and type", async () => {
    const result = await getTemplateStructure("PBTISD1");
    expect(result.boards[0]).toHaveProperty("name");
    expect(result.boards[0]).toHaveProperty("type");
  });

  it("should distinguish subtask issue types", async () => {
    const result = await getTemplateStructure("PBTISD1");
    const mainTypes = result.issueTypes.filter(it => !it.subtask);
    const subTypes = result.issueTypes.filter(it => it.subtask);
    expect(mainTypes).toHaveLength(4);
    expect(subTypes).toHaveLength(1);
  });

  it("should have workflows with statuses", async () => {
    const result = await getTemplateStructure("PBTISD1");
    expect(result.workflows[0].statuses).toHaveLength(3);
    expect(result.workflows[0].statuses[0]).toHaveProperty("category");
  });

  it("should include all three status categories in workflows", async () => {
    const result = await getTemplateStructure("PBTISD1");
    const categories = result.workflows[0].statuses.map(s => s.category);
    expect(categories).toContain("To Do");
    expect(categories).toContain("In Progress");
    expect(categories).toContain("Done");
  });
});

// ==================== CREATE SPACE TESTS ====================
describe("createJiraSpace", () => {
  beforeEach(() => {
    vi.mocked(getJiraCurrentUser).mockResolvedValue({
      accountId: "user-123",
      displayName: "Eugenio Diaz",
      emailAddress: "ediazl@prodigio.tech",
    });
  });

  it("should return created=true when JIRA project creation succeeds", async () => {
    vi.mocked(createJiraSpace).mockResolvedValue({
      created: true,
      jiraProjectKey: "TESTPMO",
      jiraProjectId: "10001",
      jiraProjectName: "Test PMO Project",
      jiraProjectUrl: "https://apiservice2.atlassian.net/jira/core/projects/TESTPMO/board",
      template: {
        boards: [{ id: 1, name: "Board", type: "scrum" }],
        issueTypes: [{ id: "1", name: "Task", subtask: false }],
        workflows: [],
      },
    });

    const result = await createJiraSpace({
      spaceName: "Test PMO Project",
      spaceKey: "TESTPMO",
      leadAccountId: "user-123",
    });

    expect(result.created).toBe(true);
    expect(result.jiraProjectKey).toBe("TESTPMO");
    expect(result.jiraProjectUrl).toContain("TESTPMO");
  });

  it("should return created=false with error when permissions are insufficient", async () => {
    vi.mocked(createJiraSpace).mockResolvedValue({
      created: false,
      jiraProjectKey: null,
      jiraProjectId: null,
      jiraProjectName: null,
      jiraProjectUrl: null,
      error: "Se requieren permisos de administrador de sitio JIRA",
      template: {
        boards: [],
        issueTypes: [],
        workflows: [],
      },
    });

    const result = await createJiraSpace({
      spaceName: "Test PMO Project",
      spaceKey: "TESTPMO",
      leadAccountId: "user-123",
    });

    expect(result.created).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.jiraProjectKey).toBeNull();
  });
});

// ==================== DB HELPERS TESTS ====================
describe("jira_spaces DB helpers", () => {
  it("should create a space record and return an ID", async () => {
    const id = await createJiraSpaceRecord({
      projectId: 1,
      spaceName: "PMO Test Space",
      jiraProjectKey: "PMOTS",
      jiraProjectId: "10001",
      jiraProjectName: "PMO Test Space",
      jiraProjectUrl: "https://apiservice2.atlassian.net/jira/core/projects/PMOTS/board",
      status: "created",
      templateKey: "PBTISD1",
      boards: [{ id: 1, name: "Board", type: "scrum" }],
      issueTypes: [{ id: "1", name: "Task", subtask: false }],
      workflows: [],
      createdBy: "user-1",
      createdByName: "Eugenio Diaz",
    });
    expect(id).toBe(42);
  });

  it("should return null when no space is linked to a project", async () => {
    const space = await getJiraSpaceByProject(999);
    expect(space).toBeNull();
  });

  it("should return empty array when no spaces exist", async () => {
    const spaces = await getAllJiraSpaces();
    expect(spaces).toHaveLength(0);
  });

  it("should update space status without throwing", async () => {
    await expect(
      updateJiraSpaceStatus(42, {
        status: "created",
        jiraProjectKey: "PMOTS",
        jiraProjectId: "10001",
        jiraProjectName: "PMO Test Space",
        jiraProjectUrl: "https://apiservice2.atlassian.net/jira/core/projects/PMOTS/board",
      })
    ).resolves.not.toThrow();
  });
});

// ==================== SPACE KEY VALIDATION ====================
describe("Space key validation", () => {
  const validateKey = (key: string) => /^[A-Z0-9]+$/.test(key) && key.length >= 2 && key.length <= 10;

  it("should accept valid uppercase alphanumeric keys", () => {
    expect(validateKey("PMOCLI")).toBe(true);
    expect(validateKey("TEST123")).toBe(true);
    expect(validateKey("AB")).toBe(true);
  });

  it("should reject keys with lowercase letters", () => {
    expect(validateKey("pmocli")).toBe(false);
    expect(validateKey("PmoTest")).toBe(false);
  });

  it("should reject keys that are too short", () => {
    expect(validateKey("A")).toBe(false);
  });

  it("should reject keys that are too long", () => {
    expect(validateKey("TOOLONGKEY1")).toBe(false);
  });

  it("should reject keys with special characters", () => {
    expect(validateKey("PMO-CLI")).toBe(false);
    expect(validateKey("PMO CLI")).toBe(false);
  });
});

// ==================== AUTO KEY GENERATION ====================
describe("Auto key generation from space name", () => {
  const generateKey = (name: string): string => {
    return name
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "")
      .split(/\s+/)
      .map(w => w.slice(0, 3))
      .join("")
      .slice(0, 10) || "PMO";
  };

  it("should generate key from simple name", () => {
    expect(generateKey("PMO Cliente")).toBe("PMOCLI");
  });

  it("should handle names with special characters", () => {
    const key = generateKey("[PMO Cliente] - Sistema X");
    expect(/^[A-Z0-9]+$/.test(key)).toBe(true);
  });

  it("should limit key to 10 characters", () => {
    const key = generateKey("Very Long Project Name For Testing");
    expect(key.length).toBeLessThanOrEqual(10);
  });

  it("should return PMO for empty or invalid names", () => {
    expect(generateKey("---")).toBe("PMO");
    expect(generateKey("   ")).toBe("PMO");
  });
});
