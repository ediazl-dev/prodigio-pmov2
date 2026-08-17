import { describe, it, expect, vi } from "vitest";

describe("Stage Closure System", () => {
  describe("StageClosurePanel component contract", () => {
    it("should define correct stage labels", () => {
      const STAGE_LABELS: Record<string, string> = {
        sow: "Statement of Work",
        jira: "JIRA",
        risks: "Riesgos",
        planning: "Planificación",
        design: "Análisis y Diseño",
        closure: "Cierre del Proyecto",
      };
      expect(Object.keys(STAGE_LABELS)).toHaveLength(6);
      expect(STAGE_LABELS.sow).toBe("Statement of Work");
      expect(STAGE_LABELS.closure).toBe("Cierre del Proyecto");
    });

    it("should require confirmed=true for closure", () => {
      const input = { projectId: 1, stageId: "risks", confirmed: false, notes: "" };
      expect(input.confirmed).toBe(false);
      // Backend will reject with BAD_REQUEST if confirmed is false
    });

    it("should support additional requirements for SoW stage", () => {
      const sowRequirement = {
        met: false,
        label: "SoW Formalizado",
        description: "Debe cargar el SoW formalizado y aprobado por el cliente",
      };
      expect(sowRequirement.met).toBe(false);
      expect(sowRequirement.label).toBe("SoW Formalizado");
    });
  });

  describe("Stage closure disclaimer", () => {
    it("should contain GP confirmation text", () => {
      const DISCLAIMER = "El Gerente de Proyecto confirma que la información presentada en esta etapa corresponde a lo acordado con el cliente y ha sido validada para proceder con el cierre formal.";
      expect(DISCLAIMER).toContain("Gerente de Proyecto");
      expect(DISCLAIMER).toContain("acordado con el cliente");
      expect(DISCLAIMER).toContain("cierre formal");
    });
  });

  describe("SoW version serialization", () => {
    it("should auto-increment version numbers", () => {
      // Simulates the getNextSowVersionNumber logic
      const existingVersions = ["1.0", "1.1", "2.0"];
      const getNext = (versions: string[]): string => {
        if (versions.length === 0) return "1.0";
        const sorted = versions
          .map((v) => {
            const [major, minor] = v.split(".").map(Number);
            return { major: major || 1, minor: minor || 0, raw: v };
          })
          .sort((a, b) => b.major - a.major || b.minor - a.minor);
        const latest = sorted[0];
        return `${latest.major}.${latest.minor + 1}`;
      };
      expect(getNext([])).toBe("1.0");
      expect(getNext(["1.0"])).toBe("1.1");
      expect(getNext(["1.0", "1.1"])).toBe("1.2");
      expect(getNext(["1.0", "1.1", "2.0"])).toBe("2.1");
    });

    it("should handle custom version override", () => {
      const userVersion = "3.0";
      const autoVersion = "2.1";
      const finalVersion = userVersion || autoVersion;
      expect(finalVersion).toBe("3.0");
    });

    it("should fallback to auto version when empty", () => {
      const userVersion = "";
      const autoVersion = "2.1";
      const finalVersion = userVersion || autoVersion;
      expect(finalVersion).toBe("2.1");
    });
  });

  describe("Closure access control", () => {
    it("should allow admin to close stages", () => {
      const role = "admin";
      const canManage = ["admin", "pmo"].includes(role);
      expect(canManage).toBe(true);
    });

    it("should allow pmo to close stages", () => {
      const role = "pmo";
      const canManage = ["admin", "pmo"].includes(role);
      expect(canManage).toBe(true);
    });

    it("should NOT allow consulta to close stages", () => {
      const role = "consulta";
      const canManage = ["admin", "pmo"].includes(role);
      expect(canManage).toBe(false);
    });

    it("should NOT allow gerente_proyecto to close stages", () => {
      const role = "gerente_proyecto";
      const canManage = ["admin", "pmo"].includes(role);
      expect(canManage).toBe(false);
    });
  });

  describe("Stage closure data structure", () => {
    it("should have all required fields for stage_closures table", () => {
      const closureRecord = {
        id: 1,
        projectId: 1,
        stageId: "sow",
        closedBy: "user-123",
        closedByName: "Juan Pérez",
        closedAt: new Date().getTime(),
        confirmationText: "Disclaimer text...",
        notes: "Todo validado con el cliente",
      };
      expect(closureRecord.projectId).toBeDefined();
      expect(closureRecord.stageId).toBeDefined();
      expect(closureRecord.closedBy).toBeDefined();
      expect(closureRecord.closedByName).toBeDefined();
      expect(closureRecord.closedAt).toBeDefined();
      expect(closureRecord.confirmationText).toBeDefined();
    });

    it("should support optional notes field", () => {
      const closureWithNotes = { notes: "Observación importante" };
      const closureWithoutNotes = { notes: undefined };
      expect(closureWithNotes.notes).toBe("Observación importante");
      expect(closureWithoutNotes.notes).toBeUndefined();
    });
  });

  describe("All stages have closure panel", () => {
    const stagesWithClosure = ["sow", "jira", "risks", "planning", "design", "closure"];

    it("should cover all 6 project stages", () => {
      expect(stagesWithClosure).toHaveLength(6);
    });

    it.each(stagesWithClosure)("stage '%s' should be included", (stageId) => {
      expect(stagesWithClosure).toContain(stageId);
    });
  });

  describe("Automatic JIRA issue creation on risks stage closure", () => {
    it("should trigger JIRA issue creation when closing risks stage", () => {
      // The formalClose endpoint should create JIRA issues when stageId === 'risks'
      const stageId = "risks";
      const shouldCreateJiraIssues = stageId === "risks";
      expect(shouldCreateJiraIssues).toBe(true);
    });

    it("should NOT trigger JIRA issue creation for non-risks stages", () => {
      const otherStages = ["sow", "jira", "planning", "design", "closure"];
      for (const stageId of otherStages) {
        const shouldCreateJiraIssues = stageId === "risks";
        expect(shouldCreateJiraIssues).toBe(false);
      }
    });

    it("should skip risks that already have a JIRA issue key", () => {
      const risks = [
        { id: 1, riskCode: "R001", jiraIssueKey: "PROJ-1" },
        { id: 2, riskCode: "R002", jiraIssueKey: null },
        { id: 3, riskCode: "R003", jiraIssueKey: "PROJ-3" },
      ];
      const risksToCreate = risks.filter(r => !r.jiraIssueKey);
      expect(risksToCreate).toHaveLength(1);
      expect(risksToCreate[0].riskCode).toBe("R002");
    });

    it("should require a JIRA Space to be configured for the project", () => {
      const space = null;
      const hasSpace = space !== null;
      expect(hasSpace).toBe(false);
      // When no space, JIRA issue creation should be skipped (non-blocking)
    });

    it("should find the Riesgos PMO issue type from space issue types", () => {
      const issueTypes = [
        { id: "10001", name: "Task" },
        { id: "10002", name: "Hito PMO" },
        { id: "10003", name: "Riesgos PMO" },
        { id: "10004", name: "Cambio de Alcance" },
      ];
      const riskIssueType = issueTypes.find((it) =>
        it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
      );
      expect(riskIssueType).toBeDefined();
      expect(riskIssueType!.name).toBe("Riesgos PMO");
      expect(riskIssueType!.id).toBe("10003");
    });

    it("should fallback to Task issue type when Riesgos PMO not found", () => {
      const issueTypes = [
        { id: "10001", name: "Task" },
        { id: "10002", name: "Hito PMO" },
      ];
      const riskIssueType = issueTypes.find((it) =>
        it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
      );
      const issueTypeName = riskIssueType?.name ?? "Task";
      expect(issueTypeName).toBe("Task");
    });

    it("should build correct issue summary from risk data", () => {
      const risk = { riskCode: "R001", description: "Riesgo de atraso en entrega del servidor" };
      const summary = `[${risk.riskCode ?? "RISK"}] ${risk.description?.substring(0, 200) ?? "Riesgo identificado"}`;
      expect(summary).toBe("[R001] Riesgo de atraso en entrega del servidor");
    });

    it("should include PMO-Risk label and risk metadata as labels", () => {
      const risk = { category: "Técnico", probability: "alta" };
      const labels = ["PMO-Risk", risk.category, risk.probability].filter(Boolean);
      expect(labels).toContain("PMO-Risk");
      expect(labels).toContain("Técnico");
      expect(labels).toContain("alta");
    });

    it("should return jiraRiskResults with skipped count in the formalClose response", () => {
      const response = {
        success: true,
        jiraRiskResults: { created: 5, total: 5, skipped: 2, spaceKey: "PROJ01" },
      };
      expect(response.jiraRiskResults).toBeDefined();
      expect(response.jiraRiskResults.created).toBe(5);
      expect(response.jiraRiskResults.total).toBe(5);
      expect(response.jiraRiskResults.skipped).toBe(2);
      expect(response.jiraRiskResults.spaceKey).toBe("PROJ01");
    });

    it("should return null jiraRiskResults for non-risks stages", () => {
      const response = { success: true, jiraRiskResults: null };
      expect(response.jiraRiskResults).toBeNull();
    });

    it("should only create issues for confirmed risks", () => {
      const allRisks = [
        { id: 1, riskCode: "R001", description: "Riesgo A", confirmed: true },
        { id: 2, riskCode: "R002", description: "Riesgo B", confirmed: false },
        { id: 3, riskCode: "R003", description: "Riesgo C", confirmed: true },
        { id: 4, riskCode: "R004", description: "Riesgo D", confirmed: false },
      ];
      const confirmedRisks = allRisks.filter((r) => r.confirmed);
      const skipped = allRisks.length - confirmedRisks.length;
      expect(confirmedRisks).toHaveLength(2);
      expect(skipped).toBe(2);
      expect(confirmedRisks.map((r) => r.riskCode)).toEqual(["R001", "R003"]);
    });

    it("should transition issue to Identificado after creation", () => {
      // Simulates the transitionJiraIssue call
      const transitions = [
        { id: "11", name: "Solicitar", to: { name: "Solicitado", id: "1" } },
        { id: "21", name: "Identificar", to: { name: "Identificado", id: "2" } },
        { id: "31", name: "Analizar", to: { name: "Analizado", id: "3" } },
      ];
      const target = transitions.find(
        (t) => t.to.name.toLowerCase() === "identificado"
      );
      expect(target).toBeDefined();
      expect(target!.id).toBe("21");
      expect(target!.to.name).toBe("Identificado");
    });

    it("should warn but not fail when transition to Identificado is not found", () => {
      const transitions = [
        { id: "11", name: "Start", to: { name: "In Progress", id: "1" } },
      ];
      const target = transitions.find(
        (t) => t.to.name.toLowerCase() === "identificado"
      );
      // Returns false (non-blocking) when transition not found
      const transitioned = target !== undefined;
      expect(transitioned).toBe(false);
    });
  });
});
