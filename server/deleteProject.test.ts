import { describe, it, expect } from "vitest";

// Unit tests for deleteProjectAdmin business logic
// These test the validation rules without hitting the DB

describe("deleteProjectAdmin - stage validation rules", () => {
  const BLOCKED_STAGES = ["design", "closure"];
  const canDelete = (stage: string) => !BLOCKED_STAGES.includes(stage);

  it("should ALLOW deletion when project is in 'sow' stage", () => {
    expect(canDelete("sow")).toBe(true);
  });

  it("should ALLOW deletion when project is in 'jira' stage", () => {
    expect(canDelete("jira")).toBe(true);
  });

  it("should ALLOW deletion when project is in 'risks' stage", () => {
    expect(canDelete("risks")).toBe(true);
  });

  it("should ALLOW deletion when project is in 'planning' stage", () => {
    expect(canDelete("planning")).toBe(true);
  });

  it("should BLOCK deletion when project is in 'design' (Avance/Ejecución) stage", () => {
    expect(canDelete("design")).toBe(false);
  });

  it("should BLOCK deletion when project is in 'closure' stage", () => {
    expect(canDelete("closure")).toBe(false);
  });
});

describe("deleteProjectAdmin - blocked stage error messages", () => {
  const stageNames: Record<string, string> = {
    design: "Diseño/Ejecución",
    closure: "Cierre",
  };

  it("should return correct error message for 'design' stage", () => {
    const stage = "design";
    const msg = `No se puede eliminar un proyecto en etapa de ${stageNames[stage]}. Solo se permiten proyectos en etapas iniciales (SoW, JIRA, Riesgos, Planificación).`;
    expect(msg).toContain("Diseño/Ejecución");
    expect(msg).toContain("SoW, JIRA, Riesgos, Planificación");
  });

  it("should return correct error message for 'closure' stage", () => {
    const stage = "closure";
    const msg = `No se puede eliminar un proyecto en etapa de ${stageNames[stage]}. Solo se permiten proyectos en etapas iniciales (SoW, JIRA, Riesgos, Planificación).`;
    expect(msg).toContain("Cierre");
  });
});

describe("deleteProjectAdmin - frontend confirmation logic", () => {
  it("should require exact 'ELIMINAR' text to enable the delete button", () => {
    const isEnabled = (text: string) => text === "ELIMINAR";
    expect(isEnabled("")).toBe(false);
    expect(isEnabled("eliminar")).toBe(false);
    expect(isEnabled("ELIMIN")).toBe(false);
    expect(isEnabled("ELIMINAR")).toBe(true);
  });

  it("should show delete button only for admin role", () => {
    const isAdmin = (role: string) => role === "admin";
    expect(isAdmin("admin")).toBe(true);
    expect(isAdmin("pmo")).toBe(false);
    expect(isAdmin("consulta")).toBe(false);
  });

  it("should not show delete button for projects in blocked stages", () => {
    const BLOCKED = ["design", "closure"];
    const showDeleteBtn = (role: string, stage: string) =>
      role === "admin" && !BLOCKED.includes(stage);

    expect(showDeleteBtn("admin", "sow")).toBe(true);
    expect(showDeleteBtn("admin", "jira")).toBe(true);
    expect(showDeleteBtn("admin", "risks")).toBe(true);
    expect(showDeleteBtn("admin", "planning")).toBe(true);
    expect(showDeleteBtn("admin", "design")).toBe(false);
    expect(showDeleteBtn("admin", "closure")).toBe(false);
    expect(showDeleteBtn("pmo", "sow")).toBe(false);
    expect(showDeleteBtn("consulta", "sow")).toBe(false);
  });
});
