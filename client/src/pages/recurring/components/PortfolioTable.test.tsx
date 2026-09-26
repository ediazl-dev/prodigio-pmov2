import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortfolioTable } from "./PortfolioTable";
import type { PortfolioRow } from "../recurringDashboardV3ViewModel";

const navigate = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/recurring-services/dashboard", navigate],
}));

function serviceRow(overrides: Partial<PortfolioRow> = {}): PortfolioRow {
  return {
    serviceId: 2040001,
    serviceName: "Deal 4687_Servicio Staffing",
    clientName: "Consalud",
    dealId: "4687",
    serviceTypeKey: "staffing",
    stageKey: "jira_setup",
    health: "critical",
    overdue: {
      byCurrency: [{ currency: "USD", overdue: 480, contracted: 480, items: 3 }],
      label: "USD 480",
      items: 3,
      sortKey: 480,
      percentOfContracted: 100,
    },
    contractedLabel: "USD 480",
    overdueRatio: 100,
    signals: [
      { code: "OVERDUE_BILLING", level: "critical", message: "3 cuotas permanecen pendientes de facturar." },
      { code: "JSM_EVIDENCE_UNAVAILABLE", level: "attention", message: "JSM no disponible para medir SLA." },
    ] as PortfolioRow["signals"],
    reportsOverdue: 0,
    reportsDue: 0,
    reportsRate: null,
    formalizationCoverage: 100,
    formalizationMissing: [],
    slaFirstResponse: null,
    incidentsOpen: null,
    qualityScore: 40,
    qualityStatus: "warning",
    ...overrides,
  };
}

function renderPortfolio(overrides: Partial<React.ComponentProps<typeof PortfolioTable>> = {}) {
  return render(
    <PortfolioTable
      rows={[
        serviceRow(),
        serviceRow({
          serviceId: 2070001,
          serviceName: "Deal 4727_Servicio Staffing_Arquitectura",
          dealId: "4727",
          overdue: {
            byCurrency: [{ currency: "USD", overdue: 390, contracted: 1170, items: 2 }],
            label: "USD 390",
            items: 2,
            sortKey: 390,
            percentOfContracted: 33,
          },
          contractedLabel: "USD 1.170",
          overdueRatio: 33,
          signals: [{ code: "OVERDUE_BILLING", level: "critical", message: "2 cuotas permanecen pendientes de facturar." }] as PortfolioRow["signals"],
        }),
      ]}
      visibleLabel="2 de 3 servicios visibles"
      search=""
      onSearchChange={vi.fn()}
      clientName="all"
      onClientChange={vi.fn()}
      serviceType="all"
      onServiceTypeChange={vi.fn()}
      status="all"
      onStatusChange={vi.fn()}
      currency="all"
      onCurrencyChange={vi.fn()}
      filterOptions={{ clients: ["Consalud"], serviceTypes: ["staffing"], statuses: ["activo"], currencies: ["USD"] }}
      onClearFilters={vi.fn()}
      activeFilterCount={0}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
  navigate.mockClear();
});

describe("PortfolioTable", () => {
  it("separa cada servicio como un artículo numerado y rotulado", () => {
    renderPortfolio();

    const services = screen.getAllByRole("article");
    expect(services).toHaveLength(2);
    expect(within(services[0]).getByText("Servicio 01")).toBeTruthy();
    expect(within(services[1]).getByText("Servicio 02")).toBeTruthy();
    expect(within(services[0]).getByText("Deal 4687_Servicio Staffing")).toBeTruthy();
    expect(within(services[1]).getByText("Deal 4727_Servicio Staffing_Arquitectura")).toBeTruthy();
  });

  it("mantiene métricas y señales dentro de la tarjeta a la que pertenecen", () => {
    renderPortfolio();

    const first = screen.getAllByRole("article")[0];
    expect(within(first).getByText("Facturación vencida")).toBeTruthy();
    expect(within(first).getByText("USD 480")).toBeTruthy();
    expect(within(first).getByText("Reportes")).toBeTruthy();
    expect(within(first).getByText("Formalidad")).toBeTruthy();
    expect(within(first).getByText("Operación JSM")).toBeTruthy();
    expect(within(first).getByText("3 cuotas permanecen pendientes de facturar.")).toBeTruthy();
    expect(within(first).queryByText("2 cuotas permanecen pendientes de facturar.")).toBeNull();
  });

  it("abre exactamente el servicio seleccionado", () => {
    renderPortfolio();

    fireEvent.click(screen.getByRole("button", { name: "Abrir Deal 4727_Servicio Staffing_Arquitectura" }));
    expect(navigate).toHaveBeenCalledWith("/recurring-services/2070001");
  });

  it("expone el restablecimiento cuando existen filtros activos", () => {
    const clearFilters = vi.fn();
    renderPortfolio({ activeFilterCount: 2, onClearFilters: clearFilters });

    fireEvent.click(screen.getByRole("button", { name: "Limpiar 2 filtros" }));
    expect(clearFilters).toHaveBeenCalledTimes(1);
  });
});
