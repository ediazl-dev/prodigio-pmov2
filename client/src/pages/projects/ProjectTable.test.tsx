/** @vitest-environment jsdom */

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectTable } from "./ProjectTable";
import type { PortfolioRow, SortState } from "./portfolioViewModel";

const navigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/projects", navigate],
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function row(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    projectId: 2670001,
    projectName: "[PMO] CCLA SRP MVP1 Deal 4728",
    clientName: "CCLA",
    dealId: "Deal 4728",
    projectType: "integracion",
    origin: "linked",
    status: "activo",
    stageId: "design",
    stageLabel: "Avance",
    stageIndex: 4,
    totalStages: 6,
    stagesClosed: 2,
    closedStageIds: ["sow", "risks"],
    daysUsed: 21,
    daysAllowed: 18,
    overDays: 3,
    deadlineState: "overdue",
    deadlineReason: "measured",
    pmId: 10,
    pmKey: "10",
    pmName: "Eugenio Díaz",
    pmSource: "pmo_local",
    amount: 120000,
    currency: "USD",
    amountMissing: false,
    amountSource: "project",
    highRisksOpen: 1,
    openRisks: 3,
    riskSource: "pmo_confirmed",
    operationalPhase: "Construcción",
    operationalPhaseSource: "jira_snapshot",
    operationalProgressPct: 45,
    executiveHealth: "Amarillo",
    jiraEvidenceStatus: "success",
    jiraEvidenceAvailability: "available",
    jiraEvidenceAt: "2026-09-18T13:00:00.000Z",
    jiraSourceUpdatedAt: "2026-09-18T12:55:00.000Z",
    jiraEvidenceStale: false,
    milestonesTotal: 10,
    milestonesFulfilled: 6,
    milestoneSource: "jira_snapshot",
    startDate: "2026-05-01",
    endDate: null,
    ...overrides,
  };
}

const defaultSort: SortState = { key: "urgency", direction: "asc" };

describe("ProjectTable", () => {
  it("muestra ID PMO, enlace nativo y orden inicial anunciado", () => {
    render(
      <ProjectTable
        rows={[row()]}
        sort={defaultSort}
        onSortChange={vi.fn()}
        canDelete={() => false}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("PMO-2670001")).toBeTruthy();
    const link = screen.getByRole("link", { name: "[PMO] CCLA SRP MVP1 Deal 4728" });
    expect(link.getAttribute("href")).toBe("/projects/2670001");
    expect(screen.getByRole("columnheader", { name: /Estado/ }).getAttribute("aria-sort")).toBe("ascending");
    expect(screen.getByRole("columnheader", { name: "PM" }).hasAttribute("aria-sort")).toBe(false);
    expect(screen.getByRole("table").querySelectorAll("th[scope='col']")).toHaveLength(10);
    expect(screen.getByText("Construcción")).toBeTruthy();
    expect(screen.getByText("6/10")).toBeTruthy();
    expect(screen.getByText("Salud: Amarillo")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("mantiene el pipeline de etapas cerradas reales y no por posición", () => {
    render(
      <ProjectTable
        rows={[row()]}
        sort={defaultSort}
        onSortChange={vi.fn()}
        canDelete={() => false}
        onDelete={vi.fn()}
      />,
    );

    const pipeline = screen.getByRole("img", { name: /2 de 6 etapas PMO cerradas/ });
    const segments = pipeline.querySelectorAll("i");
    expect(segments).toHaveLength(6);
    expect(segments[0].getAttribute("style")).toBe(segments[2].getAttribute("style"));
    expect(segments[1].getAttribute("style")).not.toBe(segments[0].getAttribute("style"));
  });

  it("activa orden por columna y sólo expone borrar cuando la política lo permite", () => {
    const onSortChange = vi.fn();
    const onDelete = vi.fn();
    const { rerender } = render(
      <ProjectTable
        rows={[row({ stageId: "planning" })]}
        sort={defaultSort}
        onSortChange={onSortChange}
        canDelete={() => true}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Contratado/ }));
    expect(onSortChange).toHaveBeenCalledWith("amount");
    fireEvent.click(screen.getByRole("button", { name: /Eliminar \[PMO\] CCLA/ }));
    expect(onDelete).toHaveBeenCalledTimes(1);

    rerender(
      <ProjectTable
        rows={[row({ stageId: "design" })]}
        sort={defaultSort}
        onSortChange={onSortChange}
        canDelete={() => false}
        onDelete={onDelete}
      />,
    );
    expect(screen.queryByRole("button", { name: /Eliminar \[PMO\] CCLA/ })).toBeNull();
  });

  it("explica la falta de apertura PMO y distingue evidencia Jira parcial", () => {
    render(
      <ProjectTable
        rows={[row({
          deadlineState: "no_deadline",
          deadlineReason: "missing_stage_opening",
          daysUsed: null,
          daysAllowed: null,
          jiraEvidenceStatus: "partial",
          jiraEvidenceStale: false,
        })]}
        sort={defaultSort}
        onSortChange={vi.fn()}
        canDelete={() => false}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin apertura PMO")).toBeTruthy();
    expect(screen.getByText("No mide avance Jira")).toBeTruthy();
    expect(screen.getByText("Evidencia Jira parcial")).toBeTruthy();
  });
});
