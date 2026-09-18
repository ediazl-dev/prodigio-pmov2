import { describe, expect, it } from "vitest";
import { buildJsmSetupGate, buildPendingGroups, type JsmIssuesSummary, type JsmSetupGateInput } from "./jsmSetupGate";

function input(overrides: Partial<JsmSetupGateInput> = {}): JsmSetupGateInput {
  return {
    platform: "prodigio",
    clientPlatformUrl: null,
    projectKey: "CAMANSOP02",
    serviceDeskId: "365",
    spaceHealthy: true,
    lastVerifiedAt: "2026-09-17T00:07:00Z",
    mappingCategories: [],
    totalWorkItems: 27,
    totalBilling: 6,
    totalSynced: 27,
    totalUnsynced: 6,
    readiness: {
      canClose: false,
      blockers: [
        "Falta el mapping de plan de trabajo.",
        "Falta el mapping de facturación.",
        "Quedan 6 elementos sin vincular a Jira.",
      ],
    },
    hasDryRun: false,
    ...overrides,
  };
}

describe("buildJsmSetupGate", () => {
  it("convierte los bloqueos del servidor en cinco pasos ordenados", () => {
    const gate = buildJsmSetupGate(input());
    expect(gate.steps.map(step => step.id)).toEqual([
      "platform",
      "space",
      "mapping_work_plan",
      "mapping_billing",
      "sync",
    ]);
    expect(gate.doneCount).toBe(2);
    expect(gate.totalCount).toBe(5);
    expect(gate.canClose).toBe(false);
  });

  it("marca como current solo el primer paso no resuelto", () => {
    const gate = buildJsmSetupGate(input());
    expect(gate.currentStepId).toBe("mapping_work_plan");
    expect(gate.steps.filter(step => step.state === "current")).toHaveLength(1);
  });

  it("bloquea la sincronización mientras falten mappings", () => {
    const gate = buildJsmSetupGate(input());
    const sync = gate.steps.find(step => step.id === "sync");
    expect(sync?.state).toBe("blocked");
  });

  it("habilita el dry-run cuando los dos mappings están guardados", () => {
    const gate = buildJsmSetupGate(input({ mappingCategories: ["work_plan", "billing"] }));
    const sync = gate.steps.find(step => step.id === "sync");
    expect(sync?.state).toBe("current");
    expect(sync?.actionLabel).toBe("Ejecutar dry-run");
  });

  it("pasa a confirmar cuando ya hay un dry-run", () => {
    const gate = buildJsmSetupGate(input({ mappingCategories: ["work_plan", "billing"], hasDryRun: true }));
    expect(gate.steps.find(step => step.id === "sync")?.actionLabel).toBe("Confirmar sincronización");
  });

  it("marca el Space con advertencia cuando el vínculo no tiene salud vigente", () => {
    const gate = buildJsmSetupGate(input({ spaceHealthy: false }));
    const space = gate.steps.find(step => step.id === "space");
    expect(space?.state).toBe("warning");
    expect(space?.actionLabel).toBe("Revalidar vínculo");
    // Una advertencia no impide avanzar: sigue contando como paso resuelto.
    expect(gate.doneCount).toBe(2);
  });

  it("da por resuelto un mapping que no aplica porque no hay elementos", () => {
    const gate = buildJsmSetupGate(
      input({ totalBilling: 0, totalUnsynced: 0, totalSynced: 27, mappingCategories: ["work_plan"] }),
    );
    expect(gate.steps.find(step => step.id === "mapping_billing")?.state).toBe("done");
    expect(gate.steps.find(step => step.id === "sync")?.state).toBe("done");
  });

  it("en plataforma del cliente solo exige la URL", () => {
    const gate = buildJsmSetupGate(
      input({
        platform: "cliente",
        projectKey: null,
        clientPlatformUrl: null,
        readiness: { canClose: false, blockers: ["Debe registrar la URL de la plataforma del cliente."] },
      }),
    );
    expect(gate.steps.map(step => step.id)).toEqual(["platform", "client_url"]);
    expect(gate.currentStepId).toBe("client_url");
  });

  it("detecta y reporta la discrepancia con el servidor sin taparla", () => {
    // Todos los pasos resueltos localmente, pero el servidor dice que no se puede cerrar.
    const gate = buildJsmSetupGate(
      input({
        mappingCategories: ["work_plan", "billing"],
        totalUnsynced: 0,
        totalSynced: 33,
        readiness: { canClose: false, blockers: ["Un bloqueo que la UI no conoce."] },
      }),
    );
    expect(gate.serverMismatch).toBe(true);
    // El servidor manda: canClose refleja readiness, no la derivación local.
    expect(gate.canClose).toBe(false);
  });

  it("no inventa una discrepancia mientras readiness aún no está disponible", () => {
    const gate = buildJsmSetupGate(
      input({
        mappingCategories: ["work_plan", "billing"],
        totalUnsynced: 0,
        totalSynced: 33,
        readiness: null,
      }),
    );
    expect(gate.serverMismatch).toBe(false);
    expect(gate.canClose).toBe(false);
  });

  it("obedece al servidor aunque la plataforma local aún no esté elegida", () => {
    const gate = buildJsmSetupGate(
      input({
        platform: null,
        mappingCategories: ["work_plan", "billing"],
        totalUnsynced: 0,
        totalSynced: 33,
        readiness: { canClose: true, blockers: [] },
      }),
    );
    expect(gate.serverMismatch).toBe(true);
    expect(gate.canClose).toBe(true);
  });

  it("mantiene una salud warning como advertencia sin convertirla en bloqueo backend", () => {
    const gate = buildJsmSetupGate(
      input({
        spaceHealthy: false,
        mappingCategories: ["work_plan", "billing"],
        totalUnsynced: 0,
        totalSynced: 33,
        readiness: { canClose: true, blockers: [] },
      }),
    );
    expect(gate.steps.find(step => step.id === "space")?.state).toBe("warning");
    expect(gate.canClose).toBe(true);
    expect(gate.serverMismatch).toBe(false);
  });

  it("no reporta discrepancia cuando ambos coinciden", () => {
    const gate = buildJsmSetupGate(
      input({
        mappingCategories: ["work_plan", "billing"],
        totalUnsynced: 0,
        totalSynced: 33,
        readiness: { canClose: true, blockers: [] },
      }),
    );
    expect(gate.serverMismatch).toBe(false);
    expect(gate.canClose).toBe(true);
  });
});

