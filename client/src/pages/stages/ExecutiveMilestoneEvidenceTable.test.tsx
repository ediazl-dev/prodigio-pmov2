import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ExecutiveMilestoneEvidenceTable,
  formatExecutiveMilestoneDate,
  formatExecutiveMilestoneObservation,
  type ExecutiveMilestoneEvidenceRow,
} from "./ExecutiveMilestoneEvidenceTable";

const observedAt = new Date("2026-10-20T15:00:00.000Z");
const milestones: ExecutiveMilestoneEvidenceRow[] = [
  {
    id: 101,
    milestoneCode: "H0",
    title: "PCIAD4-49",
    baselineDate: null,
    jiraDueDate: "2026-10-13",
    jiraClosedDate: null,
    jiraIssueKey: "CONS-100",
    jiraStatusName: "Cumplido",
    semanticStatus: "fulfilled",
    acceptanceStatus: "unverified",
    acceptedAt: null,
    acceptanceEvidenceUrl: null,
    lastObservedAt: observedAt,
  },
  {
    id: 102,
    milestoneCode: "M01",
    title: "Diseño",
    baselineDate: "2026-08-01",
    jiraDueDate: "2026-11-19",
    committedDate: "2026-12-19",
    jiraClosedDate: null,
    jiraIssueKey: "CONS-101",
    jiraStatusName: "Pendiente",
    semanticStatus: "pending",
    acceptanceStatus: "unverified",
    acceptedAt: null,
    lastObservedAt: observedAt,
  },
  {
    id: 103,
    milestoneCode: "M02",
    title: "Construcción",
    baselineDate: null,
    jiraDueDate: "2027-01-05",
    jiraClosedDate: null,
    jiraIssueKey: "CONS-102",
    jiraStatusName: "Pendiente",
    semanticStatus: "pending",
    acceptanceStatus: "unverified",
    acceptedAt: null,
    lastObservedAt: observedAt,
  },
  {
    id: 104,
    milestoneCode: "M03",
    title: "Salida",
    baselineDate: null,
    jiraDueDate: "2027-02-01",
    jiraClosedDate: null,
    jiraIssueKey: "CONS-103",
    jiraStatusName: "Pendiente",
    semanticStatus: "pending",
    acceptanceStatus: "unverified",
    acceptedAt: null,
    lastObservedAt: observedAt,
  },
];

afterEach(cleanup);

describe("ExecutiveMilestoneEvidenceTable", () => {
  it("muestra cuatro filas neutrales con fechas Jira pendientes y evidencia separada", () => {
    render(
      <ExecutiveMilestoneEvidenceTable
        milestones={milestones}
        milestoneFinanceByCode={new Map([
          ["H0", { amountUf: 308, amountSource: "sale_weight" }],
          ["M01", { amountUf: 242, amountSource: "sale_weight" }],
          ["M02", { amountUf: 396, amountSource: "sale_weight" }],
          ["M03", { amountUf: 154, amountSource: "sale_weight" }],
        ])}
        source={{ contractFileName: "baseline-jira-PCIAD4" }}
        canManageRequirements
        onRegisterActa={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("row")).toHaveLength(5);
    expect(screen.getByRole("heading", { name: "Calendario y evidencia por hito" })).toBeTruthy();
    expect(screen.queryByText(/vencid/i)).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Monto referencial" })).toBeTruthy();
    expect(screen.getAllByText(/Venta × peso Jira · referencial; no acredita contrato ni factura/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/línea base contractual pendiente/i)).toBeTruthy();
    expect(screen.getByText(/Última observación PMO:/)).toBeTruthy();
    expect(screen.getByTestId("milestone-evidence-footer").textContent).toContain(formatExecutiveMilestoneObservation(observedAt));

    const h0 = screen.getByText("H0").closest("tr");
    expect(h0).toBeTruthy();
    expect(within(h0 as HTMLTableRowElement).getByText("Cumplido")).toBeTruthy();
    expect(within(h0 as HTMLTableRowElement).getByText("Sin acta")).toBeTruthy();
    expect(within(h0 as HTMLTableRowElement).getAllByText("N/D").length).toBeGreaterThanOrEqual(3);

    const m01 = screen.getByText("M01").closest("tr");
    expect(m01).toBeTruthy();
    expect(within(m01 as HTMLTableRowElement).getByText(formatExecutiveMilestoneDate("2026-08-01"))).toBeTruthy();
    expect(within(m01 as HTMLTableRowElement).getByText(formatExecutiveMilestoneDate("2026-11-19"))).toBeTruthy();
    expect(within(m01 as HTMLTableRowElement).getAllByText("N/D")).toHaveLength(2);
    expect(screen.getByText(formatExecutiveMilestoneDate("2027-01-05"))).toBeTruthy();
    expect(screen.getByText(formatExecutiveMilestoneDate("2027-02-01"))).toBeTruthy();
  });

  it("conserva la acción de registrar acta y acepta fechas Date en el formatter", () => {
    const onRegisterActa = vi.fn();
    const formatterDate = new Date("2026-11-19T00:00:00.000Z");

    render(
      <ExecutiveMilestoneEvidenceTable
        milestones={milestones}
        milestoneFinanceByCode={new Map()}
        source={{ contractFileName: "baseline-jira-PCIAD4" }}
        canManageRequirements
        onRegisterActa={onRegisterActa}
      />,
    );

    expect(formatExecutiveMilestoneDate(formatterDate)).not.toBe("N/D");
    fireEvent.click(screen.getByRole("button", { name: "Registrar acta para H0" }));
    expect(onRegisterActa).toHaveBeenCalledWith(101);
  });

  it("no acredita aceptación sólo por estado y fecha sin acta vinculada", () => {
    render(<ExecutiveMilestoneEvidenceTable milestones={[{ ...milestones[0], acceptanceStatus: "accepted", acceptedAt: "2026-10-20" }]} source={{ contractFileName: "baseline-jira-PCIAD4" }} canManageRequirements={false} onRegisterActa={vi.fn()} />);
    expect(screen.getByText("Sin acta")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("distingue cierre Jira de aceptación documental válida", () => {
    render(<ExecutiveMilestoneEvidenceTable milestones={[{ ...milestones[0], jiraClosedDate: "2026-10-19", acceptanceStatus: "accepted", acceptedAt: "2026-10-20", acceptanceEvidenceUrl: "https://example.com/acta.pdf", acceptanceFileName: "Acta H0" }]} source={{ contractFileName: "contrato.pdf" }} canManageRequirements onRegisterActa={vi.fn()} />);
    expect(screen.getByText(formatExecutiveMilestoneDate("2026-10-19"))).toBeTruthy();
    expect(screen.getByText(`Aceptada · ${formatExecutiveMilestoneDate("2026-10-20")}`)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acta H0" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
