import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import {
  auditLogs,
  recurringServices,
  recurringServiceStages,
} from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const shouldRun = Boolean(process.env.DATABASE_URL)
  && process.env.RUN_PERSISTENT_RECURRING_STAFFING_TEST === "true";
const testServiceName = "__TEST_STAFFING_CATALOG__";

function makeCtx(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-staffing-open-id",
      email: "test-staffing@prodigio.tech",
      name: "Vitest Staffing",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

async function cleanup() {
  const db = await getDb();
  if (!db) return;

  const rows = await db.select({ id: recurringServices.id })
    .from(recurringServices)
    .where(eq(recurringServices.serviceName, testServiceName));
  const ids = rows.map(row => row.id);

  if (ids.length > 0) {
    await db.delete(recurringServiceStages).where(inArray(recurringServiceStages.serviceId, ids));
    await db.delete(recurringServices).where(inArray(recurringServices.id, ids));
  }

  await db.delete(auditLogs).where(and(
    eq(auditLogs.entity, "recurring_service"),
    eq(auditLogs.entityName, testServiceName),
  ));
}

describe.runIf(shouldRun)("persistencia aislada de servicios recurrentes Staffing", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("crea, persiste, filtra y contabiliza Staffing sin afectar otros servicios", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const before = await caller.recurringServices.dashboardKpis();

    const created = await caller.recurringServices.create({
      clientName: "Cliente de prueba aislada",
      serviceName: testServiceName,
      serviceType: "staffing",
      durationMonths: 1,
      billingType: "cuota_fija",
      fixedMonthlyAmount: 1,
      currency: "UF",
    });

    const detail = await caller.recurringServices.getById({ id: created.id });
    const filtered = await caller.recurringServices.list({ serviceType: "staffing" });
    const after = await caller.recurringServices.dashboardKpis();

    expect(detail.service).toMatchObject({
      id: created.id,
      serviceName: testServiceName,
      serviceType: "staffing",
    });
    expect(detail.stages).toHaveLength(5);
    expect(filtered.some(service => service.id === created.id)).toBe(true);
    expect(after.typeCounts.staffing).toBe((before.typeCounts.staffing ?? 0) + 1);
  });
});
