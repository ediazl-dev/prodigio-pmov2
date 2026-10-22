import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  getNexosInternalRiskPatches,
  mapNexosInternalRiskPlan,
  NEXOS_INTERNAL_PROJECT_ID,
  type NexosInternalRiskInput,
} from "./nexosInternalRiskPlan";

type AuditFixture = { projectId: number; risks: NexosInternalRiskInput[] };

function loadAuditFixture(): AuditFixture {
  return JSON.parse(
    readFileSync("/home/ubuntu/nexos-internal-audit.json", "utf8"),
  ) as AuditFixture;
}

describe("NEXOS internal risk plan mapping", () => {
  it("maps exactly the 18 existing risks without mutating the audit rows", () => {
    const source = loadAuditFixture();
    const sourceSnapshot = structuredClone(source.risks);
    const mapped = mapNexosInternalRiskPlan(source.risks);

    expect((source as AuditFixture & { project?: { id?: number } }).project?.id).toBe(
      NEXOS_INTERNAL_PROJECT_ID,
    );
    expect(mapped).toHaveLength(18);
    expect(source.risks).toEqual(sourceSnapshot);
    expect(mapped.map(({ id }) => id)).toEqual(source.risks.map(({ id }) => id));
    expect(mapped.map(({ riskCode }) => riskCode)).toEqual(
      source.risks.map(({ riskCode }) => riskCode),
    );
  });

  it("preserves identity, classifications, ownership, cost, dates, status, and confirmation", () => {
    const source = loadAuditFixture();
    const mapped = mapNexosInternalRiskPlan(source.risks);
    const textFields = new Set(["description", "mitigation", "contingency"]);

    mapped.forEach((risk, index) => {
      const original = source.risks[index];
      expect(risk.id).toBe(original.id);
      expect(risk.projectId).toBe(original.projectId);
      expect(risk.riskCode).toBe(original.riskCode);
      expect(risk.category).toBe(original.category);
      expect(risk.type).toBe(original.type);
      expect(risk.probability).toBe(original.probability);
      expect(risk.impact).toBe(original.impact);
      expect(risk.owner).toBe(original.owner);
      expect(risk.status).toBe(original.status);
      expect(risk.confirmed).toBe(false);
      expect(risk.dueDate).toBe(original.dueDate);
      expect(risk.estimatedCost).toBe(original.estimatedCost);
      expect(risk.cost).toBe(original.cost);

      Object.keys(original).forEach((key) => {
        if (!textFields.has(key)) expect(risk[key]).toEqual(original[key]);
      });
    });
  });

  it("returns only draft text patches for the existing risk identities", () => {
    const source = loadAuditFixture();
    const patches = getNexosInternalRiskPatches();
    const sourceKeys = source.risks.map(({ id, riskCode }) => `${id}:${riskCode}`);

    expect(patches).toHaveLength(18);
    expect(patches.map(({ id, riskCode }) => `${id}:${riskCode}`)).toEqual(sourceKeys);
    patches.forEach((patch) => {
      expect(Object.keys(patch).sort()).toEqual([
        "contingency",
        "description",
        "id",
        "mitigation",
        "projectId",
        "riskCode",
      ]);
      expect(patch.projectId).toBe(NEXOS_INTERNAL_PROJECT_ID);
      expect(patch.description).not.toContain("Por definir");
      expect(patch.description).not.toContain("Pendiente de completar");
      expect(patch.mitigation.length).toBeGreaterThan(0);
      expect(patch.contingency.length).toBeGreaterThan(0);
    });
  });

  it("contains no revenue claim and never confirms or closes a risk", () => {
    const source = loadAuditFixture();
    const mapped = mapNexosInternalRiskPlan(source.risks);
    const patchText = JSON.stringify(getNexosInternalRiskPatches()).toLowerCase();

    expect(patchText).not.toMatch(/\b(?:revenue|ingresos?|facturaci[oó]n|ventas?)\b/i);
    mapped.forEach((risk) => {
      expect(risk.confirmed).toBe(false);
      expect(risk.status).toBe("abierto");
    });
  });
});
