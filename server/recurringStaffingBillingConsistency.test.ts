import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./recurringServicesRouter.ts", import.meta.url), "utf8");
const execution = readFileSync(new URL("../client/src/pages/recurring/RSExecutionStage.tsx", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/RecurringServiceDetail.tsx", import.meta.url), "utf8");
const tower = readFileSync(new URL("../client/src/pages/recurring/recurringDashboardV3ViewModel.ts", import.meta.url), "utf8");

describe("Staffing: coherencia de estado operacional", () => {
  it("la Ejecución clasifica por estado Jira explícito y mantiene N/D si falta evidencia", () => {
    const endpoint = router.split("getExecutionDashboard: protectedProcedure")[1]?.split("// Sync work plan items from JIRA")[0];
    expect(endpoint).toContain("loadRecurringServiceJiraBillingEvidence(input.serviceId)");
    expect(endpoint).toContain('b.jiraBillingStatus === "billed"');
    expect(endpoint).toContain('b.jiraBillingStatus === "not_billed"');
    expect(endpoint).toContain('b.jiraBillingStatus === "unknown"');
    expect(endpoint).toContain('svc.serviceType === "staffing"');
    expect(endpoint).toContain("slaCompliancePct = null");
    expect(endpoint).toContain("obsoleteStaffingAnalysis");
    expect(endpoint).not.toContain('const totalPending = billing.filter(b => b.status === "pendiente")');
  });

  it("la vista deja fuera Cobrado y muestra No aplica o N/D sin confundir mora", () => {
    expect(execution).not.toMatch(/Pendiente Cobro|Cobrado|CxC/);
    expect(execution).toContain('SLA incidentes: No aplica');
    expect(execution).toContain('N/D · verificar emisión');
    expect(execution).toContain('jiraBillingStatus');
    expect(execution).toContain('ai?.obsolete');
  });

  it("la actualización del detalle refresca matriz y evidencia Jira en una operación", () => {
    expect(detail).toContain('Promise.all([serviceQuery.refetch(), jiraBilling.refetch(), metrics.refetch(), canonicalDocuments.refetch()])');
  });

  it("la cobertura JSM sólo considera servicios activos con SLA aplicable", () => {
    expect(tower).toContain('row.sla.applicability !== "not_applicable"');
    expect(tower).toContain('row.billingStatusUnknownRows');
  });
});
