import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../scripts/backfillDocumentGovernance.ts", import.meta.url), "utf8");

describe("document governance legacy backfill", () => {
  it("es dry-run por defecto y requiere --apply para escribir", () => {
    expect(source).toContain('process.argv.includes("--apply")');
    expect(source).toContain('mode: APPLY ? "apply" : "dry-run"');
    expect(source).toContain("if (!APPLY)");
  });

  it("mapea los cuatro tipos recurrentes requeridos sin interpretar otro", () => {
    expect(source).toContain('docType === "contrato"');
    expect(source).toContain('docType === "sow"');
    expect(source).toContain('docType === "propuesta_tecnica"');
    expect(source).toContain('docType === "pl"');
    expect(source).toContain("return { code: null, needsHumanClassification: true }");
  });

  it("mantiene propuesta y P&L legacy sujetos a clasificación humana", () => {
    expect(source).toContain('{ code: "technical_economic_proposal", needsHumanClassification: true }');
    expect(source).toContain('{ code: "costed_pnl", needsHumanClassification: true }');
  });

  it("es idempotente por fuente legacy y no borra ni valida automáticamente", () => {
    expect(source).toContain("existingLegacy");
    expect(source).toContain('reason: "ya importado"');
    expect(source).not.toMatch(/\.delete\(/);
    expect(source).not.toContain('decision: "valid"');
  });

  it("sólo crea snapshots de plan cuando existen hitos identificables", () => {
    expect(source).toContain('filter(item => item.issueLevel === "milestone")');
    expect(source).toContain("if (milestones.length)");
    expect(source).toContain("milestoneCount: milestones.length");
  });
});
