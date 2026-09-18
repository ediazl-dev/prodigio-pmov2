import { describe, expect, it } from "vitest";
import {
  DuplicateProjectNameError,
  formatPmoProjectId,
  isProjectNameUniqueConstraintError,
  normalizeProjectName,
} from "../shared/projectIdentity";

describe("project identity", () => {
  it("normaliza espacios exteriores e interiores sin alterar el nombre visible", () => {
    expect(normalizeProjectName("  [PMO]   CCLA SRP MVP1   Deal 4728  ")).toBe(
      "[PMO] CCLA SRP MVP1 Deal 4728"
    );
  });

  it("formatea un identificador interno estable", () => {
    expect(formatPmoProjectId(2670001)).toBe("PMO-2670001");
  });

  it("incluye el identificador existente en el conflicto", () => {
    const error = new DuplicateProjectNameError("Proyecto Alpha", {
      id: 42,
      projectName: "Proyecto Alpha",
      clientName: "Cliente",
      currentStage: "planning",
      status: "activo",
      origin: "platform",
      jiraProjectKey: null,
    });

    expect(error.message).toContain("PMO-42");
    expect(error.message).toContain("planning");
  });

  it("reconoce una colisión del índice único", () => {
    expect(isProjectNameUniqueConstraintError({ code: "ER_DUP_ENTRY" })).toBe(
      true
    );
    expect(
      isProjectNameUniqueConstraintError({
        message: "projects_project_name_unique",
      })
    ).toBe(true);
    expect(isProjectNameUniqueConstraintError(new Error("otro error"))).toBe(
      false
    );
  });
});
