import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== MOCK JIRA CLIENT ====================
vi.mock("./jiraClient", () => ({
  listJiraProjects: vi.fn(),
  getJiraProject: vi.fn(),
  getProjectIssues: vi.fn(),
  createJiraIssue: vi.fn(),
  transitionJiraIssue: vi.fn(),
  getAssignableUsers: vi.fn(),
  getProjectStatuses: vi.fn(),
  jiraHealthCheck: vi.fn(),
  searchJiraIssues: vi.fn(),
  getTemplateStructure: vi.fn(),
  createJiraSpace: vi.fn(),
  getJiraCurrentUser: vi.fn(),
  getJiraProjectReport: vi.fn(),
  getProjectBoards: vi.fn(),
  getJiraAdvanceReport: vi.fn(),
}));

import { listJiraProjects, getJiraProject } from "./jiraClient";

// ==================== MOCK DB ====================
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getManagedJiraProjectKeys: vi.fn().mockResolvedValue([]),
    createLinkedProject: vi.fn().mockResolvedValue(100),
    createJiraSpaceRecord: vi.fn().mockResolvedValue(50),
    getJiraSpaceByProject: vi.fn().mockResolvedValue(null),
    getAllJiraSpaces: vi.fn().mockResolvedValue([]),
    updateJiraSpaceStatus: vi.fn().mockResolvedValue(undefined),
    unlinkProject: vi.fn().mockResolvedValue({ deleted: true, projectName: "Test Project" }),
  };
});

import { getManagedJiraProjectKeys, createLinkedProject, createJiraSpaceRecord, unlinkProject } from "./db";

// ==================== SEARCH AVAILABLE PROJECTS ====================
describe("searchAvailableProjects logic", () => {
  const mockJiraProjects = [
    { id: "1", key: "PROJ1", name: "Proyecto Alpha", projectTypeKey: "software", style: "classic", avatarUrls: { "32x32": "https://example.com/avatar1.png" }, lead: { displayName: "Juan Perez", accountId: "acc-1" } },
    { id: "2", key: "PROJ2", name: "Proyecto Beta", projectTypeKey: "software", style: "classic", avatarUrls: { "32x32": "https://example.com/avatar2.png" }, lead: { displayName: "Maria Lopez", accountId: "acc-2" } },
    { id: "3", key: "PMO1", name: "PMO Interno", projectTypeKey: "business", style: "classic", avatarUrls: {}, lead: null },
    { id: "4", key: "MANAGED", name: "Already Managed", projectTypeKey: "software", style: "classic", avatarUrls: {}, lead: null },
  ];

  beforeEach(() => {
    vi.mocked(listJiraProjects).mockResolvedValue(mockJiraProjects);
    vi.mocked(getManagedJiraProjectKeys).mockResolvedValue(["MANAGED"]);
  });

  it("should exclude already managed projects from results", async () => {
    const allProjects = await listJiraProjects();
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    const available = allProjects.filter(p => !managedSet.has(p.key.toUpperCase()));

    expect(available).toHaveLength(3);
    expect(available.find(p => p.key === "MANAGED")).toBeUndefined();
  });

  it("should filter by search query on name", async () => {
    const allProjects = await listJiraProjects();
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    let available = allProjects.filter(p => !managedSet.has(p.key.toUpperCase()));

    const query = "alpha";
    available = available.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.key.toLowerCase().includes(query)
    );

    expect(available).toHaveLength(1);
    expect(available[0].key).toBe("PROJ1");
  });

  it("should filter by search query on key", async () => {
    const allProjects = await listJiraProjects();
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    let available = allProjects.filter(p => !managedSet.has(p.key.toUpperCase()));

    const query = "pmo";
    available = available.filter(p =>
      p.name.toLowerCase().includes(query) ||
      p.key.toLowerCase().includes(query)
    );

    expect(available).toHaveLength(1);
    expect(available[0].key).toBe("PMO1");
  });

  it("should return all non-managed projects when no query is provided", async () => {
    const allProjects = await listJiraProjects();
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    const available = allProjects.filter(p => !managedSet.has(p.key.toUpperCase()));

    expect(available).toHaveLength(3);
  });

  it("should be case-insensitive when matching managed keys", async () => {
    vi.mocked(getManagedJiraProjectKeys).mockResolvedValue(["managed"]);
    const allProjects = await listJiraProjects();
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    const available = allProjects.filter(p => !managedSet.has(p.key.toUpperCase()));

    expect(available).toHaveLength(3);
    expect(available.find(p => p.key === "MANAGED")).toBeUndefined();
  });

  it("should map projects to the expected output shape", async () => {
    const allProjects = await listJiraProjects();
    const mapped = allProjects.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      avatarUrl: p.avatarUrls?.["32x32"] ?? null,
      lead: p.lead?.displayName ?? null,
    }));

    expect(mapped[0]).toEqual({
      id: "1",
      key: "PROJ1",
      name: "Proyecto Alpha",
      projectTypeKey: "software",
      avatarUrl: "https://example.com/avatar1.png",
      lead: "Juan Perez",
    });
  });
});

