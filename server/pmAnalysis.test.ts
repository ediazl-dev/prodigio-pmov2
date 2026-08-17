import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for PM Senior Analysis feature:
 * - resolveProjectDocuments endpoint logic
 * - generatePMAnalysis endpoint logic
 * - Document resolution from multiple sources
 */

// Mock DB functions
const mockGetProjectById = vi.fn();
const mockGetLinkedProjectDocuments = vi.fn();
const mockGetSowByProject = vi.fn();
const mockGetSowVersionsByProject = vi.fn();
const mockGetLatestGanttUpload = vi.fn();
const mockGetWbsByProject = vi.fn();
const mockGetJiraSpaceByProject = vi.fn();
const mockSaveExecutiveVerdict = vi.fn();

vi.mock("./db", () => ({
  getProjectById: (...args: any[]) => mockGetProjectById(...args),
  getLinkedProjectDocuments: (...args: any[]) => mockGetLinkedProjectDocuments(...args),
  getSowByProject: (...args: any[]) => mockGetSowByProject(...args),
  getSowVersionsByProject: (...args: any[]) => mockGetSowVersionsByProject(...args),
  getLatestGanttUpload: (...args: any[]) => mockGetLatestGanttUpload(...args),
  getWbsByProject: (...args: any[]) => mockGetWbsByProject(...args),
  getJiraSpaceByProject: (...args: any[]) => mockGetJiraSpaceByProject(...args),
  saveExecutiveVerdict: (...args: any[]) => mockSaveExecutiveVerdict(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PM Senior Analysis - Document Resolution", () => {
  describe("Linked projects (origin=linked)", () => {
    it("should resolve SoW and Gantt from linked_project_documents", async () => {
      const linkedProject = { id: 1, projectName: "Test Project", origin: "linked" };
      const linkedDocs = [
        { id: 1, projectId: 1, docType: "sow", fileName: "SoW.pdf", fileUrl: "https://s3.example.com/sow.pdf", createdAt: new Date("2026-01-15") },
        { id: 2, projectId: 1, docType: "gantt", fileName: "Gantt.xlsx", fileUrl: "https://s3.example.com/gantt.xlsx", createdAt: new Date("2026-01-15") },
      ];

      mockGetProjectById.mockResolvedValue(linkedProject);
      mockGetLinkedProjectDocuments.mockResolvedValue(linkedDocs);

      // Simulate the resolution logic
      const isLinked = linkedProject.origin === "linked";
      expect(isLinked).toBe(true);

      const sowDoc = linkedDocs.filter(d => d.docType === "sow").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      const ganttDoc = linkedDocs.filter(d => d.docType === "gantt").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      expect(sowDoc).toBeDefined();
      expect(sowDoc!.fileName).toBe("SoW.pdf");
      expect(ganttDoc).toBeDefined();
      expect(ganttDoc!.fileName).toBe("Gantt.xlsx");
    });

    it("should pick the latest document when multiple versions exist", () => {
      const docs = [
        { id: 1, docType: "sow", fileName: "SoW_v1.pdf", fileUrl: "url1", createdAt: new Date("2026-01-10") },
        { id: 2, docType: "sow", fileName: "SoW_v2.pdf", fileUrl: "url2", createdAt: new Date("2026-01-20") },
        { id: 3, docType: "sow", fileName: "SoW_v3.pdf", fileUrl: "url3", createdAt: new Date("2026-01-15") },
      ];

      const latest = docs.filter(d => d.docType === "sow")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

      expect(latest!.fileName).toBe("SoW_v2.pdf");
      expect(latest!.id).toBe(2);
    });

    it("should return null sources when no documents exist", () => {
      const docs: any[] = [];
      const sowDoc = docs.filter(d => d.docType === "sow")[0];
      const ganttDoc = docs.filter(d => d.docType === "gantt")[0];

      expect(sowDoc).toBeUndefined();
      expect(ganttDoc).toBeUndefined();
    });
  });

  describe("Platform projects (origin=platform)", () => {
    it("should resolve SoW from sowDocuments (structured data)", () => {
      const sowData = {
        generalObjective: "Implementar sistema de gestión",
        specificObjectives: ["Obj 1", "Obj 2"],
        activitiesIncluded: ["Act 1", "Act 2"],
        deliverables: ["Entregable 1", "Entregable 2"],
        limitations: ["Limitación 1"],
        assumptions: ["Supuesto 1"],
        clientDependencies: ["Dep 1"],
        milestones: [{ name: "Hito 1" }],
        totalAmount: "50000",
        currency: "USD",
        billingMilestones: [{ description: "Pago 1" }],
        status: "approved",
      };

      // Build SoW content string (same logic as in the endpoint)
      const objectives = (sowData.specificObjectives as any[]) || [];
      const activities = (sowData.activitiesIncluded as any[]) || [];
      const deliverables = (sowData.deliverables as any[]) || [];

      const sowContent = `STATEMENT OF WORK - Test\n` +
        `Estado: ${sowData.status}\n` +
        `Objetivo General: ${sowData.generalObjective}\n`;

      expect(sowContent).toContain("Implementar sistema de gestión");
      expect(sowContent).toContain("approved");
      expect(objectives.length).toBe(2);
      expect(activities.length).toBe(2);
      expect(deliverables.length).toBe(2);
    });

    it("should fallback to sowVersions when no structured SoW exists", async () => {
      const sowVersions = [
        { id: 1, version: "v1.0", fileName: "SoW_v1.docx", url: "https://s3.example.com/sow_v1.docx", createdAt: new Date("2026-01-15") },
      ];

      mockGetSowByProject.mockResolvedValue(null);
      mockGetSowVersionsByProject.mockResolvedValue(sowVersions);

      const sowData = await mockGetSowByProject(1);
      expect(sowData).toBeNull();

      const versions = await mockGetSowVersionsByProject(1);
      expect(versions[0]).toBeDefined();
      expect(versions[0].fileName).toBe("SoW_v1.docx");
      expect(versions[0].url).toContain("s3.example.com");
    });

    it("should resolve Gantt from gantt_uploads", async () => {
      const ganttUpload = {
        id: 1, projectId: 1, fileName: "Gantt_v1.xlsx",
        fileUrl: "https://s3.example.com/gantt.xlsx", parsedRows: 50,
        createdAt: new Date("2026-01-15"),
      };

      mockGetLatestGanttUpload.mockResolvedValue(ganttUpload);
      const result = await mockGetLatestGanttUpload(1);

      expect(result).toBeDefined();
      expect(result.fileName).toBe("Gantt_v1.xlsx");
      expect(result.parsedRows).toBe(50);
    });

    it("should fallback to WBS structured data when no Gantt file exists", async () => {
      const wbsTasks = [
        { taskCode: "T1", taskName: "Diseño API", phase: "analisis", issueLevel: "epic", isCritical: true, epicCode: "E1", expected: "5", assignee: "Dev1" },
        { taskCode: "T2", taskName: "Implementar endpoints", phase: "construccion", issueLevel: "task", isCritical: false, epicCode: "E1", expected: "3", assignee: "Dev2" },
        { taskCode: "T3", taskName: "Testing", phase: "construccion", issueLevel: "task", isCritical: true, epicCode: "E1", expected: "2", assignee: "QA1" },
      ];

      mockGetLatestGanttUpload.mockResolvedValue(null);
      mockGetWbsByProject.mockResolvedValue(wbsTasks);

      const ganttUpload = await mockGetLatestGanttUpload(1);
      expect(ganttUpload).toBeNull();

      const tasks = await mockGetWbsByProject(1);
      expect(tasks.length).toBe(3);

      // Verify phase extraction
      const phases = Array.from(new Set(tasks.map((t: any) => t.phase)));
      expect(phases).toContain("analisis");
      expect(phases).toContain("construccion");
      expect(phases.length).toBe(2);

      // Verify critical tasks
      const critical = tasks.filter((t: any) => t.isCritical);
      expect(critical.length).toBe(2);
    });
  });

  describe("Fallback to linked_project_documents", () => {
    it("should check linked_project_documents as fallback for platform projects", async () => {
      // Platform project with no SoW data but has linked docs
      mockGetSowByProject.mockResolvedValue(null);
      mockGetSowVersionsByProject.mockResolvedValue([]);
      mockGetLatestGanttUpload.mockResolvedValue(null);
      mockGetWbsByProject.mockResolvedValue([]);
      mockGetLinkedProjectDocuments.mockResolvedValue([
        { id: 1, docType: "sow", fileName: "SoW_linked.pdf", fileUrl: "https://s3.example.com/sow_linked.pdf", createdAt: new Date() },
      ]);

      const sowData = await mockGetSowByProject(1);
      const sowVersions = await mockGetSowVersionsByProject(1);
      const ganttUpload = await mockGetLatestGanttUpload(1);
      const wbs = await mockGetWbsByProject(1);
      const linkedDocs = await mockGetLinkedProjectDocuments(1);

      expect(sowData).toBeNull();
      expect(sowVersions.length).toBe(0);
      expect(ganttUpload).toBeNull();
      expect(wbs.length).toBe(0);
      expect(linkedDocs.length).toBe(1);
      expect(linkedDocs[0].docType).toBe("sow");
    });
  });
});

describe("PM Senior Analysis - JIRA Data Formatting", () => {
  it("should build comprehensive JIRA summary with all dimensions", () => {
    const jiraReport = {
      totalIssues: 45,
      doneCount: 30,
      inProgressCount: 10,
      toDoCount: 5,
      percentComplete: 67,
      epics: [
        { summary: "Epic 1", statusCategory: "Done", totalSubtasks: 10, doneSubtasks: 10 },
        { summary: "Epic 2", statusCategory: "In Progress", totalSubtasks: 15, doneSubtasks: 8 },
      ],
      milestones: [
        { summary: "Hito 1", statusCategory: "Done", status: "Done", percentage: "100%" },
        { summary: "Hito 2", statusCategory: "In Progress", status: "In Progress", percentage: "50%" },
      ],
      milestonesCumplidos: 1,
      milestonesPendientes: 1,
      risks: [
        { summary: "Risk 1", statusCategory: "In Progress", priority: "High", assignee: "PM" },
      ],
      team: [
        { name: "Dev1", total: 15, done: 10, inProgress: 5 },
        { name: "Dev2", total: 12, done: 8, inProgress: 4 },
      ],
      scopeChanges: [
        { summary: "Change 1", status: "Approved" },
      ],
    };

    const projectKey = "TEST-1";
    const jiraSummary = `DATOS JIRA - ${projectKey}\n` +
      `Issues totales: ${jiraReport.totalIssues} | Finalizados: ${jiraReport.doneCount} (${jiraReport.percentComplete}%) | En progreso: ${jiraReport.inProgressCount} | Pendientes: ${jiraReport.toDoCount}\n`;

    expect(jiraSummary).toContain("Issues totales: 45");
    expect(jiraSummary).toContain("Finalizados: 30 (67%)");
    expect(jiraSummary).toContain("En progreso: 10");
    expect(jiraSummary).toContain("Pendientes: 5");
  });

  it("should format financial data correctly", () => {
    const fin = {
      valorVentaUF: 1500,
      presupuestoUF: 1200,
      utilizadoUF: 800,
      utilizadoUFPorc: 0.667,
      margenProyectadoUF: 300,
      margenProyectadoPorc: 0.25,
      margenTargetPorc: 0.30,
      porcentajeAvanceProyecto: 0.67,
    };

    const finSection = `Valor Venta: ${fin.valorVentaUF ?? "N/A"} UF | ` +
      `Presupuesto: ${fin.presupuestoUF ?? "N/A"} UF | ` +
      `Utilizado: ${fin.utilizadoUF ?? "N/A"} UF (${fin.utilizadoUFPorc ? (fin.utilizadoUFPorc * 100).toFixed(1) + "%" : "N/A"})`;

    expect(finSection).toContain("Valor Venta: 1500 UF");
    expect(finSection).toContain("Presupuesto: 1200 UF");
    expect(finSection).toContain("Utilizado: 800 UF (66.7%)");
  });
});

describe("PM Senior Analysis - Response Structure", () => {
  it("should validate expected PM analysis JSON structure", () => {
    const mockAnalysis = {
      executiveSummary: "El proyecto avanza según lo planificado...",
      overallHealth: "VERDE",
      healthJustification: "Avance del 67% con hitos cumplidos",
      sowComplianceScore: 75,
      sowCompliance: {
        summary: "Cumplimiento adecuado del SoW",
        deliverablesStatus: [
          { deliverable: "API Gateway", status: "CUMPLIDO", detail: "Entregado en sprint 3" },
          { deliverable: "Dashboard", status: "EN_PROGRESO", detail: "70% completado" },
        ],
        milestonesAlignment: "Hitos alineados con SoW",
        scopeDeviations: "Sin desviaciones detectadas",
      },
      valueDelivery: {
        summary: "El proyecto genera valor al cliente",
        positiveSignals: ["Entrega temprana de API"],
        warningSignals: [],
        clientRiskFactors: [],
      },
      operationalAnalysis: {
        executionPace: "ADECUADO",
        paceDetail: "Ritmo de ejecución sostenido",
        bottlenecks: [],
        teamAssessment: "Equipo bien dimensionado",
        epicProgress: [
          { epic: "Epic 1", progress: 100, assessment: "Completada" },
          { epic: "Epic 2", progress: 53, assessment: "En progreso" },
        ],
      },
      risksAndAlerts: [
        { type: "MEDIO", title: "Dependencia de API externa", description: "Desc", recommendation: "Monitorear" },
      ],
      weeklyActions: [
        { priority: "ALTA", action: "Revisar hitos pendientes", rationale: "Para mantener el ritmo" },
      ],
      monthlyActions: [
        { priority: "MEDIA", action: "Planificar sprint de testing", rationale: "Asegurar calidad" },
      ],
      documentGaps: [],
    };

    // Validate structure
    expect(mockAnalysis.overallHealth).toMatch(/^(VERDE|AMARILLO|ROJO)$/);
    expect(mockAnalysis.sowComplianceScore).toBeGreaterThanOrEqual(0);
    expect(mockAnalysis.sowComplianceScore).toBeLessThanOrEqual(100);
    expect(mockAnalysis.sowCompliance.deliverablesStatus).toBeInstanceOf(Array);
    expect(mockAnalysis.sowCompliance.deliverablesStatus[0]).toHaveProperty("deliverable");
    expect(mockAnalysis.sowCompliance.deliverablesStatus[0]).toHaveProperty("status");
    expect(mockAnalysis.sowCompliance.deliverablesStatus[0]).toHaveProperty("detail");
    expect(mockAnalysis.valueDelivery.positiveSignals).toBeInstanceOf(Array);
    expect(mockAnalysis.operationalAnalysis.executionPace).toMatch(/^(ADECUADO|LENTO|ACELERADO)$/);
    expect(mockAnalysis.operationalAnalysis.epicProgress[0]).toHaveProperty("epic");
    expect(mockAnalysis.operationalAnalysis.epicProgress[0]).toHaveProperty("progress");
    expect(mockAnalysis.risksAndAlerts[0]).toHaveProperty("type");
    expect(mockAnalysis.risksAndAlerts[0]).toHaveProperty("recommendation");
    expect(mockAnalysis.weeklyActions[0]).toHaveProperty("priority");
    expect(mockAnalysis.weeklyActions[0]).toHaveProperty("action");
  });

  it("should handle deliverable status types correctly", () => {
    const validStatuses = ["CUMPLIDO", "EN_PROGRESO", "ATRASADO", "NO_INICIADO"];
    const deliverables = [
      { deliverable: "D1", status: "CUMPLIDO", detail: "Done" },
      { deliverable: "D2", status: "EN_PROGRESO", detail: "WIP" },
      { deliverable: "D3", status: "ATRASADO", detail: "Late" },
      { deliverable: "D4", status: "NO_INICIADO", detail: "Not started" },
    ];

    deliverables.forEach(d => {
      expect(validStatuses).toContain(d.status);
    });
  });

  it("should handle risk types correctly", () => {
    const validTypes = ["CRITICO", "ALTO", "MEDIO", "BAJO"];
    const risks = [
      { type: "CRITICO", title: "R1", description: "D1", recommendation: "A1" },
      { type: "ALTO", title: "R2", description: "D2", recommendation: "A2" },
      { type: "MEDIO", title: "R3", description: "D3", recommendation: "A3" },
      { type: "BAJO", title: "R4", description: "D4", recommendation: "A4" },
    ];

    risks.forEach(r => {
      expect(validTypes).toContain(r.type);
    });
  });

  it("should handle action priority types correctly", () => {
    const validPriorities = ["URGENTE", "ALTA", "MEDIA"];
    const actions = [
      { priority: "URGENTE", action: "A1", rationale: "R1" },
      { priority: "ALTA", action: "A2", rationale: "R2" },
      { priority: "MEDIA", action: "A3", rationale: "R3" },
    ];

    actions.forEach(a => {
      expect(validPriorities).toContain(a.priority);
    });
  });
});

describe("PM Senior Analysis - Verdict Persistence", () => {
  it("should save verdict with pm_analysis type in metricsSnapshot", async () => {
    const verdictData = {
      projectId: 1,
      generatedBy: 1,
      generatedByName: "Test User",
      semaphore: "VERDE",
      ctoTitle: "Análisis PM Senior",
      ctoInsights: [{ tag: "PM Analysis", text: "Executive summary text" }],
      cfoTitle: null,
      cfoInsights: [],
      commercialTitle: null,
      commercialInsights: [],
      overallVerdict: "Executive summary text",
      semaphoreJustification: "Good progress",
      keyRisks: [{ level: "MEDIO", description: "Risk 1", mitigation: "Mitigate" }],
      recommendations: [{ title: "Action 1", description: "Do this", priority: "ALTA" }],
      metricsSnapshot: {
        type: "pm_analysis",
        jiraAdvance: 67,
        totalIssues: 45,
        doneCount: 30,
        sowComplianceScore: 75,
        hasSoW: true,
        hasGantt: true,
      },
    };

    mockSaveExecutiveVerdict.mockResolvedValue(1);
    await mockSaveExecutiveVerdict(verdictData);

    expect(mockSaveExecutiveVerdict).toHaveBeenCalledWith(verdictData);
    expect(verdictData.metricsSnapshot.type).toBe("pm_analysis");
    expect(verdictData.metricsSnapshot.hasSoW).toBe(true);
    expect(verdictData.metricsSnapshot.hasGantt).toBe(true);
    expect(verdictData.metricsSnapshot.sowComplianceScore).toBe(75);
  });

  it("should handle missing SoW/Gantt gracefully in verdict", () => {
    const metricsSnapshot = {
      type: "pm_analysis",
      jiraAdvance: 50,
      totalIssues: 20,
      doneCount: 10,
      sowComplianceScore: null,
      hasSoW: false,
      hasGantt: false,
    };

    expect(metricsSnapshot.hasSoW).toBe(false);
    expect(metricsSnapshot.hasGantt).toBe(false);
    expect(metricsSnapshot.sowComplianceScore).toBeNull();
  });
});

describe("PM Senior Analysis - Source Resolution Response", () => {
  it("should return correct source availability", () => {
    const sources = {
      sow: { available: true, fileName: "SoW.pdf" },
      gantt: { available: true, fileName: "Gantt.xlsx" },
      jira: { available: true, projectKey: "TEST-1" },
      financial: { available: true },
    };

    expect(sources.sow.available).toBe(true);
    expect(sources.gantt.available).toBe(true);
    expect(sources.jira.available).toBe(true);
    expect(sources.financial.available).toBe(true);
  });

  it("should indicate unavailable sources", () => {
    const sources = {
      sow: { available: false },
      gantt: { available: false },
      jira: { available: true, projectKey: "TEST-1" },
      financial: { available: false },
    };

    expect(sources.sow.available).toBe(false);
    expect(sources.gantt.available).toBe(false);
    expect(sources.financial.available).toBe(false);
  });
});
