import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routers = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const database = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const documentRouter = readFileSync(new URL("./documentGovernanceRouter.ts", import.meta.url), "utf8");

describe("project document gate", () => {
  it("intercepta cierre genérico, formal, automático y manual de Planificación", () => {
    expect(routers).toContain('if (input.stageId === "planning") await closeProjectPlanningWithGate');
    expect(routers).toContain("await closeProjectPlanningWithGate(ctxClose1, input.projectId)");
    expect(routers).toContain("await closeProjectPlanningWithGate(ctxClose2, input.projectId)");
    expect(routers).toContain("const gate = await closeProjectPlanningWithGate(ctx, input.projectId)");
  });

  it("persiste snapshot y transición de proyecto en una única transacción", () => {
    const start = database.indexOf("export async function completeProjectPlanningWithDocumentGate");
    const block = database.slice(start, database.indexOf("// ==================== SOW", start));
    expect(block).toContain("db.transaction(async tx =>");
    expect(block).toContain("tx.insert(documentGateSnapshots)");
    expect(block).toContain('eq(projectStages.stageId, "planning")');
    expect(block).toContain('eq(projectStages.stageId, "design")');
    expect(block).toContain('currentStage: "design"');
    expect(block).toContain("idempotent: true");
  });

  it("el adaptador usa hitos locales Jira/WBS y crea una versión pending, nunca un contrato", () => {
    const start = documentRouter.indexOf("snapshotProjectWorkPlan:");
    const block = documentRouter.slice(start, documentRouter.indexOf("download:", start));
    expect(block).toContain("getExecutiveContractMilestones");
    expect(block).toContain("getWbsByProject");
    expect(block).toContain('requirementCode: "work_plan_milestones"');
    expect(block).toContain('sourceKind: "jira_snapshot"');
    expect(block).toContain('validation: "pending"');
    expect(block).not.toContain('requirementCode: "contract"');
    expect(block).not.toContain('decision: "valid"');
  });
});