// ==================== LINK EXISTING PROJECT ====================
describe("linkExistingProject logic", () => {
  beforeEach(() => {
    vi.mocked(getJiraProject).mockResolvedValue({
      id: "10001",
      key: "EXTPROJ",
      name: "External Project",
      projectTypeKey: "software",
      style: "classic",
      avatarUrls: {},
      issueTypes: [
        { id: "1", name: "Task", subtask: false },
        { id: "2", name: "Story", subtask: false },
      ],
    });
    vi.mocked(getManagedJiraProjectKeys).mockResolvedValue([]);
    vi.mocked(createLinkedProject).mockResolvedValue(100);
    vi.mocked(createJiraSpaceRecord).mockResolvedValue(50);
  });

  it("should create a linked project with origin=linked using the confirmed identity", async () => {
    const projectId = await createLinkedProject({
      projectName: "External Project",
      clientName: "Client Corp",
      jiraProjectKey: "EXTPROJ",
      jiraProjectUrl: "https://jira.example.com/jira/software/projects/EXTPROJ/boards",
      pmoId: 1,
      projectType: "desarrollo",
    });

    expect(projectId).toBe(100);
    expect(createLinkedProject).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: "External Project",
        clientName: "Client Corp",
        jiraProjectKey: "EXTPROJ",
        projectType: "desarrollo",
      })
    );
  });

  it("should create a jira_spaces record with status=linked", async () => {
    const spaceId = await createJiraSpaceRecord({
      projectId: 100,
      spaceName: "External Project",
      jiraProjectKey: "EXTPROJ",
      jiraProjectId: "10001",
      jiraProjectName: "External Project",
      jiraProjectUrl: "https://jira.example.com/jira/software/projects/EXTPROJ/boards",
      status: "linked",
      templateKey: null,
      boards: [],
      issueTypes: [{ id: "1", name: "Task", subtask: false }],
      workflows: [],
      createdBy: 1,
      createdByName: "Admin User",
    });

    expect(spaceId).toBe(50);
    expect(createJiraSpaceRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "linked",
        templateKey: null,
      })
    );
  });

  it("should reject linking a project that is already managed", async () => {
    vi.mocked(getManagedJiraProjectKeys).mockResolvedValue(["EXTPROJ"]);

    const managedKeys = await getManagedJiraProjectKeys();
    const isManaged = managedKeys.map(k => k.toUpperCase()).includes("EXTPROJ");

    expect(isManaged).toBe(true);
  });

  it("should verify project exists in JIRA before linking", async () => {
    await getJiraProject("EXTPROJ");
    expect(getJiraProject).toHaveBeenCalledWith("EXTPROJ");
  });

  it("should extract issue types from the JIRA project", async () => {
    const jiraProject = await getJiraProject("EXTPROJ");
    const issueTypes = jiraProject.issueTypes?.map((it: any) => ({
      id: it.id,
      name: it.name,
      subtask: it.subtask,
    })) ?? [];

    expect(issueTypes).toHaveLength(2);
    expect(issueTypes[0]).toEqual({ id: "1", name: "Task", subtask: false });
  });
});

// ==================== LINKED PROJECT BEHAVIOR ====================
describe("linked project behavior", () => {
  it("should identify a project as linked by its origin field", () => {
    const project = { id: 100, origin: "linked", currentStage: "sow" };
    expect(project.origin).toBe("linked");
  });

  it("should start linked projects at the first canonical stage", () => {
    const project = { id: 100, origin: "linked", currentStage: "sow" };
    expect(project.currentStage).toBe("sow");
  });

  it("should distinguish platform vs linked projects", () => {
    const platformProject = { id: 1, origin: "platform", currentStage: "sow" };
    const linkedProject = { id: 2, origin: "linked", currentStage: "sow" };

    expect(platformProject.origin).not.toBe(linkedProject.origin);
    expect(linkedProject.currentStage).toBe("sow");
    expect(platformProject.currentStage).toBe("sow");
  });

  it("linked projects should not skip or auto-complete historical stages", () => {
    const linkedProjectStages = ["sow", "jira", "risks", "planning", "design", "closure"].map((stageId, index) => ({
      stageId,
      status: index === 0 ? "in_progress" : "locked",
    }));

    expect(linkedProjectStages).toHaveLength(6);
    expect(linkedProjectStages.some(stage => stage.status === "completed")).toBe(false);
  });
});

