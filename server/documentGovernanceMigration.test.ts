import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("../drizzle/0052_simple_thaddeus_ross.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");

const expectedTables = [
  "document_requirement_catalog",
  "document_artifacts",
  "document_validation_decisions",
  "document_requirement_resolutions",
  "document_associations",
  "document_work_plan_snapshots",
  "document_gate_snapshots",
];

describe("document governance migration", () => {
  it("crea todas las estructuras canónicas esperadas", () => {
    for (const table of expectedTables) {
      expect(migration).toContain(`CREATE TABLE \`${table}\``);
      expect(schema).toContain(`\"${table}\"`);
    }
  });

  it("es aditiva y no contiene operaciones destructivas", () => {
    expect(migration).not.toMatch(/\b(DROP|TRUNCATE|DELETE)\b/i);
    expect(migration).not.toMatch(/ALTER\s+TABLE/i);
  });

  it("siembra nueve requisitos de la policy v1", () => {
    expect(migration.match(/'2026-09-26\.v1'/g)).toHaveLength(9);
    expect(migration).toContain("'recurring_service', 'costed_pnl'");
    expect(migration).toContain("'project', 'work_plan_milestones'");
  });

  it("preserva historial con decisiones y snapshots append-only", () => {
    expect(schema).toContain("documentValidationDecisions");
    expect(schema).toContain("documentGateSnapshots");
    expect(schema).toContain("supersedesArtifactId");
    expect(schema).toContain("openEndedValidity");
    expect(schema).toContain("costingStatus");
  });
});
