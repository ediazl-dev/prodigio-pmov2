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
    project: { dealId: "Deal901" },
    onboarding: { status: "ready", jiraProjectKey: "PILOT" },
    latestRun: { status: "partial", createdAt: "2026-08-29T20:00:00.000Z", finishedAt: "2026-08-29T20:01:00.000Z" },
    latestReconciliation: historyRun,
    reconciliationHistory: [historyRun],
    counts: {
      risks: { imported: 2, mapped: 2 },
      wbs: { imported: 3, mapped: 4 },
      documents: { sow: 1, gantt: 0, milestoneAcceptances: 2 },
      openExceptions: 1,
    },
    exceptions: [{ id: 1, domain: "documents", sourceKey: "PILOT-30", reason: "El mapping no contiene una clave S3 real." }],
    pending: ["Gantt contractual [PENDIENTE]", "Backlog mapeado [POR CONFIRMAR]"],
  };

  return {
    project,
    status,
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
    mocks.invalidateProject.mockClear();
    mocks.refetchStatus.mockClear();
    mocks.syncMutate.mockClear();
    mocks.setLocation.mockClear();
  });

  afterEach(() => cleanup());

  it("monta la ruta vinculada con la tarjeta H7, historial, faltantes y acción manual", () => {
    render(<ProjectDetail />);

    expect(screen.getByRole("heading", { name: "Proyecto H7 Integrado" })).toBeTruthy();
    expect(screen.getByText("Homologación Jira → Prodigio")).toBeTruthy();
    expect(screen.getByText("Historial de sincronización")).toBeTruthy();
    expect(screen.getByText("Gantt contractual [PENDIENTE]")).toBeTruthy();
    expect(screen.getByText("Backlog mapeado [POR CONFIRMAR]")).toBeTruthy();
    expect(screen.getByText("Jira 6/6 · 4 actualizados · 1 creados · 0 excepciones")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Sincronizar ahora/i }));

    expect(mocks.syncMutate).toHaveBeenCalledTimes(1);
    expect(mocks.syncMutate).toHaveBeenCalledWith({
      projectId: mocks.project.id,
      operationId: expect.stringMatching(/^manual:/),
    });
  });
});
