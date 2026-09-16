import { describe, expect, it } from "vitest";
import { diagnoseRecurringServicesQuality, normalizeRecurringDealId } from "./recurringServicesQualityEngine";

const service = {
  id: 1,
  clientName: "Cliente",
  serviceName: "Servicio Staffing",
  dealId: "Deal 2383",
  serviceType: "soporte_incidentes",
  currency: "usd",
  totalContractAmount: "200",
  pipedriveDealCurrency: "USD",
  pipedriveDealAmount: "200",
  jsmProjectKey: "ABC",
  jsmProjectId: "10",
  jsmServiceDeskId: null,
  jsmLinkHealth: null,
};

describe("normalizeRecurringDealId", () => {
  it("normaliza prefijos y separadores sin perder la identidad", () => {
    expect(normalizeRecurringDealId(" Deal-2 383 ")).toBe("2383");
    expect(normalizeRecurringDealId("2383")).toBe("2383");
    expect(normalizeRecurringDealId(null)).toBeNull();
  });
});

describe("diagnoseRecurringServicesQuality", () => {
  it("detecta Staffing mal clasificado y propone una corrección sustentada", () => {
    const result = diagnoseRecurringServicesQuality({
      services: [service],
      billingMonths: [{ serviceId: 1, amount: "200", currency: "USD" }],
      documents: [{ serviceId: 1, docType: "contrato" }, { serviceId: 1, docType: "sow" }],
      financialReferences: [{ id: 1, dealId: "Deal2383", clientName: "Cliente", projectName: "Proyecto", valorVentaUF: "10" }],
    });

    expect(result.services[0].status).toBe("blocked");
    expect(result.services[0].confirmedCorrections).toEqual([
      expect.objectContaining({ field: "serviceType", proposedValue: "staffing" }),
    ]);
    expect(result.services[0].issues.map(issue => issue.code)).toContain("STAFFING_NAME_TYPE_MISMATCH");
  });

  it("mantiene como advertencia la ausencia de conciliación financiera y JSM", () => {
    const result = diagnoseRecurringServicesQuality({
      services: [{ ...service, serviceName: "Soporte", serviceType: "soporte_incidentes", dealId: "9999", jsmProjectKey: null }],
      billingMonths: [{ serviceId: 1, amount: "200", currency: "USD" }],
      documents: [{ serviceId: 1, docType: "contrato" }, { serviceId: 1, docType: "sow" }],
      financialReferences: [],
    });

    expect(result.services[0].status).toBe("warning");
    expect(result.services[0].issues.map(issue => issue.code)).toEqual(expect.arrayContaining(["DEAL_NOT_RECONCILED", "JSM_NOT_LINKED"]));
    expect(result.services[0].confirmedCorrections).toHaveLength(0);
  });

  it("bloquea métricas financieras cuando contrato, cuotas o monedas no cuadran", () => {
    const result = diagnoseRecurringServicesQuality({
      services: [{ ...service, serviceName: "Soporte", serviceType: "soporte_incidentes", totalContractAmount: "250" }],
      billingMonths: [{ serviceId: 1, amount: "200", currency: "CLP" }],
      documents: [{ serviceId: 1, docType: "contrato" }, { serviceId: 1, docType: "sow" }],
      financialReferences: [],
    });

    expect(result.services[0].status).toBe("blocked");
    expect(result.services[0].issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      "BILLING_CURRENCY_MISMATCH",
      "CONTRACT_BILLING_PLAN_MISMATCH",
    ]));
  });

  it("no compara directamente montos UF corporativos con contratos en USD", () => {
    const result = diagnoseRecurringServicesQuality({
      services: [{ ...service, serviceName: "Soporte", serviceType: "soporte_incidentes" }],
      billingMonths: [{ serviceId: 1, amount: "200", currency: "USD" }],
      documents: [{ serviceId: 1, docType: "contrato" }, { serviceId: 1, docType: "sow" }],
      financialReferences: [{ id: 1, dealId: "2383", clientName: "Cliente", projectName: "Proyecto", valorVentaUF: "200" }],
    });

    expect(result.services[0].issues).toContainEqual(expect.objectContaining({
      code: "FINANCIAL_REFERENCE_UF_NOT_DIRECTLY_COMPARABLE",
      severity: "info",
    }));
  });

  it("propone completar moneda solo cuando Pipedrive entrega evidencia no contradictoria", () => {
    const result = diagnoseRecurringServicesQuality({
      services: [{ ...service, currency: null }],
      billingMonths: [{ serviceId: 1, amount: "200", currency: "USD" }],
      documents: [{ serviceId: 1, docType: "contrato" }, { serviceId: 1, docType: "sow" }],
      financialReferences: [],
    });

    expect(result.services[0].confirmedCorrections).toContainEqual(expect.objectContaining({ field: "currency", proposedValue: "USD" }));
  });
});
