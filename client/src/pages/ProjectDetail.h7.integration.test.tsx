/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ProjectDetail from "./ProjectDetail";

const mocks = vi.hoisted(() => {
  const project = {
    id: 2580004,
    projectName: "Proyecto H7 Integrado",
    clientName: "Cliente Piloto",
    clientEmail: "cliente@example.com",
    status: "activo",
    origin: "linked",
    jiraProjectKey: "PILOT",
    jiraProjectUrl: "https://example.atlassian.net/browse/PILOT",
    assignedPmUserId: 7,
    projectType: "implementación",
    currency: "CLP",
    totalAmount: null,
    portfolioEvidence: {
      operationalPhase: "Construcción + QA",
      operationalProgressPct: 31,
      stageLabel: "Análisis y Diseño",
      stagesClosed: 0,
      milestonesFulfilled: 8,
      milestonesTotal: 10,
      milestoneSource: "jira_snapshot",
      pmName: "Eduardo Mercado",
      pmSource: "jira_snapshot",
      openRisks: 23,
      highRisksOpen: 12,
      riskSource: "jira_snapshot",
      amount: 8200,
      currency: "UF",
      amountSource: "financial_data",
    },
    stages: [
      { stageId: "sow", status: "in_progress" },
      { stageId: "jira", status: "locked" },
      { stageId: "risks", status: "locked" },
      { stageId: "planning", status: "locked" },
      { stageId: "design", status: "locked" },
      { stageId: "closure", status: "locked" },
    ],
    stageClosures: [],
  };

  const historyRun = {
    id: 20,
    source: "manual",
    status: "applied",
    inputCount: 6,
    createdCount: 1,
    updatedCount: 4,
    skippedCount: 1,
    errorCount: 0,
    errorMessage: null,
    createdAt: "2026-08-29T21:00:00.000Z",
    finishedAt: "2026-08-29T21:00:03.000Z",
    details: { jiraRead: { requestedCount: 6, returnedCount: 6 } },
  };

  const status = {
    project: { dealId: null, projectName: "Proyecto H7 Integrado Deal 4728" },
    onboarding: { status: "ready", jiraProjectKey: "PILOT" },
    latestRun: { status: "partial", createdAt: "2026-08-29T20:00:00.000Z", finishedAt: "2026-08-29T20:01:00.000Z" },
    latestReconciliation: historyRun,
    reconciliationHistory: [historyRun],
    history: {
      recentRuns: [historyRun],
      totalRuns: 16,
      hasMore: true,
      visibleLimit: 3,
      statusCounts: { applied: 16, partial: 0, error: 0, running: 0 },
    },
    counts: {
      risks: { imported: 2, mapped: 2 },
      wbs: { imported: 3, mapped: 4 },
      documents: { sow: 1, gantt: 0, milestoneAcceptances: 2 },
      openExceptions: 1,
    },
    financial: {
      status: "available", dealId: "Deal4728", dealSource: "name_match", formallyLinked: false,
      sourceLabel: "Planilla financiera sincronizada", syncedAt: "2026-09-22T03:07:47.000Z", currency: "UF",
      contractedUf: 6533.3333, budgetUf: 2255, consumedUf: 708.98, projectedCostUf: 3544.9,
      projectedMarginUf: 2988.4333, projectedMarginPct: 0.4574132653, capacityProjectedUf: 1522.772,
    },
    coverage: [
      { key: "onboarding", label: "Vínculo Jira", status: "available", detail: "Listo" },
      { key: "financial", label: "Datos financieros", status: "available", detail: "Deal4728" },
      { key: "sow", label: "SoW", status: "available", detail: "1" },
      { key: "gantt", label: "Gantt", status: "missing", detail: "0" },
      { key: "risks", label: "Riesgos", status: "available", detail: "2/2" },
      { key: "wbs", label: "Backlog", status: "partial", detail: "3/4" },
    ],
    gaps: [
      { kind: "financial", severity: "info", label: "Formalizar el vínculo financiero", explanation: "Deal4728 coincide con la planilla.", recommendedAction: "Guardar el Deal en la ficha.", blocksSync: false },
      { kind: "document", severity: "warning", label: "Cargar Gantt contractual", explanation: "No existe una línea base cargada.", recommendedAction: "Cargar la Gantt aprobada.", blocksSync: false },
      { kind: "mapping", severity: "warning", label: "Completar mappings de backlog", explanation: "Se importaron 3 de 4 ítems esperados.", recommendedAction: "Revisar mappings pendientes.", blocksSync: false },
    ],
    exceptions: [{
      id: 1, domain: "documents", sourceKey: "PILOT-30", reason: "El mapping no contiene una clave S3 real.", severity: "warning",
      title: "Documento requiere validación", whatHappened: "El mapping no contiene una clave S3 real.",
      impact: "La referencia no se incorporó como evidencia válida.", recommendedAction: "Cargar o corregir el archivo.", blocksSync: false,
    }],
    pending: ["Formalizar el vínculo financiero", "Cargar Gantt contractual", "Completar mappings de backlog"],
  };

  return {
    project,
    status,
    historyRun,
    idleMutation: () => ({ mutate: vi.fn(), isPending: false }),
    invalidateProject: vi.fn(async () => undefined),
    refetchStatus: vi.fn(async () => undefined),
    syncMutate: vi.fn(),
    setLocation: vi.fn(),
  };
});

vi.mock("wouter", () => ({
  useParams: () => ({ id: String(mocks.project.id) }),
  useLocation: () => [`/projects/${mocks.project.id}`, mocks.setLocation],
}));

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 7, role: "admin" } }),
}));

