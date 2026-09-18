import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildPendingGroups, type JsmIssuesSummary, type JsmSetupGate } from "../jsmSetupGate";
import { JsmGateChecklist } from "./JsmGateChecklist";
import { JsmLinkedItems } from "./JsmLinkedItems";
import { JsmPendingItems } from "./JsmPendingItems";

afterEach(() => cleanup());

function gate(overrides: Partial<JsmSetupGate> = {}): JsmSetupGate {
  return {
    steps: [
      {
        id: "platform",
        order: 1,
        title: "Plataforma elegida",
        detail: "Plataforma Prodigio",
        state: "done",
        actionLabel: null,
        hint: null,
      },
      {
        id: "space",
        order: 2,
        title: "Space JSM vinculado",
        detail: "CAMANSOP02 · con advertencias",
        state: "warning",
        actionLabel: "Revisar vínculo",
        hint: null,
      },
      {
        id: "mapping_work_plan",
        order: 3,
        title: "Mapping de plan de trabajo",
        detail: "Seleccione un tipo",
        state: "current",
        actionLabel: "Seleccionar tipo de issue",
        hint: null,
      },
    ],
    doneCount: 2,
    totalCount: 3,
    canClose: false,
    blockers: ["Falta el mapping de plan de trabajo."],
    serverMismatch: false,
    linkedCount: 27,
    totalLinkable: 33,
    unsyncedCount: 6,
    currentStepId: "mapping_work_plan",
    ...overrides,
  };
}

describe("JsmGateChecklist", () => {
  it("muestra los blockers crudos y oculta controles locales cuando el servidor discrepa", () => {
    render(
      <JsmGateChecklist
        gate={gate({ serverMismatch: true, blockers: ["Bloqueo autoritativo del servidor."] })}
        renderControl={() => <button>Control local</button>}
      />,
    );

    expect(screen.getByText(/Bloqueo autoritativo del servidor\./)).toBeTruthy();
    expect(screen.queryByText("Control local")).toBeNull();
  });

  it("expande sólo el paso actual y abre la revisión de una advertencia", () => {
    const onStepAction = vi.fn();
    render(
      <JsmGateChecklist
        gate={gate()}
        renderControl={step => <button>Control {step.id}</button>}
        onStepAction={onStepAction}
      />,
    );

    expect(screen.getByText("Control mapping_work_plan")).toBeTruthy();
    expect(screen.queryByText("Control platform")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Revisar vínculo" }));
    expect(onStepAction).toHaveBeenCalledTimes(1);
    expect(onStepAction.mock.calls[0][0].id).toBe("space");
  });
});

describe("JsmPendingItems", () => {
  it("presenta montos por moneda sin sumarlos entre sí", () => {
    const summary = {
      unsyncedWorkItems: [],
      unsyncedBilling: [
        { id: 1, title: "Mes 1", amount: "94", currency: "USD", monthNumber: 1 },
        { id: 2, title: "Mes 2", amount: "80000", currency: "CLP", monthNumber: 2 },
      ],
    } as unknown as JsmIssuesSummary;

    render(<JsmPendingItems groups={buildPendingGroups(summary)} />);
    expect(screen.getByText("USD 94 + CLP 80.000")).toBeTruthy();
    expect(screen.getByText("USD 94", { selector: "span" })).toBeTruthy();
    expect(screen.getByText("CLP 80.000", { selector: "span" })).toBeTruthy();
  });
});

describe("JsmLinkedItems", () => {
  it("conserva enlaces Jira y permite alternar entre actividades y facturación", () => {
    const summary = {
      syncedWorkItems: [
        {
          id: 1,
          jiraKey: "CAMANSOP02-1",
          title: "Actividad vinculada",
          type: "tarea_programada",
          frequency: "mensual",
        },
      ],
      syncedBilling: [
        {
          id: 2,
          jiraKey: "CAMANSOP02-2",
          title: "Facturación Mes 1",
          amount: "94",
          currency: "USD",
          monthNumber: 1,
        },
      ],
    } as unknown as JsmIssuesSummary;

    render(<JsmLinkedItems summary={summary} jiraBaseUrl="https://jira.example.test" />);
    expect(screen.getByText("Actividad vinculada")).toBeTruthy();
    expect(screen.getByText("CAMANSOP02-1").closest("a")?.getAttribute("href")).toBe(
      "https://jira.example.test/browse/CAMANSOP02-1",
    );

    fireEvent.click(screen.getByRole("button", { name: "Facturación (1)" }));
    expect(screen.getByText("Facturación Mes 1")).toBeTruthy();
    expect(screen.getByText("CAMANSOP02-2").closest("a")?.getAttribute("href")).toBe(
      "https://jira.example.test/browse/CAMANSOP02-2",
    );
  });
});
