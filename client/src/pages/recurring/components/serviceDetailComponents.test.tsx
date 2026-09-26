import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DashboardV2Data, MatrixRow } from "../recurringDashboardV3ViewModel";
import type { BillingPlan as BillingPlanModel, DocumentRow } from "../serviceDetailViewModel";
import { BillingPlan } from "./BillingPlan";
import { ServiceEvidenceTabs } from "./ServiceEvidenceTabs";

const service = {
  serviceId: 2100001,
  quality: { score: 80, trustedDimensions: 4, totalDimensions: 5, issues: [] },
  evidenceCoveragePercent: 80,
  healthSignals: [],
  reports: { overdue: 0 },
  formalization: { coveragePercent: 50, missing: ["sow"] },
  financeByCurrency: {
    USD: {
      currency: "USD",
      contracted: 600,
      scheduled: 564,
      invoiced: 188,
      pending: 376,
      overdue: 282,
      overdueItems: 3,
    },
  },
  incidents: { availability: "stale", observedAt: null },
  sla: { configuredRules: 4, firstResponseCompliance: null, resolutionCompliance: null },
} as unknown as MatrixRow;

const data = {
  financeAnalytics: {
    services: [
      {
        reconciliationStatus: "missing_reference",
        corporateReference: null,
        verifiedEvidenceByCurrency: [],
      },
    ],
  },
  deliverables: { rows: [] },
  documents: {
    services: [
      {
        documents: [
          {
            documentId: 10,
            docType: "contrato",
            status: "valid",
            validUntil: "2026-12-31",
            validatedAt: "2026-09-17T12:00:00.000Z",
          },
          {
            documentId: null,
            docType: "sow",
            status: "missing",
            validUntil: null,
            validatedAt: null,
          },
        ],
      },
    ],
  },
} as unknown as DashboardV2Data;

const documents: DocumentRow[] = [
  {
    id: 10,
    docType: "contrato",
    fileName: "contrato.pdf",
    fileUrl: "https://files.example/contrato.pdf",
    typeLabel: "Contrato",
    required: true,
  },
];

afterEach(cleanup);

describe("ServiceEvidenceTabs", () => {
  it("preserva estado, vigencia y faltantes documentales", () => {
    render(
      <ServiceEvidenceTabs
        data={data}
        service={service}
        documents={documents}
        onRevalidateJsm={vi.fn()}
        onOpenInitialization={vi.fn()}
        onOpenWorkPlan={vi.fn()}
      />,
    );

    expect(screen.getByText("Vigente")).toBeTruthy();
    expect(screen.getByText(/Vigencia 31-12-2026/)).toBeTruthy();
    expect(screen.getByText("sow")).toBeTruthy();
    expect(screen.getByRole("link", { name: "contrato.pdf" }).getAttribute("href")).toBe(
      "https://files.example/contrato.pdf",
    );
  });

  it("expone métricas hasta Facturado y cambia de pestaña con teclado", () => {
    render(
      <ServiceEvidenceTabs
        data={data}
        service={service}
        documents={documents}
        onRevalidateJsm={vi.fn()}
        onOpenInitialization={vi.fn()}
        onOpenWorkPlan={vi.fn()}
      />,
    );

    const evidenceTab = screen.getByRole("tab", { name: /Evidencias/ });
    fireEvent.keyDown(evidenceTab, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: /Financiero/ }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Programado")).toBeTruthy();
    expect(screen.getByText("Pendiente de facturar")).toBeTruthy();
    expect(screen.queryByText("CxC")).toBeNull();
    expect(screen.getByText("USD 282")).toBeTruthy();
  });
});

describe("BillingPlan", () => {
  it("presenta una acción de navegación honesta y entrega la cuota seleccionada", () => {
    const onRowAction = vi.fn();
    const plan = {
      rows: [
        {
          id: 7,
          monthNumber: 1,
          dueDate: "2026-06-06",
          dueLabel: "06-06-2026",
          amount: 94,
          currency: "USD",
          amountLabel: "USD 94",
          state: "vencida",
          stateLabel: "Vencida",
          missingDueDate: false,
          daysOverdue: 104,
          note: "Pendiente 104 días después del vencimiento",
          actionLabel: "Revisar cuota",
          jiraIssueKey: null,
        },
      ],
      totals: [
        {
          currency: "USD",
          contracted: 94,
          invoiced: 0,
          overdue: 94,
          overdueItems: 1,
          contractedLabel: "USD 94",
          invoicedLabel: "USD 0",
          overdueLabel: "USD 94",
        },
      ],
      missingDueDates: 0,
      planMismatch: null,
      hasRows: true,
    } satisfies BillingPlanModel;

    render(<BillingPlan plan={plan} onRowAction={onRowAction} />);
    fireEvent.click(screen.getByRole("button", { name: /Revisar cuota/ }));
    expect(onRowAction).toHaveBeenCalledWith(plan.rows[0]);
  });
});
