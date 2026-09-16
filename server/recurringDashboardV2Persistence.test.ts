import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  recurringServiceBillingMonths,
  recurringServiceDocumentControls,
  recurringServiceDocuments,
  recurringServiceFinancialEvidence,
  recurringServiceJsmSnapshots,
  recurringServiceReportEvidence,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { getDb } from "./db";

const shouldRunPersistent =
  Boolean(process.env.DATABASE_URL) &&
  process.env.RUN_PERSISTENT_RECURRING_DASHBOARD_V2_TEST === "true";

const serviceName = "__TEST_RECURRING_DASHBOARD_V2__";

async function cleanup() {
  const db = await getDb();
  if (!db) return;

  const services = await db
    .select({ id: recurringServices.id })
    .from(recurringServices)
    .where(eq(recurringServices.serviceName, serviceName));
  const serviceIds = services.map(service => service.id);
  if (serviceIds.length === 0) return;

  await db
    .delete(recurringServiceJsmSnapshots)
    .where(inArray(recurringServiceJsmSnapshots.serviceId, serviceIds));
  await db
    .delete(recurringServiceFinancialEvidence)
    .where(inArray(recurringServiceFinancialEvidence.serviceId, serviceIds));
  await db
    .delete(recurringServiceReportEvidence)
    .where(inArray(recurringServiceReportEvidence.serviceId, serviceIds));
  await db
    .delete(recurringServiceDocumentControls)
    .where(inArray(recurringServiceDocumentControls.serviceId, serviceIds));
  await db
    .delete(recurringServiceDocuments)
    .where(inArray(recurringServiceDocuments.serviceId, serviceIds));
  await db
    .delete(recurringServiceWorkPlan)
    .where(inArray(recurringServiceWorkPlan.serviceId, serviceIds));
  await db
    .delete(recurringServiceBillingMonths)
    .where(inArray(recurringServiceBillingMonths.serviceId, serviceIds));
  await db.delete(recurringServices).where(inArray(recurringServices.id, serviceIds));
}

describe.runIf(shouldRunPersistent)(
  "D2 persistencia aislada del Dashboard de Servicios Recurrentes V2",
  () => {
    beforeEach(cleanup);
    afterEach(cleanup);

    it("persiste evidencia documental, mensual, financiera y JSM sin duplicar períodos ni snapshots", async () => {
      const db = await getDb();
      expect(db).toBeTruthy();
      if (!db) throw new Error("Database not available");

      const [serviceResult] = await db.insert(recurringServices).values({
        clientName: "Cliente D2",
        dealId: `D2-${Date.now()}`,
        serviceName,
        serviceType: "staffing",
        durationMonths: 1,
        billingType: "cuota_fija",
        fixedMonthlyAmount: "10.00",
        totalContractAmount: "10.00",
        currency: "UF",
        createdBy: 1,
      });
      const serviceId = Number(serviceResult.insertId);

      const [documentResult] = await db.insert(recurringServiceDocuments).values({
        serviceId,
        docType: "contrato",
        fileName: "contrato-d2.pdf",
        fileUrl: "https://example.invalid/contrato-d2.pdf",
        fileKey: `tests/d2/${serviceId}/contrato-d2.pdf`,
        uploadedBy: 1,
      });
      const documentId = Number(documentResult.insertId);

      await db.insert(recurringServiceDocumentControls).values({
        serviceId,
        documentId,
        validationStatus: "valid",
        validFrom: "2026-09-01",
        validUntil: "2026-09-30",
        validatedAt: new Date("2026-09-16T12:00:00.000Z"),
        validatedBy: 1,
      });

      const [workPlanResult] = await db.insert(recurringServiceWorkPlan).values({
        serviceId,
        itemType: "informe_mensual",
        title: "Informe mensual septiembre",
        monthNumber: 1,
        dueDate: "2026-09-30",
      });
      const workPlanItemId = Number(workPlanResult.insertId);

      const reportRow = {
        serviceId,
        workPlanItemId,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        dueDate: "2026-09-30",
        status: "accepted" as const,
        deliveredAt: new Date("2026-09-29T12:00:00.000Z"),
        acceptedAt: new Date("2026-09-30T12:00:00.000Z"),
        evidenceDocumentId: documentId,
        source: "manual" as const,
        recordedBy: 1,
      };
      await db.insert(recurringServiceReportEvidence).values(reportRow);
      await expect(
        db.insert(recurringServiceReportEvidence).values(reportRow)
      ).rejects.toBeTruthy();

      const [billingResult] = await db.insert(recurringServiceBillingMonths).values({
        serviceId,
        monthNumber: 1,
        dueDate: "2026-09-30",
        amount: "10.00",
        currency: "UF",
      });
      const billingMonthId = Number(billingResult.insertId);

      await db.insert(recurringServiceFinancialEvidence).values([
        {
          serviceId,
          billingMonthId,
          evidenceType: "invoice",
          status: "confirmed",
          amount: "10.00",
          currency: "UF",
          occurredAt: new Date("2026-09-30T12:00:00.000Z"),
          referenceNumber: "INV-D2-1",
          source: "manual",
          sourceReference: `D2-INVOICE-${serviceId}`,
          recordedBy: 1,
        },
        {
          serviceId,
          billingMonthId,
          evidenceType: "payment",
          status: "confirmed",
          amount: "10.00",
          currency: "UF",
          occurredAt: new Date("2026-10-05T12:00:00.000Z"),
          referenceNumber: "PAY-D2-1",
          source: "manual",
          sourceReference: `D2-PAYMENT-${serviceId}`,
          recordedBy: 1,
        },
      ]);

      const snapshot = {
        serviceId,
        serviceDeskId: "D2-SD",
        projectKey: "D2",
        capturedAt: new Date("2026-09-16T12:00:00.000Z"),
        source: "manual" as const,
        status: "success" as const,
        incidentCount: 4,
        openIncidentCount: 1,
        criticalOpenCount: 0,
        firstResponseMeasuredCount: 4,
        firstResponseMetCount: 4,
        firstResponseCompliancePct: "100.00",
        resolutionMeasuredCount: 3,
        resolutionMetCount: 2,
        resolutionCompliancePct: "66.67",
        dataFingerprint: "d".repeat(64),
        triggeredBy: 1,
      };
      await db.insert(recurringServiceJsmSnapshots).values(snapshot);
      await expect(
        db.insert(recurringServiceJsmSnapshots).values(snapshot)
      ).rejects.toBeTruthy();

      const controls = await db
        .select()
        .from(recurringServiceDocumentControls)
        .where(eq(recurringServiceDocumentControls.serviceId, serviceId));
      const reports = await db
        .select()
        .from(recurringServiceReportEvidence)
        .where(eq(recurringServiceReportEvidence.serviceId, serviceId));
      const financialEvidence = await db
        .select()
        .from(recurringServiceFinancialEvidence)
        .where(eq(recurringServiceFinancialEvidence.serviceId, serviceId));
      const snapshots = await db
        .select()
        .from(recurringServiceJsmSnapshots)
        .where(eq(recurringServiceJsmSnapshots.serviceId, serviceId));

      expect(controls).toHaveLength(1);
      expect(controls[0]?.validationStatus).toBe("valid");
      expect(reports).toHaveLength(1);
      expect(reports[0]?.status).toBe("accepted");
      expect(financialEvidence.map(row => row.evidenceType).sort()).toEqual([
        "invoice",
        "payment",
      ]);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0]?.resolutionCompliancePct).toBe("66.67");
    });
  }
);
