import { and, asc, eq, sql } from "drizzle-orm";
import {
  auditLogs,
  recurringServiceBillingMonths,
  recurringServiceDocuments,
  recurringServiceJsmIssueTypeMappings,
  recurringServiceSlaConfig,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { buildStaffingContractPlan } from "../server/recurringServiceContractPolicy";
import { calculateDeadlineDate, getDb } from "../server/db";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find(value => value.startsWith(prefix))?.slice(prefix.length);
}

const serviceId = Number(argument("service-id"));
const apply = process.argv.includes("--apply");
if (!Number.isInteger(serviceId) || serviceId <= 0) {
  throw new Error("Use --service-id=<id interno positivo> y opcionalmente --apply.");
}

const db = await getDb();
if (!db) throw new Error("Database not available");
const [service] = await db.select().from(recurringServices).where(eq(recurringServices.id, serviceId)).limit(1);
if (!service) throw new Error("Servicio recurrente no encontrado.");
if (service.serviceType !== "staffing") throw new Error("La remediación sólo aplica a servicios Staffing.");
if (!service.formalStartDate) throw new Error("El servicio no tiene fecha formal de inicio.");

const [billing, documents, currentPlan, currentSla, currentMappings] = await Promise.all([
  db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId)).orderBy(asc(recurringServiceBillingMonths.monthNumber)),
  db.select().from(recurringServiceDocuments).where(eq(recurringServiceDocuments.serviceId, serviceId)),
  db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId)),
  db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId)),
  db.select().from(recurringServiceJsmIssueTypeMappings).where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId), eq(recurringServiceJsmIssueTypeMappings.status, "active"))),
]);

const sow = documents.find(document => document.docType === "sow");
if (!sow) throw new Error("No existe SoW asociado al servicio.");
if (billing.length !== service.durationMonths) throw new Error("El número de cuotas no coincide con la duración contractual.");
if (billing.some(month => month.currency !== service.currency)) throw new Error("Las cuotas no usan la moneda contractual de la ficha.");

const reportDueDates: string[] = [];
const approvalDueDates: string[] = [];
for (let month = 1; month <= service.durationMonths; month += 1) {
  const periodEnd = new Date(`${service.formalStartDate}T12:00:00Z`);
  periodEnd.setUTCMonth(periodEnd.getUTCMonth() + month);
  periodEnd.setUTCDate(periodEnd.getUTCDate() - 1);
  const reportDue = await calculateDeadlineDate(periodEnd, 3);
  const approvalDue = await calculateDeadlineDate(reportDue, 3);
  reportDueDates.push(reportDue.toISOString().slice(0, 10));
  approvalDueDates.push(approvalDue.toISOString().slice(0, 10));
}
const desiredPlan = buildStaffingContractPlan({
  durationMonths: service.durationMonths,
  reportDueDates,
  approvalDueDates,
}).map((item, index) => ({
  serviceId,
  itemType: item.itemType as "informe_mensual" | "tarea_programada",
  title: item.title,
  description: item.description ?? null,
  frequency: item.frequency ?? null,
  dueDate: item.dueDate ?? null,
  monthNumber: item.monthNumber ?? null,
  status: "pendiente" as const,
  sortOrder: index,
}));

const summary = {
  serviceId,
  dealId: service.dealId,
  serviceType: service.serviceType,
  sowDocumentId: sow.id,
  previous: { workPlan: currentPlan.length, sla: currentSla.length, activeMappings: currentMappings.length },
  desired: { workPlan: desiredPlan.length, sla: 0, activeMappings: 0, workPlanSyncMode: "external_reference", billingSyncMode: "external_reference" },
  billingPreserved: billing.map(month => ({ id: month.id, monthNumber: month.monthNumber, amount: month.amount, currency: month.currency, dueDate: month.dueDate })),
};

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", ...summary }, null, 2));
  process.exit(0);
}

await db.transaction(async tx => {
  await tx.execute(sql`SELECT id FROM recurring_services WHERE id = ${serviceId} FOR UPDATE`);
  await tx.delete(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId));
  await tx.delete(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
  await tx
    .update(recurringServiceJsmIssueTypeMappings)
    .set({ status: "superseded" as const })
    .where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId), eq(recurringServiceJsmIssueTypeMappings.status, "active")));
  await tx.insert(recurringServiceWorkPlan).values(desiredPlan);
  await tx
    .update(recurringServices)
    .set({
      jsmWorkPlanSyncMode: "external_reference",
      jsmBillingSyncMode: "external_reference",
      jsmSyncPolicyReason: "Staffing: las actividades y la facturación se administran en las fuentes Jira existentes; no crear duplicados en el Space JSM.",
      jsmSyncPolicyUpdatedAt: new Date(),
      jsmSyncPolicyUpdatedBy: null,
    })
    .where(eq(recurringServices.id, serviceId));
  await tx.insert(auditLogs).values({
    action: "remediate_staffing_contract_plan",
    entity: "recurring_service",
    entityId: String(serviceId),
    entityName: service.serviceName,
    userName: "Manus AI",
    userRole: "system",
    details: {
      authorizedBy: "Keno",
      source: "SoW asociado y diagnóstico forense aprobado",
      sowDocumentId: sow.id,
      previous: summary.previous,
      desired: summary.desired,
      preservedBillingIds: billing.map(month => month.id),
      jiraWrites: false,
    },
  });
});

const [afterService] = await db.select().from(recurringServices).where(eq(recurringServices.id, serviceId)).limit(1);
const [afterPlan, afterSla, afterMappings, afterBilling] = await Promise.all([
  db.select().from(recurringServiceWorkPlan).where(eq(recurringServiceWorkPlan.serviceId, serviceId)),
  db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId)),
  db.select().from(recurringServiceJsmIssueTypeMappings).where(and(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceId), eq(recurringServiceJsmIssueTypeMappings.status, "active"))),
  db.select().from(recurringServiceBillingMonths).where(eq(recurringServiceBillingMonths.serviceId, serviceId)),
]);
console.log(JSON.stringify({
  mode: "applied",
  serviceId,
  workPlan: afterPlan.length,
  sla: afterSla.length,
  activeMappings: afterMappings.length,
  billingPreserved: afterBilling.length === billing.length,
  workPlanSyncMode: afterService?.jsmWorkPlanSyncMode,
  billingSyncMode: afterService?.jsmBillingSyncMode,
}, null, 2));
