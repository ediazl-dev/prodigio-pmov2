import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateDocxMutateAsync: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    projects: {
      get: { useQuery: () => ({ data: { projectName: "Proyecto DOCX", startDate: null, endDate: null }, isLoading: false }) },
    },
    advance: {
      getReport: { useQuery: () => ({ data: {
        projectKey: "PDOCX", percentComplete: 50, totalIssues: 12, doneCount: 6, inProgressCount: 4, toDoCount: 2,
        lastUpdated: new Date().toISOString(), epics: [], milestones: [], risks: [], scopeChanges: [], team: [], byStatus: [], byType: [],
      }, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() }) },
      generateSummary: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      generatePptx: { useMutation: () => ({ mutateAsync: vi.fn() }) },
      generateDocx: { useMutation: () => ({ mutateAsync: mocks.generateDocxMutateAsync }) },
    },
    stages: {
      getAll: { useQuery: () => ({ data: [] }) },
      getClosure: { useQuery: () => ({ data: null }) },
      formalClose: { useMutation: () => ({ mutateAsync: vi.fn() }) },
    },
    stageOpenings: { timeRemaining: { useQuery: () => ({ data: [] }) } },
  },
}));

vi.mock("wouter", () => ({ useParams: () => ({ id: "42" }), useLocation: () => ["/projects/42/advance", vi.fn()], Link: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/StageLayout", () => ({ default: ({ headerRight, children }: { headerRight: React.ReactNode; children: React.ReactNode }) => <main>{headerRight}{children}</main> }));
vi.mock("@/components/StageClosurePanel", () => ({ default: () => null }));
vi.mock("@/components/AppBreadcrumb", () => ({ default: () => null }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }));

import AvanceStage from "./AvanceStage";

describe("AvanceStage — descarga DOCX", () => {
  afterEach(() => {
    mocks.generateDocxMutateAsync.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
    vi.restoreAllMocks();
  });

  it("invoca la mutación DOCX y dispara una descarga usando la URL y nombre retornados", async () => {
    mocks.generateDocxMutateAsync.mockResolvedValue({
      success: true,
      url: "https://storage.example/avance-prodigio.docx",
      fileName: "Reporte_Proyecto_DOCX.docx",
    });
    const clickedAnchors: Array<{ href: string; download: string; target: string }> = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clickedAnchors.push({ href: this.href, download: this.download, target: this.target });
    });

    render(<AvanceStage />);
    fireEvent.click(screen.getByRole("button", { name: "Descargar DOCX" }));

    await waitFor(() => expect(mocks.generateDocxMutateAsync).toHaveBeenCalledWith({ projectId: 42, summary: undefined }));
    await waitFor(() => expect(clickedAnchors).toEqual([{
      href: "https://storage.example/avance-prodigio.docx",
      download: "Reporte_Proyecto_DOCX.docx",
      target: "_blank",
    }]));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Reporte generado: Reporte_Proyecto_DOCX.docx");
  });
});
