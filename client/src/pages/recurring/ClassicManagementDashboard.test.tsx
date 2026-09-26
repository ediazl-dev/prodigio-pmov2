import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassicManagementDashboard } from "./ClassicManagementDashboard";
import { buildClassicManagementModel, formatSlaMinutes } from "./classicManagementViewModel";

const data = {
  metadata: {
    cutOffDate: "2026-09-26",
    latestJsmSnapshotAt: "2026-09-25T10:00:00.000Z",
  },
  kpis: {
    totalServices: 1,
    activeServices: 1,
    incidents: { availableServices: 1 },
    financeByCurrency: {
      UF: { currency: "UF", contracted: 120, scheduled: 120, invoiced: 60, pending: 60, overdue: 30, overdueItems: 1 },
    },
    reports: { due: 3, completedDue: 2, overdue: 1, deliveryRate: 66.7, onTimeRate: null },
    formalization: { complete: 1, partial: 0, missing: 0 },
    sla: { configuredServices: 1, availableServices: 1, firstResponseCompliance: 95, resolutionCompliance: 80 },
  },
  trends: {
    finance: [
      { month: "2026-08", currency: "UF", scheduled: 60, invoiced: 60, pending: 0, overdue: 0 },
      { month: "2026-09", currency: "UF", scheduled: 60, invoiced: 0, pending: 60, overdue: 30 },
    ],
  },
  financeAnalytics: {
    summary: { reconciledServices: 1, verifiedInvoiceEvidence: 1 },
    services: [
      {
        serviceId: 1,
        clientName: "Cliente A",
        serviceName: "Soporte Plataforma",
        dealId: "1000",
        reconciliationStatus: "missing_reference",
        localCurrencies: [{ currency: "UF", scheduled: 120, invoiced: 60, overdue: 30 }],
        corporateReference: null,
      },
    ],
  },
  deliverables: { periods: [] },
  documents: {
    summary: { present: 0, missing: 2, expiredOrRejected: 0, pendingValidation: 0 },
    services: [],
  },
  operations: {
    summary: {
      measuredServices: 1,
      unmeasuredServices: 0,
      total: 12,
      resolved: 11,
      open: 1,
      resolutionRate: 91.7,
      criticalOpen: 0,
      highOpen: 1,
      overdueOpen: 1,
      unresolvedOver30Days: 0,
    },
    monthly: [
      { month: "2026-08", total: 10, resolved: 8, open: 2, criticalOpen: 0, overdueOpen: 1, servicesMeasured: 1 },
      { month: "2026-09", total: 12, resolved: 11, open: 1, criticalOpen: 0, overdueOpen: 1, servicesMeasured: 1 },
    ],
    pendingServices: [
      {
        serviceId: 1,
        clientName: "Cliente A",
        serviceName: "Soporte Plataforma",
        observedAt: "2026-09-25T10:00:00.000Z",
        open: 1,
        criticalOpen: 0,
        highOpen: 1,
        overdueOpen: 1,
        unresolvedOver30Days: 0,
        slaRules: [
          { priority: "high", firstResponseMinutes: 30, resolutionMinutes: 240, coverageType: "24x7", customCoverageDescription: null },
        ],
      },
    ],
  },
  matrix: [
    {
      serviceId: 1,
      clientName: "Cliente A",
      serviceName: "Soporte Plataforma",
      status: "activo",
      currentStage: "ejecucion",
      serviceType: "soporte_incidentes",
      financeByCurrency: {
        UF: { currency: "UF", contracted: 120, scheduled: 120, invoiced: 60, pending: 60, overdue: 30, overdueItems: 1 },
      },
      incidents: { availability: "available", total: 12, open: 1, criticalOpen: 0, highOpen: 1, overdueOpen: 1, unresolvedOver30Days: 0 },
      sla: { configuredRules: 1, firstResponseCompliance: 95, resolutionCompliance: 80 },
      reports: { due: 3, completedDue: 2, overdue: 1, deliveryRate: 66.7 },
      healthSignals: [],
    },
  ],
} as any;

const legacy = {
  statusCounts: { total: 1, activo: 1, pausado: 0, completado: 0, cancelado: 0 },
  typeCounts: { soporte_incidentes: 1 },
  penalties: { total: 1, amount: 5, byStatus: { aplicada: 1 } },
  servicesSummary: [
    { id: 1, penaltiesCount: 1, penaltiesAmount: 5, currency: "UF" },
  ],
} as any;

afterEach(cleanup);

describe("classicManagementViewModel", () => {
  it("mantiene monedas separadas y calcula resueltos desde evidencia JSM", () => {
    const model = buildClassicManagementModel(data, legacy);
    expect(model.finance).toEqual([
      expect.objectContaining({ currency: "UF", contracted: 120, invoiced: 60, pending: 60, invoicingProgress: 50 }),
    ]);
    expect(model.services[0].incidents).toMatchObject({ total: 12, resolved: 11, open: 1 });
    expect(model.incidentMonthly.at(-1)).toMatchObject({ month: "2026-09", resolved: 11, open: 1 });
  });

  it("formatea tiempos SLA sin inventar unidades", () => {
    expect(formatSlaMinutes(null)).toBe("N/D");
    expect(formatSlaMinutes(30)).toBe("30 min");
    expect(formatSlaMinutes(240)).toBe("4 h");
    expect(formatSlaMinutes(250)).toBe("4 h 10 min");
  });
});

describe("ClassicManagementDashboard", () => {
  it("muestra finanzas, incidentes, SLA y tabla final sin distribución por etapa", () => {
    const onOpenService = vi.fn();
    render(<ClassicManagementDashboard data={data} legacy={legacy} onOpenService={onOpenService} />);

    expect(screen.getByText("Cartera recurrente: contrato, facturación y operación")).toBeTruthy();
    expect(screen.getByText("Monto comprometido")).toBeTruthy();
    expect(screen.getByText("Facturado total")).toBeTruthy();
    expect(screen.getByText("Incidentes resueltos")).toBeTruthy();
    expect(screen.getByText("Pendientes operativos y SLA configurado")).toBeTruthy();
    expect(screen.getByText("Respuesta 30 min · Resolución 4 h")).toBeTruthy();
    expect(screen.getByText("Información consolidada de la cartera")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Financiero/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Entregables/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Formalidad/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: /Operación JSM/ })).toBeTruthy();
    expect(screen.getByText("Resumen por servicio")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Operación JSM/ }));
    expect(screen.getByText("Incidentes, antigüedad y cumplimiento SLA")).toBeTruthy();
    expect(screen.queryByText("Distribución por Etapa")).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Ver servicio" })[0]);
    expect(onOpenService).toHaveBeenCalledWith(1);
  });

  it("muestra N/D si falta el valor contractual aunque exista programación", () => {
    const withoutContract = {
      ...data,
      kpis: {
        ...data.kpis,
        financeByCurrency: {
          UF: { ...data.kpis.financeByCurrency.UF, contracted: 0 },
        },
      },
    } as any;
    render(<ClassicManagementDashboard data={withoutContract} legacy={legacy} onOpenService={() => undefined} />);
    expect(screen.getByText("UF N/D")).toBeTruthy();
  });
});
