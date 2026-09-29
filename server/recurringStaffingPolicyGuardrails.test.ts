import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./recurringServicesRouter.ts", import.meta.url), "utf8");
const runner = readFileSync(new URL("./jsmRecurringSyncRunner.ts", import.meta.url), "utf8");
const workPlanPage = readFileSync(new URL("../client/src/pages/recurring/RSWorkPlanStage.tsx", import.meta.url), "utf8");
const jsmPage = readFileSync(new URL("../client/src/pages/recurring/RSJsmSetupStage.tsx", import.meta.url), "utf8");
const migration = readFileSync(new URL("../drizzle/0053_cynical_jack_power.sql", import.meta.url), "utf8");

function staffingGenerationBlock() {
  const start = router.indexOf('if (svc.serviceType === "staffing")');
  const end = router.indexOf("const prompt =", start);
  return router.slice(start, end);
}

describe("guardrails contractuales Staffing", () => {
  it("genera desde SoW, extrae plazos y persiste SLA vacío", () => {
    const block = staffingGenerationBlock();
    expect(block).toContain("extractSowContent");
    expect(block).toContain("parseStaffingContractTerms");
    expect(block).toContain("replaceRecurringWorkPlan({ serviceId: input.serviceId, items: staffingPlan, sla: [] })");
    expect(block).not.toContain("invokeLLM");
  });

  it("bloquea SLA, cobertura y facturación duplicada en edición manual", () => {
    expect(router).toContain('["facturacion", "sla_definition", "coverage_definition"]');
    expect(router).toContain("No aplica SLA contractual de incidentes para servicios Staffing");
    expect(runner).toContain('item.itemType === "facturacion"');
    expect(runner).toContain("excludedDuplicateBilling");
  });

  it("explica la aplicabilidad y la referencia externa antes del dry-run", () => {
    expect(workPlanPage).toContain("No aplican SLA de incidentes, DR ni cobertura 24x7");
    expect(workPlanPage).toContain("Regenerar desde SoW");
    expect(jsmPage).toContain("Referencia externa · no crear issues");
    expect(jsmPage).toContain("Qué se creará en este Space");
  });

  it("la migración sólo añade la política por categoría con defaults compatibles", () => {
    expect(migration).toContain("ADD `jsmWorkPlanSyncMode`");
    expect(migration).toContain("ADD `jsmBillingSyncMode`");
    expect(migration.toLowerCase()).not.toContain("drop table");
    expect(migration.toLowerCase()).not.toContain("delete from");
  });
});
