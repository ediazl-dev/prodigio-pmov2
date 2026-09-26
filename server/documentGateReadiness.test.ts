import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveDocumentGateMode } from "./documentGateReadiness";

const recurringRouter = readFileSync(new URL("./recurringServicesRouter.ts", import.meta.url), "utf8");
const recurringRepository = readFileSync(new URL("./recurringServicesDb.ts", import.meta.url), "utf8");

describe("document gate rollout", () => {
  it("usa observación por defecto y nunca activa enforce sin cohorte explícita", () => {
    expect(resolveDocumentGateMode("recurring_service", 10, {})).toBe("observe");
    expect(resolveDocumentGateMode("recurring_service", 10, { DOCUMENT_GOVERNANCE_GATE_MODE: "enforce" })).toBe("observe");
    expect(resolveDocumentGateMode("project", 10, { DOCUMENT_GOVERNANCE_GATE_MODE: "enforce", DOCUMENT_GOVERNANCE_PROJECT_ENFORCE_IDS: "11,12" })).toBe("observe");
  });

  it("permite enforce sólo en la cohorte o wildcard correspondiente", () => {
    expect(resolveDocumentGateMode("recurring_service", 10, { DOCUMENT_GOVERNANCE_GATE_MODE: "enforce", DOCUMENT_GOVERNANCE_RECURRING_ENFORCE_IDS: "9,10" })).toBe("enforce");
    expect(resolveDocumentGateMode("project", 20, { DOCUMENT_GOVERNANCE_GATE_MODE: "enforce", DOCUMENT_GOVERNANCE_PROJECT_ENFORCE_IDS: "*" })).toBe("enforce");
  });

  it("conserva explícitamente el modo off", () => {
    expect(resolveDocumentGateMode("project", 1, { DOCUMENT_GOVERNANCE_GATE_MODE: "off" })).toBe("off");
  });

  it("evalúa readiness antes de completar Inicialización y conserva el gate legacy en observe", () => {
    const blockStart = recurringRouter.indexOf("closeInitializationStage:");
    const block = recurringRouter.slice(blockStart, recurringRouter.indexOf("// ═══════════════════════════════════════════════════════════════════════════", blockStart));
    const readinessPosition = block.indexOf("const readiness = await getDocumentGateReadiness");
    const completionPosition = block.indexOf("completeRecurringStageWithDocumentGate");
    expect(readinessPosition).toBeGreaterThan(0);
    expect(completionPosition).toBeGreaterThan(readinessPosition);
    expect(block).toContain('if (readiness.mode !== "enforce" && docs.length === 0)');
    expect(block).toContain("PRECONDITION_FAILED");
  });

  it("persiste snapshot, cierre y desbloqueo en una sola transacción", () => {
    const functionStart = recurringRepository.indexOf("export async function completeRecurringStageWithDocumentGate");
    const functionSource = recurringRepository.slice(functionStart, recurringRepository.indexOf("// ─── Billing Months", functionStart));
    expect(functionSource).toContain("db.transaction(async tx =>");
    expect(functionSource).toContain("tx.insert(documentGateSnapshots)");
    expect(functionSource).toContain("tx.update(recurringServiceStages)");
    expect(functionSource).toContain("tx.update(recurringServices)");
    expect(functionSource).toContain("idempotent: true");
  });
});