vi.mock("@/components/BaselineExecutiveCard", () => ({
  BaselineExecutiveCard: () => null,
}));

vi.mock("@/components/ProjectExecutiveSummary", () => ({
  ProjectExecutiveSummary: ({ projectId, onNavigate }: { projectId: number; onNavigate: (path: string) => void }) => (
    <section data-testid="project-executive-summary" data-project-id={projectId}>
      <h2>Vista ejecutiva del proyecto</h2>
      <button type="button" onClick={() => onNavigate(`/projects/${projectId}/executive-dashboard-v2`)}>Abrir Dashboard Ejecutivo</button>
    </section>
  ),
}));

vi.mock("@/components/AppBreadcrumb", () => ({
  default: () => null,
  AppBreadcrumb: () => null,
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ projects: { get: { invalidate: mocks.invalidateProject } } }),
    projects: {
      get: { useQuery: () => ({ data: mocks.project, isLoading: false }) },
    },
    stageOpenings: {
      timeRemaining: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      recordOpening: { useMutation: mocks.idleMutation },
    },
    extensions: {
      history: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      pause: { useMutation: mocks.idleMutation },
      resume: { useMutation: mocks.idleMutation },
      extend: { useMutation: mocks.idleMutation },
    },
    jira: {
      closeHomologatedStage: { useMutation: mocks.idleMutation },
      reconcileHistoricalStage: { useMutation: mocks.idleMutation },
      unlinkProject: { useMutation: mocks.idleMutation },
      getExistingProjectImportStatus: {
        useQuery: () => ({
          data: mocks.status,
          isLoading: false,
          error: null,
          refetch: mocks.refetchStatus,
        }),
      },
      getExistingProjectImportHistory: {
        useQuery: () => ({
          data: { items: [mocks.historyRun], total: 16, page: 1, pageSize: 10, totalPages: 2 },
          isLoading: false,
          isFetching: false,
          error: null,
        }),
      },
      syncExistingProjectNow: {
        useMutation: () => ({
          isPending: false,
          mutate: (input: { projectId: number; operationId: string }) => mocks.syncMutate(input),
        }),
      },
    },
    advance: {
      listDocuments: { useQuery: () => ({ data: [], refetch: vi.fn() }) },
      uploadDocument: { useMutation: mocks.idleMutation },
      deleteDocument: { useMutation: mocks.idleMutation },
    },
  },
}));

describe("ProjectDetail H7 integrado", () => {
  beforeEach(() => {
    mocks.project.origin = "linked";
    mocks.invalidateProject.mockClear();
    mocks.refetchStatus.mockClear();
    mocks.syncMutate.mockClear();
    mocks.setLocation.mockClear();
  });

  afterEach(() => cleanup());

  it("monta la ruta vinculada con finanzas, acciones, historial navegable y sincronización manual", () => {
    render(<ProjectDetail />);

    expect(screen.getByRole("heading", { name: "Proyecto H7 Integrado" })).toBeTruthy();
    expect(screen.getByText("Construcción + QA")).toBeTruthy();
    expect(screen.getByText("Avance 31%")).toBeTruthy();
    expect(screen.getByText("Análisis y Diseño")).toBeTruthy();
    expect(screen.getByText("8/10")).toBeTruthy();
    expect(screen.getByText("Eduardo Mercado")).toBeTruthy();
    expect(screen.getByText("23 abiertos")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Vista ejecutiva del proyecto" })).toBeTruthy();
    expect(screen.getByTestId("project-executive-summary").getAttribute("data-project-id")).toBe(String(mocks.project.id));
    expect(screen.queryByText("Dashboard Ejecutivo v2 completo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Abrir Dashboard Ejecutivo" }));
    expect(mocks.setLocation).toHaveBeenCalledWith(`/projects/${mocks.project.id}/executive-dashboard-v2`);
    expect(screen.getByText("Homologación y sincronización Jira → PMO")).toBeTruthy();
    expect(screen.getByText("Historial de sincronización")).toBeTruthy();
    expect(screen.getByText("Deal4728")).toBeTruthy();
    expect(screen.getByText("Detectado en el nombre · coincide con la planilla")).toBeTruthy();
    expect(screen.getByText("Cargar Gantt contractual")).toBeTruthy();
    expect(screen.getByText("Completar mappings de backlog")).toBeTruthy();
    expect(screen.getByText("Jira 6/6 · 4 actualizados · 1 creados · 0 casos a revisar")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Sincronizar ahora/i }));

    expect(mocks.syncMutate).toHaveBeenCalledTimes(1);
    expect(mocks.syncMutate).toHaveBeenCalledWith({
      projectId: mocks.project.id,
      operationId: expect.stringMatching(/^manual:/),
    });

    fireEvent.click(screen.getByRole("button", { name: "Ver las 16 corridas" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Historial completo de sincronización Jira")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Página siguiente" })).toBeTruthy();
  });

  it("integra la misma portada ejecutiva compacta en un proyecto nativo", () => {
    mocks.project.origin = "platform";

    render(<ProjectDetail />);

    expect(screen.getByRole("heading", { name: "Vista ejecutiva del proyecto" })).toBeTruthy();
    expect(screen.getByTestId("project-executive-summary").getAttribute("data-project-id")).toBe(String(mocks.project.id));
    expect(screen.queryByText("Dashboard Ejecutivo v2 completo")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir Dashboard Ejecutivo" })).toBeTruthy();
  });
});
