import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { JiraBillingEvidencePanel, type JiraBillingEvidenceData } from "./JiraBillingEvidencePanel";

const evidence: JiraBillingEvidenceData = {
  entityType: "recurring_service",
  entityId: 2100001,
  dealId: "2383",
  jiraAvailable: true,
  loadedAt: "2026-09-28T20:00:00.000Z",
  evidenceAt: "2026-09-25T20:00:00.000-0300",
  sourceProjectKeys: ["CAMANSOP01"],
  field: { id: "customfield_11237", name: "Estado de Facturación" },
  summary: {
    totalItems: 2,
    billedItems: 1,
    notBilledItems: 1,
    unknownItems: 0,
    duplicateGroups: 1,
    amountCoverage: { withAmount: 2, total: 2 },
    billedByCurrency: [{ currency: "UF", amount: 94, items: 1 }],
    notBilledByCurrency: [{ currency: "UF", amount: 94, items: 1 }],
  },
  items: [
    {
      key: "CAMANSOP01-20",
      jiraUrl: "https://jira.example/browse/CAMANSOP01-20",
      code: "M01",
      title: "Cuota mes 1",
      monthNumber: 1,
      amount: 94,
      currency: "UF",
      amountSource: "billing_schedule",
      dueDate: "2026-07-06",
      jiraDueDate: "2026-07-06",
      jiraUpdatedAt: "2026-09-25T20:00:00.000-0300",
      jiraStatusName: "Completed",
      jiraStatusCategory: "done",
      billingStatus: "billed",
      billingStatusLabel: "Facturado según ticket Jira",
      billingStatusSource: "jira_billing_issue_status",
      billingFieldValues: [],
      matchedBy: "month",
      duplicateCandidates: ["CAMANSOP01-3"],
    },
    {
      key: "CAMANSOP01-23",
      jiraUrl: "https://jira.example/browse/CAMANSOP01-23",
      code: "M02",
      title: "Cuota mes 2",
      monthNumber: 2,
      amount: 94,
      currency: "UF",
      amountSource: "billing_schedule",
      dueDate: "2026-10-07",
      jiraDueDate: "2026-10-07",
      jiraUpdatedAt: "2026-09-25T20:00:00.000-0300",
      jiraStatusName: "Waiting for support",
      jiraStatusCategory: "new",
      billingStatus: "not_billed",
      billingStatusLabel: "Pendiente según ticket Jira",
      billingStatusSource: "jira_billing_issue_status",
      billingFieldValues: [],
      matchedBy: "month",
      duplicateCandidates: [],
    },
  ],
  warnings: ["M01: 1 candidato Jira adicional no sumado."],
};

afterEach(cleanup);

describe("JiraBillingEvidencePanel", () => {
  it("muestra facturación Jira por moneda y no afirma SII ni cobro", () => {
    render(<JiraBillingEvidencePanel evidence={evidence} />);
    expect(screen.getByText("Facturación operacional por hito")).toBeTruthy();
    expect(screen.getAllByText("UF 94").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Facturado según ticket Jira")).toBeTruthy();
    expect(screen.getByText("Pendiente según ticket Jira")).toBeTruthy();
    expect(screen.getByRole("link", { name: /CAMANSOP01-20/ }).getAttribute("href")).toBe("https://jira.example/browse/CAMANSOP01-20");
    expect(screen.queryByText(/Cobrado/i)).toBeNull();
    expect(screen.getByText(/No equivale a factura tributaria/i)).toBeTruthy();
    expect(screen.getByText(/workflow sólo en tickets inequívocos de facturación/i)).toBeTruthy();
  });

  it("expone duplicados sin sumarlos", () => {
    render(<JiraBillingEvidencePanel evidence={evidence} />);
    expect(screen.getByText("1 grupo(s) con duplicados")).toBeTruthy();
    expect(screen.getByText("1 duplicado(s) no sumado(s)")).toBeTruthy();
  });
});