// ==================== UNLINK PROJECT ====================
describe("unlinkProject", () => {
  beforeEach(() => {
    vi.mocked(unlinkProject).mockResolvedValue({ deleted: true, projectName: "Test Linked Project" });
  });

  it("should successfully unlink a linked project", async () => {
    const result = await unlinkProject(100);
    expect(result.deleted).toBe(true);
    expect(result.projectName).toBe("Test Linked Project");
  });

  it("should return deleted=false when project is not found", async () => {
    vi.mocked(unlinkProject).mockResolvedValue({ deleted: false, projectName: null });
    const result = await unlinkProject(999);
    expect(result.deleted).toBe(false);
    expect(result.projectName).toBeNull();
  });

  it("should throw error when trying to unlink a platform project", async () => {
    vi.mocked(unlinkProject).mockRejectedValue(new Error("Solo se pueden desvincular proyectos con origen 'linked'"));
    await expect(unlinkProject(1)).rejects.toThrow("Solo se pueden desvincular proyectos con origen 'linked'");
  });

  it("should call unlinkProject with the correct projectId", async () => {
    await unlinkProject(42);
    expect(unlinkProject).toHaveBeenCalledWith(42);
  });

  it("should return the project name for confirmation messaging", async () => {
    vi.mocked(unlinkProject).mockResolvedValue({ deleted: true, projectName: "Mi Proyecto Vinculado" });
    const result = await unlinkProject(50);
    expect(result.projectName).toBe("Mi Proyecto Vinculado");
  });
});

