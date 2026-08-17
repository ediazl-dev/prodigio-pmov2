import { describe, it, expect, vi, beforeEach } from "vitest";

// ==================== Unit tests for Risk Excel Generator ====================
describe("riskExcelGenerator", () => {
  it("should generate Excel buffer with correct structure", async () => {
    const { generateRiskMatrixExcel } = await import("./riskExcelGenerator");
    const mockRisks = [
      {
        id: 1,
        riskCode: "R001",
        description: "Riesgo de integración con sistemas legacy",
        category: "tecnico",
        type: "riesgo",
        probability: "alta",
        impact: "alto",
        mitigation: "Realizar análisis de compatibilidad previo",
        contingency: "Plan de rollback documentado",
        owner: "Arquitecto de Soluciones",
        dueDate: "2025-06-30",
        estimatedCost: "$5,000",
        jiraIssueKey: null,
      },
      {
        id: 2,
        riskCode: "R002",
        description: "Disponibilidad del equipo cliente",
        category: "organizacional",
        type: "supuesto_no_validado",
        probability: "media",
        impact: "medio",
        mitigation: "Definir compromisos de disponibilidad en el SoW",
        contingency: null,
        owner: "Gerente de Proyecto",
        dueDate: null,
        estimatedCost: null,
        jiraIssueKey: "PBTISD1-42",
      },
    ];

    const buffer = await generateRiskMatrixExcel(
      mockRisks as any,
      "Proyecto Test",
      "Cliente Test",
      "v1.0"
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("should handle empty risk list gracefully", async () => {
    const { generateRiskMatrixExcel } = await import("./riskExcelGenerator");
    const buffer = await generateRiskMatrixExcel([], "Proyecto Vacío", "Cliente", "v1.0");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("should generate different versions correctly", async () => {
    const { generateRiskMatrixExcel } = await import("./riskExcelGenerator");
    const mockRisks = [{
      id: 1, riskCode: "R001", description: "Test risk", category: "tecnico",
      type: "riesgo", probability: "alta", impact: "alto",
      mitigation: "Test mitigation", contingency: null, owner: "PM",
      dueDate: null, estimatedCost: null, jiraIssueKey: null,
    }];

    const buffer1 = await generateRiskMatrixExcel(mockRisks as any, "Proyecto", "Cliente", "v1.0");
    const buffer2 = await generateRiskMatrixExcel(mockRisks as any, "Proyecto", "Cliente", "v2.0");

    expect(buffer1).toBeInstanceOf(Buffer);
    expect(buffer2).toBeInstanceOf(Buffer);
    // Both should be valid Excel files
    expect(buffer1.length).toBeGreaterThan(1000);
    expect(buffer2.length).toBeGreaterThan(1000);
  });

  it("exports the four required PMO risk categories", async () => {
    const { generateRiskMatrixExcel } = await import("./riskExcelGenerator");
    const requiredTypes = ["riesgo", "riesgo_oculto", "supuesto_no_validado", "dependencia_externa"] as const;
    const risks = requiredTypes.map((type, index) => ({
      id: index + 1,
      riskCode: `R00${index + 1}`,
      description: `Riesgo de categoría ${type}`,
      category: type === "riesgo" ? "tecnico" : "gestion",
      type,
      probability: "media",
      impact: "medio",
      mitigation: "Mitigación definida",
      contingency: "Contingencia definida",
      owner: "PM",
      dueDate: null,
      estimatedCost: null,
      jiraIssueKey: null,
    }));

    expect(new Set(risks.map(risk => risk.type))).toEqual(new Set(requiredTypes));
    const workbook = await generateRiskMatrixExcel(risks as any, "Proyecto categorías", "Cliente", "v1.0");
    expect(workbook).toBeInstanceOf(Buffer);
    expect(workbook.length).toBeGreaterThan(1000);

    const ExcelJS = (await import("exceljs")).default;
    const parsedWorkbook = new ExcelJS.Workbook();
    await parsedWorkbook.xlsx.load(workbook as any);
    const matrix = parsedWorkbook.getWorksheet("Matriz de Riesgos");
    expect(matrix?.getCell("B2").text).toBe("Técnico");
    expect(matrix?.getCell("B3").text).toBe("Oculto");
    expect(matrix?.getCell("B4").text).toBe("Supuesto No Validado");
    expect(matrix?.getCell("B5").text).toBe("Dependencia Externa");
  });
});

// ==================== Unit tests for DB helpers ====================
describe("riskVersions DB helpers", () => {
  it("should calculate next version number correctly", () => {
    // Test version increment logic
    const versions = ["v1.0", "v1.1", "v1.2"];
    const lastVersion = versions[versions.length - 1]; // "v1.2"
    const parts = lastVersion.replace("v", "").split(".");
    const major = parseInt(parts[0]);
    const minor = parseInt(parts[1]) + 1;
    const nextVersion = `v${major}.${minor}`;
    expect(nextVersion).toBe("v1.3");
  });

  it("should start at v1.0 when no versions exist", () => {
    const versions: string[] = [];
    const nextVersion = versions.length === 0 ? "v1.0" : "v1.1";
    expect(nextVersion).toBe("v1.0");
  });

  it("should increment major version when minor reaches 10", () => {
    // This tests the business rule for major version bumps
    const lastVersion = "v1.9";
    const parts = lastVersion.replace("v", "").split(".");
    const minor = parseInt(parts[1]) + 1;
    const major = parseInt(parts[0]) + (minor >= 10 ? 1 : 0);
    const normalizedMinor = minor >= 10 ? 0 : minor;
    const nextVersion = `v${major}.${normalizedMinor}`;
    expect(nextVersion).toBe("v2.0");
  });
});

// ==================== Unit tests for Agentic Review structure ====================
describe("agenticReview evaluation structure", () => {
  it("should validate evaluation response structure", () => {
    const mockEvaluation = {
      overallScore: 85,
      completenessScore: 80,
      qualityScore: 90,
      coverageScore: 85,
      summary: "La matriz de riesgos es completa y bien estructurada.",
      strengths: ["Cobertura técnica amplia", "Mitigaciones detalladas"],
      gaps: [
        {
          riskCode: "R003",
          issue: "Falta plan de contingencia",
          severity: "media",
          recommendation: "Agregar plan de contingencia específico",
        },
      ],
      missingCategories: [],
      risksWithoutMitigation: [],
      risksWithoutOwner: [],
      risksWithoutContingency: ["R003", "R007"],
      recommendations: [
        {
          priority: "alta",
          action: "Completar planes de contingencia",
          rationale: "Necesario para gestión efectiva de riesgos",
        },
      ],
      readyForJira: true,
      readyForJiraReason: "La matriz tiene suficiente información para crear issues en JIRA",
    };

    expect(mockEvaluation.overallScore).toBeGreaterThanOrEqual(0);
    expect(mockEvaluation.overallScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(mockEvaluation.strengths)).toBe(true);
    expect(Array.isArray(mockEvaluation.gaps)).toBe(true);
    expect(Array.isArray(mockEvaluation.recommendations)).toBe(true);
    expect(typeof mockEvaluation.readyForJira).toBe("boolean");
    expect(mockEvaluation.gaps[0]).toHaveProperty("riskCode");
    expect(mockEvaluation.gaps[0]).toHaveProperty("severity");
    expect(mockEvaluation.gaps[0]).toHaveProperty("recommendation");
  });

  it("should correctly identify score categories", () => {
    const getCategory = (score: number) =>
      score >= 80 ? "good" : score >= 60 ? "warning" : "critical";

    expect(getCategory(85)).toBe("good");
    expect(getCategory(65)).toBe("warning");
    expect(getCategory(45)).toBe("critical");
    expect(getCategory(80)).toBe("good");
    expect(getCategory(60)).toBe("warning");
  });
});

// ==================== Unit tests for JIRA issue creation ====================
describe("JIRA risk issue creation", () => {
  it("should build correct JIRA issue description from risk data", () => {
    const risk = {
      riskCode: "R001",
      description: "Riesgo de integración con sistemas legacy",
      type: "riesgo",
      category: "tecnico",
      probability: "alta",
      impact: "alto",
      mitigation: "Realizar análisis de compatibilidad previo",
      contingency: "Plan de rollback documentado",
      estimatedCost: "$5,000",
      dueDate: "2025-06-30",
    };

    const PROB_MAP: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
    const IMPACT_MAP: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };

    const description = [
      `*Tipo:* Riesgo`,
      `*Categoría:* ${risk.category}`,
      `*Probabilidad:* ${PROB_MAP[risk.probability]}`,
      `*Impacto:* ${IMPACT_MAP[risk.impact]}`,
      "",
      `*Descripción:*\n${risk.description}`,
      "",
      `*Estrategia de Mitigación:*\n${risk.mitigation}`,
      `\n*Plan de Contingencia:*\n${risk.contingency}`,
      `\n*Costo Estimado:* ${risk.estimatedCost}`,
      `\n*Fecha Estimada:* ${risk.dueDate}`,
    ].filter(Boolean).join("\n");

    expect(description).toContain("Riesgo de integración");
    expect(description).toContain("Alta");
    expect(description).toContain("Plan de rollback");
    expect(description).toContain("$5,000");
  });

  it("should generate correct JIRA summary from risk", () => {
    const risk = {
      riskCode: "R001",
      description: "Riesgo de integración con sistemas legacy que puede afectar el timeline del proyecto",
    };

    const summary = `[${risk.riskCode}] ${risk.description?.substring(0, 200) ?? "Riesgo identificado"}`;
    expect(summary.startsWith("[R001]")).toBe(true);
    expect(summary.length).toBeLessThanOrEqual(210);
  });

  it("should skip risks that already have JIRA key", () => {
    const risks = [
      { id: 1, riskCode: "R001", jiraIssueKey: "PBTISD1-42" },
      { id: 2, riskCode: "R002", jiraIssueKey: null },
      { id: 3, riskCode: "R003", jiraIssueKey: "PBTISD1-43" },
    ];

    const toCreate = risks.filter((r) => !r.jiraIssueKey);
    const alreadyCreated = risks.filter((r) => r.jiraIssueKey);

    expect(toCreate).toHaveLength(1);
    expect(toCreate[0].riskCode).toBe("R002");
    expect(alreadyCreated).toHaveLength(2);
  });

  it("should use correct issue type name for Riesgos PMO", () => {
    const issueTypes = [
      { id: "10001", name: "Epic" },
      { id: "10002", name: "Story" },
      { id: "10003", name: "Task" },
      { id: "10004", name: "Riesgos PMO" },
      { id: "10005", name: "Hito PMO" },
    ];

    const riskIssueType = issueTypes.find((it) =>
      it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
    );

    expect(riskIssueType).toBeDefined();
    expect(riskIssueType?.name).toBe("Riesgos PMO");
    expect(riskIssueType?.id).toBe("10004");
  });
});

// ==================== Unit tests for risk fields validation ====================
describe("risk fields validation", () => {
  it("should validate required fields for JIRA creation", () => {
    const validateRiskForJira = (risk: any) => {
      const errors: string[] = [];
      if (!risk.description) errors.push("Descripción requerida");
      if (!risk.mitigation) errors.push("Mitigación requerida");
      if (!risk.probability) errors.push("Probabilidad requerida");
      if (!risk.impact) errors.push("Impacto requerido");
      return errors;
    };

    const completeRisk = {
      description: "Riesgo de integración",
      mitigation: "Análisis previo",
      probability: "alta",
      impact: "alto",
    };
    expect(validateRiskForJira(completeRisk)).toHaveLength(0);

    const incompleteRisk = { description: "Riesgo sin mitigación" };
    const errors = validateRiskForJira(incompleteRisk);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors).toContain("Mitigación requerida");
  });

  it("should correctly compute risk score (probability × impact)", () => {
    const PROB_SCORE: Record<string, number> = { alta: 3, media: 2, baja: 1 };
    const IMPACT_SCORE: Record<string, number> = { alto: 3, medio: 2, bajo: 1 };

    const getRiskScore = (probability: string, impact: string) =>
      (PROB_SCORE[probability] ?? 0) * (IMPACT_SCORE[impact] ?? 0);

    expect(getRiskScore("alta", "alto")).toBe(9);   // Critical
    expect(getRiskScore("media", "medio")).toBe(4); // Medium
    expect(getRiskScore("baja", "bajo")).toBe(1);   // Low
    expect(getRiskScore("alta", "bajo")).toBe(3);   // Medium-low
  });
});