describe("buildPendingGroups", () => {
  const summary = {
    unsyncedWorkItems: [],
    unsyncedBilling: [
      { id: 1, title: "Facturación Mes 1", amount: "94.00", currency: "USD", monthNumber: 1, category: "facturacion" },
      { id: 2, title: "Facturación Mes 2", amount: "94.00", currency: "USD", monthNumber: 2, category: "facturacion" },
    ],
  } as unknown as JsmIssuesSummary;

  it("agrupa los pendientes y totaliza por moneda", () => {
    const groups = buildPendingGroups(summary);
    expect(groups).toHaveLength(1);
    expect(groups[0].count).toBe(2);
    expect(groups[0].amountLabel).toBe("USD 188");
  });

  it("nunca suma monedas distintas: las lista por separado", () => {
    const mixed = {
      unsyncedWorkItems: [],
      unsyncedBilling: [
        { id: 1, title: "Mes 1", amount: "94.00", currency: "USD", monthNumber: 1, category: "facturacion" },
        { id: 2, title: "Mes 2", amount: "80000", currency: "CLP", monthNumber: 2, category: "facturacion" },
      ],
    } as unknown as JsmIssuesSummary;

    const groups = buildPendingGroups(mixed);
    expect(groups[0].amountLabel).toContain("USD");
    expect(groups[0].amountLabel).toContain("CLP");
    expect(groups[0].amountLabel).toContain("+");
  });

  it("devuelve vacío cuando no hay pendientes", () => {
    expect(buildPendingGroups(undefined)).toEqual([]);
  });
});
