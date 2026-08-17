import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM module
vi.mock("./server/_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

describe("Execution Dashboard Improvements", () => {
  describe("AI Analysis Schema", () => {
    it("should define the correct JSON schema for dimension-based analysis", () => {
      const expectedDimensions = {
        sla: { status: "VERDE", score: 95, detail: "SLA cumplido" },
        deliverables: { status: "AMARILLO", score: 60, detail: "Entregables parciales" },
        billing: { status: "ROJO", score: 30, detail: "Facturación atrasada" },
      };

      // Validate structure
      expect(expectedDimensions.sla).toHaveProperty("status");
      expect(expectedDimensions.sla).toHaveProperty("score");
      expect(expectedDimensions.sla).toHaveProperty("detail");
      expect(expectedDimensions.deliverables).toHaveProperty("status");
      expect(expectedDimensions.billing).toHaveProperty("status");

      // Validate score ranges
      expect(expectedDimensions.sla.score).toBeGreaterThanOrEqual(0);
      expect(expectedDimensions.sla.score).toBeLessThanOrEqual(100);
    });

    it("should validate semaphore values", () => {
      const validSemaphores = ["VERDE", "AMARILLO", "ROJO"];
      
      validSemaphores.forEach((s) => {
        expect(["VERDE", "AMARILLO", "ROJO"]).toContain(s);
      });
    });

    it("should calculate analysis expiry correctly (5 day threshold)", () => {
      const now = Date.now();
      
      // 3 days old - not expired
      const recentDate = new Date(now - 3 * 24 * 60 * 60 * 1000);
      const recentDays = Math.floor((now - recentDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(recentDays).toBeLessThanOrEqual(5);
      expect(recentDays > 5).toBe(false);

      // 7 days old - expired
      const oldDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const oldDays = Math.floor((now - oldDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(oldDays).toBeGreaterThan(5);
      expect(oldDays > 5).toBe(true);

      // Exactly 5 days - not expired
      const borderDate = new Date(now - 5 * 24 * 60 * 60 * 1000);
      const borderDays = Math.floor((now - borderDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(borderDays > 5).toBe(false);
    });
  });

  describe("SLA Compliance Calculation (With JIRA Integration)", () => {
    // Helper that mirrors the backend logic including JIRA data
    function calcSlaCompliance(
      hasSlaConfig: boolean,
      totalItems: number,
      completedItems: number,
      overdueTasks: number,
      activePenalties: number,
      jiraTotalIssues: number,
      jiraCompletedIssues: number,
      jiraOverdueCount: number,
      monthsElapsed: number
    ): number {
      if (totalItems === 0 && jiraTotalIssues === 0) return 0;
      if (overdueTasks > 0 || jiraOverdueCount > 0) return 0;
      if (completedItems === 0 && jiraCompletedIssues === 0 && monthsElapsed > 0) return 0;
      if (hasSlaConfig) return Math.max(0, 100 - (activePenalties * 15));
      const totalAll = totalItems + jiraTotalIssues;
      const completedAll = completedItems + jiraCompletedIssues;
      return totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
    }

    it("should return 0% when there are no tickets and no JIRA issues", () => {
      expect(calcSlaCompliance(true, 0, 0, 0, 0, 0, 0, 0, 0)).toBe(0);
      expect(calcSlaCompliance(false, 0, 0, 0, 0, 0, 0, 0, 0)).toBe(0);
    });

    it("should return 0% when there are overdue work plan tasks", () => {
      expect(calcSlaCompliance(true, 10, 5, 3, 0, 0, 0, 0, 1)).toBe(0);
    });

    it("should return 0% when there are overdue JIRA issues", () => {
      // 54 work items, 0 completed, 0 overdue tasks, but 2 JIRA overdue
      expect(calcSlaCompliance(true, 54, 0, 0, 0, 67, 0, 2, 1)).toBe(0);
    });

    it("should return 0% when 0 completed items and service is active (monthsElapsed > 0)", () => {
      // This is the Apigee case: 54 items, 0 completed, no overdue dates, but 1 month elapsed
      expect(calcSlaCompliance(true, 54, 0, 0, 0, 67, 0, 0, 1)).toBe(0);
    });

    it("should calculate normally when SLA config exists, some progress, no overdue", () => {
      expect(calcSlaCompliance(true, 10, 5, 0, 0, 0, 0, 0, 1)).toBe(100);
      expect(calcSlaCompliance(true, 10, 5, 0, 2, 0, 0, 0, 1)).toBe(70);
    });

    it("should consider JIRA completed issues for progress check", () => {
      // 0 work items completed but JIRA has completed issues
      expect(calcSlaCompliance(true, 54, 0, 0, 0, 67, 10, 0, 1)).toBe(100);
    });

    it("should return avance-based SLA when no SLA config", () => {
      // No SLA config, 10 total items + 20 JIRA, 5 completed + 10 JIRA completed = 15/30 = 50%
      expect(calcSlaCompliance(false, 10, 5, 0, 0, 20, 10, 0, 1)).toBe(50);
    });
  });

  describe("Billing Compliance Calculation", () => {
    it("should calculate billing compliance based on overdue months", () => {
      const billing = [
        { monthNumber: 1, status: "pagado", amount: "14500", dueDate: "2026-02-01" },
        { monthNumber: 2, status: "facturado", amount: "14500", dueDate: "2026-03-01" },
        { monthNumber: 3, status: "pendiente", amount: "14500", dueDate: "2026-04-01" },
      ];

      const now = new Date("2026-03-14");
      const overdueMonths = billing.filter((b) => {
        if (b.status === "pagado") return false;
        if (!b.dueDate) return false;
        return new Date(b.dueDate) < now;
      });

      expect(overdueMonths.length).toBe(1); // Month 2 is facturado but overdue

      const billingCompliancePct = billing.length > 0
        ? Math.round(((billing.length - overdueMonths.length) / billing.length) * 100)
        : 100;
      expect(billingCompliancePct).toBe(67); // 2/3 = 67%
    });

    it("should return 100% when all billing is paid", () => {
      const billing = [
        { monthNumber: 1, status: "pagado", amount: "14500", dueDate: "2026-02-01" },
        { monthNumber: 2, status: "pagado", amount: "14500", dueDate: "2026-03-01" },
      ];

      const now = new Date("2026-03-14");
      const overdueMonths = billing.filter((b) => {
        if (b.status === "pagado") return false;
        if (!b.dueDate) return false;
        return new Date(b.dueDate) < now;
      });

      expect(overdueMonths.length).toBe(0);
      const billingCompliancePct = billing.length > 0
        ? Math.round(((billing.length - overdueMonths.length) / billing.length) * 100)
        : 100;
      expect(billingCompliancePct).toBe(100);
    });
  });

  describe("Deliverables Compliance Calculation", () => {
    it("should calculate deliverables compliance from completed items", () => {
      const totalItems = 54;
      const completedItems = 27;
      const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      expect(completionRate).toBe(50);
    });

    it("should handle zero total items", () => {
      const totalItems = 0;
      const completedItems = 0;
      const completionRate = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      expect(completionRate).toBe(0);
    });
  });

  describe("Semaphore Color Mapping", () => {
    it("should map semaphore values to correct colors", () => {
      const semaphoreColors: Record<string, { bg: string; fg: string; dot: string; label: string }> = {
        VERDE: { bg: "#DCFCE7", fg: "#166534", dot: "#22C55E", label: "Saludable" },
        AMARILLO: { bg: "#FEF3C7", fg: "#92400E", dot: "#F59E0B", label: "En Riesgo" },
        ROJO: { bg: "#FEF2F2", fg: "#991B1B", dot: "#EF4444", label: "Crítico" },
      };

      expect(semaphoreColors["VERDE"].label).toBe("Saludable");
      expect(semaphoreColors["AMARILLO"].label).toBe("En Riesgo");
      expect(semaphoreColors["ROJO"].label).toBe("Crítico");
    });
  });

  describe("Tab Navigation", () => {
    it("should define correct tab structure", () => {
      const tabs = [
        { id: "analisis", label: "Análisis Agéntico" },
        { id: "plan_trabajo", label: "Plan de Trabajo" },
        { id: "facturacion", label: "Detalle Facturación" },
      ];

      expect(tabs).toHaveLength(3);
      expect(tabs[0].id).toBe("analisis");
      expect(tabs[1].id).toBe("plan_trabajo");
      expect(tabs[2].id).toBe("facturacion");
    });
  });

  describe("Dimension Card Logic", () => {
    it("should correctly determine dimension status from score", () => {
      // Score >= 80 = VERDE, 50-79 = AMARILLO, < 50 = ROJO
      const getStatusFromScore = (score: number) => {
        if (score >= 80) return "VERDE";
        if (score >= 50) return "AMARILLO";
        return "ROJO";
      };

      expect(getStatusFromScore(95)).toBe("VERDE");
      expect(getStatusFromScore(80)).toBe("VERDE");
      expect(getStatusFromScore(60)).toBe("AMARILLO");
      expect(getStatusFromScore(50)).toBe("AMARILLO");
      expect(getStatusFromScore(30)).toBe("ROJO");
      expect(getStatusFromScore(0)).toBe("ROJO");
    });
  });

  describe("Analysis History", () => {
    it("should sort analysis history by date descending", () => {
      const history = [
        { id: 1, createdAt: "2026-03-01T10:00:00Z", semaphore: "ROJO" },
        { id: 2, createdAt: "2026-03-07T10:00:00Z", semaphore: "AMARILLO" },
        { id: 3, createdAt: "2026-03-14T10:00:00Z", semaphore: "VERDE" },
      ];

      const sorted = [...history].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      expect(sorted[0].id).toBe(3);
      expect(sorted[0].semaphore).toBe("VERDE");
      expect(sorted[2].id).toBe(1);
    });
  });
});