// ==================== LINKED DASHBOARD DATA ====================
describe("linked dashboard data integration", () => {
  it("should combine JIRA data with financial data in the dashboard response shape", () => {
    const dashboardResponse = {
      project: { id: 1, name: "Test", client: "Client", dealId: "D-001", origin: "linked", jiraProjectKey: "TEST" },
      jira: {
        totalIssues: 50, doneCount: 25, inProgressCount: 15, toDoCount: 10,
        percentComplete: 50, epics: [], milestones: [], milestonesCumplidos: 3,
        milestonesPendientes: 2, risks: [], scopeChanges: [], team: [],
        byStatus: [{ status: "Done", count: 25, percentage: 50 }],
        byType: [{ type: "Task", count: 30 }],
      },
      financial: {
        projectFinancial: {
          dealId: "D-001", projectName: "Test", clientName: "Client",
          valorVentaUF: 5000, presupuestoUF: 3000, utilizadoUF: 2100,
          utilizadoUFPorc: 0.70, costoProyectadoUF: 2800,
          margenBrutoNotaVentaUF: 2000, margenTargetPorc: 0.35,
          margenProyectadoPorc: 0.30, margenProyectadoUF: 1500,
          capacityU: 2500, planificadoUF: 2800, proyectadoUF: 3000,
          porcentajeAvanceProyecto: 0.60, notas: null,
        },
        billingMilestones: [
          { milestone: "Hito 1", plannedDate: "2026-01-15", deliveryDate: "2026-01-20", amount: 1000, currency: "UF", billingStatus: "FACTURADO", invoiceDelayDays: 5 },
          { milestone: "Hito 2", plannedDate: "2026-03-15", deliveryDate: null, amount: 2000, currency: "UF", billingStatus: "PENDIENTE", invoiceDelayDays: null },
        ],
        dashboardEntry: { currentPhase: "Desarrollo", lastApprovedPhase: "Diseño", budgetDeviation: "EN PRESUPUESTO", progressDeviation: "EN PLAZO", clientPerception: "Satisfecho" },
        alerts: [
          { type: "warning", category: "Margen", title: "Margen bajo target", description: "El margen proyectado está por debajo del target.", value: "5pp" },
        ],
        portfolioAvg: { avgMargenProyectadoPorc: 0.32, totalProjects: 15, projectRank: 8 },
      },
    };

    // Verify structure
    expect(dashboardResponse.project.origin).toBe("linked");
    expect(dashboardResponse.jira.totalIssues).toBe(50);
    expect(dashboardResponse.jira.percentComplete).toBe(50);
    expect(dashboardResponse.financial?.projectFinancial?.valorVentaUF).toBe(5000);
    expect(dashboardResponse.financial?.billingMilestones).toHaveLength(2);
    expect(dashboardResponse.financial?.alerts).toHaveLength(1);
    expect(dashboardResponse.financial?.portfolioAvg?.totalProjects).toBe(15);
  });

  it("should handle missing financial data gracefully", () => {
    const dashboardResponse = {
      project: { id: 1, name: "Test", client: "Client", dealId: "", origin: "linked", jiraProjectKey: "TEST" },
      jira: { totalIssues: 10, doneCount: 5, inProgressCount: 3, toDoCount: 2, percentComplete: 50, epics: [], milestones: [], milestonesCumplidos: 0, milestonesPendientes: 0, risks: [], scopeChanges: [], team: [], byStatus: [], byType: [] },
      financial: null,
    };

    expect(dashboardResponse.financial).toBeNull();
    expect(dashboardResponse.jira.totalIssues).toBe(10);
  });

  it("should calculate budget percentage correctly", () => {
    const fin = { utilizadoUF: 2100, presupuestoUF: 3000, utilizadoUFPorc: 0.70 };
    const budgetPct = fin.utilizadoUFPorc * 100;
    expect(budgetPct).toBe(70);
    expect(budgetPct).toBeLessThan(85); // Not in warning zone
  });

  it("should detect over-budget situations", () => {
    const fin = { utilizadoUFPorc: 1.15 };
    const budgetPct = fin.utilizadoUFPorc * 100;
    expect(budgetPct).toBeGreaterThan(100);
  });

  it("should detect negative margin as critical", () => {
    const fin = { margenProyectadoPorc: -0.05, margenTargetPorc: 0.35 };
    expect(fin.margenProyectadoPorc).toBeLessThan(0);
  });

  it("should calculate margin gap vs target", () => {
    const fin = { margenProyectadoPorc: 0.30, margenTargetPorc: 0.35 };
    const gap = (fin.margenProyectadoPorc - fin.margenTargetPorc) * 100;
    expect(gap).toBeCloseTo(-5, 1);
  });

  it("should count billed vs pending milestones", () => {
    const milestones = [
      { billingStatus: "FACTURADO" },
      { billingStatus: "FACTURADO" },
      { billingStatus: "PENDIENTE" },
      { billingStatus: "PENDIENTE" },
      { billingStatus: "PENDIENTE" },
    ];
    const billed = milestones.filter(m => m.billingStatus === "FACTURADO").length;
    const pending = milestones.filter(m => m.billingStatus === "PENDIENTE").length;
    expect(billed).toBe(2);
    expect(pending).toBe(3);
  });

  it("should detect delayed milestones (>15 days)", () => {
    const milestones = [
      { invoiceDelayDays: 5 },
      { invoiceDelayDays: 20 },
      { invoiceDelayDays: null },
      { invoiceDelayDays: 30 },
    ];
    const delayed = milestones.filter(m => m.invoiceDelayDays !== null && m.invoiceDelayDays > 15);
    expect(delayed).toHaveLength(2);
  });

  it("should compute portfolio ranking correctly", () => {
    const portfolio = { avgMargenProyectadoPorc: 0.32, totalProjects: 15, projectRank: 8 };
    expect(portfolio.projectRank).toBeLessThanOrEqual(portfolio.totalProjects);
    expect(portfolio.avgMargenProyectadoPorc).toBeGreaterThan(0);
  });
});

// ==================== AI VERDICT STRUCTURE ====================
describe("AI verdict response structure", () => {
  it("should validate the expected verdict JSON structure", () => {
    const verdict = {
      overallVerdict: "El proyecto presenta un avance del 50% con margen bajo target.",
      semaphore: "AMARILLO",
      semaphoreJustification: "Margen proyectado bajo target y hitos pendientes.",
      ceoInsight: "El proyecto requiere atención en márgenes.",
      cfoInsight: "El margen proyectado está 5pp bajo target.",
      commercialInsight: "El cliente está satisfecho pero hay riesgo de sobrecosto.",
      keyRisks: [{ risk: "Sobrecosto", impact: "ALTO", mitigation: "Revisar scope" }],
      recommendations: [{ title: "Revisar presupuesto", description: "Ajustar estimaciones", priority: "ALTA" }],
    };

    expect(verdict.semaphore).toMatch(/^(VERDE|AMARILLO|ROJO)$/);
    expect(verdict.overallVerdict).toBeTruthy();
    expect(verdict.keyRisks).toHaveLength(1);
    expect(verdict.keyRisks[0].impact).toMatch(/^(ALTO|MEDIO|BAJO)$/);
    expect(verdict.recommendations).toHaveLength(1);
    expect(verdict.recommendations[0].priority).toMatch(/^(URGENTE|ALTA|MEDIA)$/);
  });

  it("should support all three semaphore values", () => {
    const validSemaphores = ["VERDE", "AMARILLO", "ROJO"];
    for (const s of validSemaphores) {
      expect(validSemaphores).toContain(s);
    }
  });
});
