import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JsmLinkedItems } from "./JsmLinkedItems";
import type { JsmIssuesSummary } from "../jsmSetupGate";

afterEach(cleanup);

function reference(id: number, key: string) {
  return { id, jiraKey: key, title: `Facturación Mes ${id}`, amount: "195.00", currency: "UF", monthNumber: id, category: "facturacion" as const };
}

function summary(overrides: Record<string, unknown> = {}): JsmIssuesSummary {
  // Fixture parcial: este componente sólo consume listas y no calcula el gate.
  return { syncedWorkItems: [], syncedBilling: [], totalSynced: 31, totalUnsynced: 0, totalWorkItems: 31, totalBilling: 0, ...overrides } as unknown as JsmIssuesSummary;
}

describe("consulta de referencias financieras existentes en JSM", () => {
  it("muestra seis hitos del mismo Space aunque no haya cuotas por crear", () => {
    const refs = [3, 4, 5, 6, 7, 2].map((key, index) => reference(index + 1, `CONSALOP02-${key}`));
    const data = summary({ existingBillingReferences: refs });
    render(<JsmLinkedItems summary={data} jiraBaseUrl="https://apiservice2.atlassian.net" />);
    fireEvent.click(screen.getByRole("button", { name: "Facturación (6)" }));
    for (const item of refs) {
      expect(screen.getByRole("link", { name: item.jiraKey }).getAttribute("href")).toBe(`https://apiservice2.atlassian.net/browse/${item.jiraKey}`);
    }
    expect(data.totalSynced).toBe(31);
    expect(data.totalBilling).toBe(0);
    expect(screen.queryByText("Facturado")).toBeNull();
  });

  it("conserva la lista anterior si no hay referencias adicionales", () => {
    render(<JsmLinkedItems summary={summary({ syncedBilling: [reference(1, "CONSALOP02-3")] })} jiraBaseUrl="https://apiservice2.atlassian.net" />);
    fireEvent.click(screen.getByRole("button", { name: "Facturación (1)" }));
    expect(screen.getByRole("link", { name: "CONSALOP02-3" })).toBeTruthy();
  });

  it("no cuenta dos veces la misma referencia de consulta", () => {
    const item = reference(1, "CONSALOP02-3");
    render(<JsmLinkedItems summary={summary({ syncedBilling: [item], existingBillingReferences: [item] })} jiraBaseUrl="https://apiservice2.atlassian.net" />);
    fireEvent.click(screen.getByRole("button", { name: "Facturación (1)" }));
    expect(screen.getAllByRole("link", { name: "CONSALOP02-3" })).toHaveLength(1);
  });

  it("muestra actividades existentes sin exigir una nueva creación o mapping", () => {
    const activities = Array.from({ length: 32 }, (_, i) => ({ id: 450001 + i, jiraKey: `MDSCE2937-${i + 1}`, title: `Control ${i + 1}`, type: "tarea_programada", frequency: "mensual", monthNumber: null, category: "actividad" }));
    const data = summary({ existingWorkReferences: activities, totalWorkItems: 0, totalSynced: 0 });
    render(<JsmLinkedItems summary={data} jiraBaseUrl="https://apiservice2.atlassian.net" />);
    expect(screen.getByRole("button", { name: "Actividades (32)" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(32);
    expect(data.totalSynced).toBe(0);
    expect(screen.queryByText("Ejecutar dry-run")).toBeNull();
  });
});
