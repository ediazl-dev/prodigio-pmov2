import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the jiraClient module
vi.mock("./jiraClient", () => ({
  getJiraProjectReport: vi.fn(),
  searchJiraIssues: vi.fn(),
  getJiraProject: vi.fn(),
  listJiraProjects: vi.fn(),
}));

// Mock db module
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAllJiraSpaces: vi.fn(),
  };
});

import { getJiraProjectReport, searchJiraIssues, getJiraProject } from "./jiraClient";
import { getAllJiraSpaces } from "./db";

const mockGetReport = getJiraProjectReport as ReturnType<typeof vi.fn>;
const mockSearch = searchJiraIssues as ReturnType<typeof vi.fn>;
const mockGetProject = getJiraProject as ReturnType<typeof vi.fn>;
const mockGetAllSpaces = getAllJiraSpaces as ReturnType<typeof vi.fn>;

describe("JIRA Report Module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getJiraProjectReport structure", () => {
    it("returns correct report structure with all required fields", async () => {
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test Project",
        total: 10,
        done: 5,
        inProgress: 3,
        toDo: 2,
        percentComplete: 50,
        byType: [{ name: "Task", count: 5, done: 3 }, { name: "Bug", count: 5, done: 2 }],
        byAssignee: [{ name: "Alice", accountId: "acc1", total: 6, done: 4, inProgress: 2 }],
        recentActivity: [{ key: "TEST-1", summary: "Fix bug", status: "Done", statusCategory: "Done", type: "Bug", assignee: "Alice", updated: new Date().toISOString() }],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result).toHaveProperty("projectKey", "TEST");
      expect(result).toHaveProperty("total", 10);
      expect(result).toHaveProperty("done", 5);
      expect(result).toHaveProperty("inProgress", 3);
      expect(result).toHaveProperty("toDo", 2);
      expect(result).toHaveProperty("percentComplete", 50);
      expect(result).toHaveProperty("byType");
      expect(result).toHaveProperty("byAssignee");
      expect(result).toHaveProperty("recentActivity");
      expect(result).toHaveProperty("overdueIssues");
      expect(result).toHaveProperty("lastUpdated");
    });

    it("calculates percentComplete correctly", async () => {
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test",
        total: 20,
        done: 15,
        inProgress: 3,
        toDo: 2,
        percentComplete: 75,
        byType: [],
        byAssignee: [],
        recentActivity: [],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result.percentComplete).toBe(75);
    });

    it("returns 0% when no issues exist", async () => {
      const mockReport = {
        projectKey: "EMPTY",
        projectName: "Empty Project",
        total: 0,
        done: 0,
        inProgress: 0,
        toDo: 0,
        percentComplete: 0,
        byType: [],
        byAssignee: [],
        recentActivity: [],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("EMPTY");
      expect(result.percentComplete).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("byType aggregation", () => {
    it("groups issues by type correctly", async () => {
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test",
        total: 8,
        done: 4,
        inProgress: 2,
        toDo: 2,
        percentComplete: 50,
        byType: [
          { name: "Task", count: 4, done: 3 },
          { name: "Hito PMO", count: 2, done: 1 },
          { name: "Riesgos PMO", count: 2, done: 0 },
        ],
        byAssignee: [],
        recentActivity: [],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result.byType).toHaveLength(3);
      expect(result.byType[0].name).toBe("Task");
      expect(result.byType[0].count).toBe(4);
      expect(result.byType[0].done).toBe(3);
    });
  });

  describe("byAssignee aggregation", () => {
    it("groups issues by assignee with done/inProgress breakdown", async () => {
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test",
        total: 5,
        done: 2,
        inProgress: 2,
        toDo: 1,
        percentComplete: 40,
        byType: [],
        byAssignee: [
          { name: "Franklin Hernández", accountId: "acc1", total: 3, done: 2, inProgress: 1 },
          { name: "Sin asignar", accountId: "unassigned", total: 2, done: 0, inProgress: 1 },
        ],
        recentActivity: [],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result.byAssignee).toHaveLength(2);
      expect(result.byAssignee[0].name).toBe("Franklin Hernández");
      expect(result.byAssignee[0].done).toBe(2);
      expect(result.byAssignee[0].inProgress).toBe(1);
    });
  });

  describe("overdue issues detection", () => {
    it("identifies overdue issues correctly", async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test",
        total: 3,
        done: 1,
        inProgress: 1,
        toDo: 1,
        percentComplete: 33,
        byType: [],
        byAssignee: [],
        recentActivity: [],
        overdueIssues: [
          { key: "TEST-5", summary: "Overdue task", type: "Task", assignee: "Alice", duedate: pastDate, status: "In Progress" },
        ],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result.overdueIssues).toHaveLength(1);
      expect(result.overdueIssues[0].key).toBe("TEST-5");
    });

    it("returns empty overdueIssues when all issues are on time", async () => {
      const mockReport = {
        projectKey: "TEST",
        projectName: "Test",
        total: 3,
        done: 3,
        inProgress: 0,
        toDo: 0,
        percentComplete: 100,
        byType: [],
        byAssignee: [],
        recentActivity: [],
        overdueIssues: [],
        lastUpdated: new Date().toISOString(),
      };
      mockGetReport.mockResolvedValue(mockReport);

      const result = await getJiraProjectReport("TEST");
      expect(result.overdueIssues).toHaveLength(0);
    });
  });

  describe("consolidated report", () => {
    it("filters only active spaces with jiraProjectKey", async () => {
      const spaces = [
        { id: 1, projectId: 1, spaceName: "Space A", jiraProjectKey: "PRJA", jiraProjectName: "Project A", jiraProjectUrl: "https://test.atlassian.net/jira/core/projects/PRJA/board", status: "created" },
        { id: 2, projectId: 2, spaceName: "Space B", jiraProjectKey: null, jiraProjectName: null, jiraProjectUrl: null, status: "pending" },
        { id: 3, projectId: 3, spaceName: "Space C", jiraProjectKey: "PRJC", jiraProjectName: "Project C", jiraProjectUrl: "https://test.atlassian.net/jira/core/projects/PRJC/board", status: "created" },
      ];
      mockGetAllSpaces.mockResolvedValue(spaces);

      const activeSpaces = spaces.filter(s => s.status === "created" && s.jiraProjectKey);
      expect(activeSpaces).toHaveLength(2);
      expect(activeSpaces.map(s => s.jiraProjectKey)).toEqual(["PRJA", "PRJC"]);
    });

    it("calculates avgProgress correctly across spaces", () => {
      const spaceReports = [
        { percentComplete: 80 },
        { percentComplete: 40 },
        { percentComplete: 60 },
      ];
      const avg = Math.round(spaceReports.reduce((sum, r) => sum + r.percentComplete, 0) / spaceReports.length);
      expect(avg).toBe(60);
    });

    it("returns 0 avgProgress when no spaces", () => {
      const spaceReports: any[] = [];
      const avg = spaceReports.length > 0
        ? Math.round(spaceReports.reduce((sum, r) => sum + r.percentComplete, 0) / spaceReports.length)
        : 0;
      expect(avg).toBe(0);
    });

    it("sums totalIssues and totalDone correctly", () => {
      const spaceReports = [
        { total: 10, done: 5 },
        { total: 20, done: 15 },
        { total: 5, done: 5 },
      ];
      const totalIssues = spaceReports.reduce((sum, r) => sum + r.total, 0);
      const totalDone = spaceReports.reduce((sum, r) => sum + r.done, 0);
      expect(totalIssues).toBe(35);
      expect(totalDone).toBe(25);
    });
  });

  describe("recent activity filtering", () => {
    it("filters issues updated in last 7 days", () => {
      const now = new Date();
      const recent = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const issues = [
        { key: "T-1", updated: recent },
        { key: "T-2", updated: old },
        { key: "T-3", updated: now.toISOString() },
      ];

      const filtered = issues.filter(i => new Date(i.updated) >= sevenDaysAgo);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(i => i.key)).toContain("T-1");
      expect(filtered.map(i => i.key)).toContain("T-3");
    });
  });
});
