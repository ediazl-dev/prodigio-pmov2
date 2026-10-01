import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "../server/db";
import { auditLogs, recurringServices, recurringServiceSlaConfig } from "../drizzle/schema";

const serviceId = 2040001;
const backupPath = "/home/ubuntu/backups/prodigio-pmo/2026-10-01-staffing-4687/before.json";
const expectedIds = [1, 2, 3, 4];
const apply = process.argv.includes("--apply");

async function main() {
  const backup = JSON.parse(readFileSync(backupPath, "utf8"));
  if (backup.serviceId !== serviceId ||
      JSON.stringify(backup.tables.recurringServiceSlaConfig.map((row: { id: number }) => row.id).sort((a: number, b: number) => a - b)) !== JSON.stringify(expectedIds)) {
    throw new Error("Respaldo SLA no corresponde a los cuatro registros esperados de Staffing 4687");
  }
  const db = await getDb();
  if (!db) throw new Error("Base no disponible");
  const services = await db.select().from(recurringServices).where(eq(recurringServices.id, serviceId));
  const service = services[0];
  if (!service || service.serviceType !== "staffing" || !String(service.dealId ?? "").includes("4687")) {
    throw new Error("La ficha no corresponde a Staffing Deal 4687; no se modificó nada");
  }
  const current = await db.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
  const currentIds = current.map(row => row.id).sort((a, b) => a - b);
  if (currentIds.length && JSON.stringify(currentIds) !== JSON.stringify(expectedIds)) {
    throw new Error("Las reglas SLA cambiaron desde el respaldo; no se modificó nada");
  }
  if (apply && currentIds.length > 0) {
    await db.transaction(async tx => {
      const fresh = await tx.select().from(recurringServiceSlaConfig).where(eq(recurringServiceSlaConfig.serviceId, serviceId));
      if (JSON.stringify(fresh.map(row => row.id).sort((a, b) => a - b)) !== JSON.stringify(expectedIds)) throw new Error("Cambio concurrente en SLA");
      await tx.delete(recurringServiceSlaConfig).where(and(eq(recurringServiceSlaConfig.serviceId, serviceId)));
      await tx.insert(auditLogs).values({
        action: "staffing_sla_legacy_remediation", entity: "recurring_service", entityId: String(serviceId),
        entityName: service.serviceName, userName: "PMO data remediation", userRole: "system",
        details: { reason: "SoW Staffing sin SLA de incidentes/DR/24x7", removedSlaIds: expectedIds, backupPath, jiraWrites: false, billingWrites: false },
      });
    });
  }
  console.log(JSON.stringify({ serviceId, mode: apply ? "apply" : "dry-run", removedSlaIds: apply ? currentIds : [], pendingSlaIds: apply ? [] : currentIds, alreadyClean: currentIds.length === 0 }));
}
main().then(() => process.exit(0)).catch(error => { console.error(String(error)); process.exit(1); });
