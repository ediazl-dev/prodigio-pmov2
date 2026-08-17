/**
 * Tests for PPDC HIBRIDO corporate configuration in JIRA Space creation
 * Iteration 25: Category, Owner, Schemas, Boards
 */
import { describe, it, expect } from "vitest";
import { PPDC_CONFIG } from "./jiraClient";

describe("PPDC_CONFIG - Corporate JIRA Configuration", () => {
  it("should have the correct category ID and name", () => {
    expect(PPDC_CONFIG.categoryId).toBe("10014");
    expect(PPDC_CONFIG.categoryName).toBe("PPDC HIBRIDO");
  });

  it("should have the correct owner account", () => {
    expect(PPDC_CONFIG.ownerAccountId).toBe("5c97e53641803d601d7a09a9");
    expect(PPDC_CONFIG.ownerName).toContain("Eugenio Diaz");
  });

  it("should have the correct Issue Type Scheme", () => {
    expect(PPDC_CONFIG.issueTypeSchemeId).toBe("12530");
    expect(PPDC_CONFIG.issueTypeSchemeName).toContain("PPDC");
    expect(PPDC_CONFIG.issueTypeSchemeName).toContain("Issue Type Scheme");
  });

  it("should have the correct Workflow Scheme", () => {
    expect(PPDC_CONFIG.workflowSchemeId).toBe("11742");
    expect(PPDC_CONFIG.workflowSchemeName).toContain("PPDC");
    expect(PPDC_CONFIG.workflowSchemeName).toContain("Workflow Scheme");
  });

  it("should have the correct Screen Scheme", () => {
    expect(PPDC_CONFIG.screenSchemeId).toBe("11509");
    expect(PPDC_CONFIG.screenSchemeName).toContain("PPDC");
    expect(PPDC_CONFIG.screenSchemeName).toContain("Screen Scheme");
  });

  it("should have the correct Notification Scheme", () => {
    expect(PPDC_CONFIG.notificationSchemeId).toBe("10000");
    expect(PPDC_CONFIG.notificationSchemeName).toContain("Default Notification");
  });

  it("should reference the correct project template", () => {
    expect(PPDC_CONFIG.referenceProjectKey).toBe("PRPMTD1");
    expect(PPDC_CONFIG.referenceProjectName).toContain("Modernización TI");
  });

  it("should have exactly 5 PMO boards", () => {
    expect(PPDC_CONFIG.pmoBoards).toHaveLength(5);
  });

  it("should include all required PMO boards", () => {
    const boardNames = PPDC_CONFIG.pmoBoards.map(b => b.name);
    expect(boardNames).toContain("Gestion PMI");
    expect(boardNames).toContain("Tablero Hito PMO");
    expect(boardNames).toContain("Tablero Riesgos PMO");
    expect(boardNames).toContain("Tablero Cambio de Alcance");
    expect(boardNames).toContain("Tablero Proyecto PMO - Avance");
  });

  it("should have all boards as kanban type", () => {
    for (const board of PPDC_CONFIG.pmoBoards) {
      expect(board.type).toBe("kanban");
    }
  });

  it("should have jqlTemplate for each board", () => {
    for (const board of PPDC_CONFIG.pmoBoards) {
      expect(board.jqlTemplate).toBeDefined();
      expect(board.jqlTemplate).toContain("{KEY}");
    }
  });

  it("should have correct JQL for Gestion PMI (Task/Sub-task/Epic/Story)", () => {
    const board = PPDC_CONFIG.pmoBoards.find(b => b.name === "Gestion PMI");
    expect(board?.jqlTemplate).toContain("Task");
    expect(board?.jqlTemplate).toContain("Sub-task");
    expect(board?.jqlTemplate).toContain("Epic");
    expect(board?.jqlTemplate).toContain("Story");
  });

  it("should have correct JQL for Tablero Riesgos PMO", () => {
    const board = PPDC_CONFIG.pmoBoards.find(b => b.name === "Tablero Riesgos PMO");
    expect(board?.jqlTemplate).toContain("Riesgos PMO");
  });

  it("should have correct JQL for Tablero Hito PMO", () => {
    const board = PPDC_CONFIG.pmoBoards.find(b => b.name === "Tablero Hito PMO");
    expect(board?.jqlTemplate).toContain("Hito PMO");
  });

  it("should resolve jqlTemplate placeholder correctly", () => {
    const board = PPDC_CONFIG.pmoBoards[0];
    const resolved = board.jqlTemplate.replace(/\{KEY\}/g, "TESTPRJ");
    expect(resolved).toContain("TESTPRJ");
    expect(resolved).not.toContain("{KEY}");
  });

  it("should have all required schema IDs as strings", () => {
    expect(typeof PPDC_CONFIG.categoryId).toBe("string");
    expect(typeof PPDC_CONFIG.issueTypeSchemeId).toBe("string");
    expect(typeof PPDC_CONFIG.workflowSchemeId).toBe("string");
    expect(typeof PPDC_CONFIG.screenSchemeId).toBe("string");
    expect(typeof PPDC_CONFIG.notificationSchemeId).toBe("string");
  });

  it("should have numeric-parseable schema IDs", () => {
    expect(Number.isInteger(parseInt(PPDC_CONFIG.categoryId))).toBe(true);
    expect(Number.isInteger(parseInt(PPDC_CONFIG.issueTypeSchemeId))).toBe(true);
    expect(Number.isInteger(parseInt(PPDC_CONFIG.workflowSchemeId))).toBe(true);
    expect(Number.isInteger(parseInt(PPDC_CONFIG.screenSchemeId))).toBe(true);
    expect(Number.isInteger(parseInt(PPDC_CONFIG.notificationSchemeId))).toBe(true);
  });
});
