import { describe, expect, it } from "vitest";
import { afterAll } from "vitest";
import { inArray, and, eq } from "drizzle-orm";
import {
  auditLogs,
  recurringServiceAiAnalyses,
  recurringServiceBillingMonths,
  recurringServiceDocumentControls,
  recurringServiceDocuments,
  recurringServiceFinancialEvidence,
  recurringServiceJsmIssueTypeMappings,
  recurringServiceJsmLinkRuns,
  recurringServiceJsmSnapshots,
  recurringServiceJsmSyncRuns,
  recurringServicePenalties,
  recurringServiceReportEvidence,
  recurringServiceSlaConfig,
  recurringServiceStages,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { getDb } from "./db";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const createdTestServiceIds = new Set<number>();

afterAll(async () => {
  const serviceIds = Array.from(createdTestServiceIds);
  if (serviceIds.length === 0) return;
  const db = await getDb();
  if (!db) return;

  await db.delete(recurringServiceDocumentControls).where(inArray(recurringServiceDocumentControls.serviceId, serviceIds));
  await db.delete(recurringServiceReportEvidence).where(inArray(recurringServiceReportEvidence.serviceId, serviceIds));
  await db.delete(recurringServiceFinancialEvidence).where(inArray(recurringServiceFinancialEvidence.serviceId, serviceIds));
  await db.delete(recurringServiceJsmSnapshots).where(inArray(recurringServiceJsmSnapshots.serviceId, serviceIds));
  await db.delete(recurringServiceJsmIssueTypeMappings).where(inArray(recurringServiceJsmIssueTypeMappings.serviceId, serviceIds));
  await db.delete(recurringServiceJsmSyncRuns).where(inArray(recurringServiceJsmSyncRuns.serviceId, serviceIds));
  await db.delete(recurringServiceJsmLinkRuns).where(inArray(recurringServiceJsmLinkRuns.serviceId, serviceIds));
  await db.delete(recurringServicePenalties).where(inArray(recurringServicePenalties.serviceId, serviceIds));
  await db.delete(recurringServiceAiAnalyses).where(inArray(recurringServiceAiAnalyses.serviceId, serviceIds));
  await db.delete(recurringServiceWorkPlan).where(inArray(recurringServiceWorkPlan.serviceId, serviceIds));
  await db.delete(recurringServiceSlaConfig).where(inArray(recurringServiceSlaConfig.serviceId, serviceIds));
  await db.delete(recurringServiceBillingMonths).where(inArray(recurringServiceBillingMonths.serviceId, serviceIds));
  await db.delete(recurringServiceDocuments).where(inArray(recurringServiceDocuments.serviceId, serviceIds));
  await db.delete(recurringServiceStages).where(inArray(recurringServiceStages.serviceId, serviceIds));
  await db
    .delete(auditLogs)
    .where(
      and(
        eq(auditLogs.entity, "recurring_service"),
        inArray(auditLogs.entityId, serviceIds.map(String))
      )
    );
  await db.delete(recurringServices).where(inArray(recurringServices.id, serviceIds));
});

// ─── Helpers ───────────────────────────────────────────────────────────────
function makeCtx(role: "admin" | "pmo" | "pm" | "consulta" = "admin"): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-open-id",
      email: "test@prodigio.tech",
      name: "Test User",
      loginMethod: "manus",
      role,
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

function makeUnauthCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
      cookie: () => {},
    } as unknown as TrpcContext["res"],
  };
}

// ─── Router existence tests ─────────────────────────────────────────────────
describe("recurringServices router", () => {
  it("router is registered in appRouter", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices).toBeDefined();
  });

  it("has list procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.list).toBeDefined();
  });

  it("has getById procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.getById).toBeDefined();
  });

  it("has create procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.create).toBeDefined();
  });

  it("has getStages procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.getStages).toBeDefined();
  });

  it("has saveBillingPlan procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.saveBillingPlan).toBeDefined();
  });

  it("has generateWorkPlan procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.generateWorkPlan).toBeDefined();
  });

  it("has saveSlaConfig procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.saveSlaConfig).toBeDefined();
  });

  it("has setPlatformChoice procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.setPlatformChoice).toBeDefined();
  });

  it("has getExecutionDashboard procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.getExecutionDashboard).toBeDefined();
  });

  it("has generateAiExecutiveSummary procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.generateAiExecutiveSummary).toBeDefined();
  });

  it("has createPenalty and uploadPenaltyEvidence procedures", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.createPenalty).toBeDefined();
    expect(caller.recurringServices.uploadPenaltyEvidence).toBeDefined();
  });

  it("has closeService procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.closeService).toBeDefined();
  });

  it("has D9 JSM refresh history and manual refresh procedures", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.jsmRefreshHistory).toBeDefined();
    expect(caller.recurringServices.refreshJsmSnapshot).toBeDefined();
    expect(caller.recurringServices.refreshJsmSnapshots).toBeDefined();
  });
});

// ─── Auth / Access control tests ────────────────────────────────────────────
describe("recurringServices access control", () => {
  it("list requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.list()).rejects.toThrow();
  });

  it("create requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(
      caller.recurringServices.create({
        clientName: "Test Client",
        serviceName: "Test Service",
        serviceType: "soporte_incidentes",
        durationMonths: 12,
        billingType: "cuota_fija",
      })
    ).rejects.toThrow();
  });

  it("consulta role cannot create services", async () => {
    const caller = appRouter.createCaller(makeCtx("consulta"));
    await expect(
      caller.recurringServices.create({
        clientName: "Test Client",
        serviceName: "Test Service",
        serviceType: "soporte_incidentes",
        durationMonths: 12,
        billingType: "cuota_fija",
      })
    ).rejects.toThrow();
  });

  it("admin role can list services", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const result = await caller.recurringServices.list();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("pmo role can list services", async () => {
    const caller = appRouter.createCaller(makeCtx("pmo"));
    const result = await caller.recurringServices.list();
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("D9 history requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.jsmRefreshHistory()).rejects.toThrow();
  });

  it.each(["consulta", "pm"] as const)(
    "%s can read D9 history but cannot trigger a JSM refresh",
    async role => {
      const caller = appRouter.createCaller(makeCtx(role));
      const history = await caller.recurringServices.jsmRefreshHistory({ limit: 5 });
      expect(Array.isArray(history.runs)).toBe(true);
      await expect(
        caller.recurringServices.refreshJsmSnapshots({ serviceIds: [] })
      ).rejects.toThrow();
    }
  );
});

// ─── CRUD tests ─────────────────────────────────────────────────────────────
describe("recurringServices CRUD", () => {
  it("can create and retrieve a service", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const created = await caller.recurringServices.create({
      clientName: "Acme Corp",
      serviceName: "Soporte N1",
      serviceType: "soporte_incidentes",
      durationMonths: 12,
      billingType: "cuota_fija",
      fixedMonthlyAmount: 5000,
      currency: "USD",
    });
    expect(created).toBeDefined();
    expect(created.id).toBeGreaterThan(0);
    createdTestServiceIds.add(created.id);

    const fetched = await caller.recurringServices.getById({ id: created.id });
    expect(fetched).toBeDefined();
    expect(fetched.service.clientName).toBe("Acme Corp");
    expect(fetched.service.serviceName).toBe("Soporte N1");
    expect(fetched.service.serviceType).toBe("soporte_incidentes");
    expect(fetched.service.durationMonths).toBe(12);
    expect(fetched.service.billingType).toBe("cuota_fija");
    expect(fetched.service.status).toBe("activo");
    expect(fetched.service.currentStage).toBe("inicializacion");
  });

  it("can list services and find the created one", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    expect(list.length).toBeGreaterThan(0);
    const found = list.find((s: any) => s.serviceName === "Soporte N1");
    expect(found).toBeDefined();
  });

  it("getById returns stages", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list[0];
    const detail = await caller.recurringServices.getById({ id: svc.id });
    expect(detail.service).toBeDefined();
  });

  it("getStages returns 5 stages", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list[0];
    const stages = await caller.recurringServices.getStages({ serviceId: svc.id });
    expect(stages).toBeDefined();
    expect(stages.length).toBe(5);
    const stageIds = stages.map((s: any) => s.stageId);
    expect(stageIds).toContain("inicializacion");
    expect(stageIds).toContain("plan_trabajo");
    expect(stageIds).toContain("jira_setup");
    expect(stageIds).toContain("ejecucion");
    expect(stageIds).toContain("cierre");
  });
});

// ─── Billing plan tests ─────────────────────────────────────────────────────
describe("recurringServices billing plan", () => {
  it("can save billing plan for a service", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    expect(svc).toBeDefined();

    const months = Array.from({ length: 12 }, (_, i) => ({
      monthNumber: i + 1,
      label: `Mes ${i + 1}`,
      amount: 5000,
      status: "pendiente" as const,
    }));

    await caller.recurringServices.saveBillingPlan({
      serviceId: svc!.id,
      months,
    });

    // Verify via getById
    const detail = await caller.recurringServices.getById({ id: svc!.id });
    expect(detail.billingMonths).toBeDefined();
    expect(detail.billingMonths.length).toBe(12);
    expect(detail.billingMonths[0].amount).toBeDefined();
  });
});

// ─── Execution dashboard tests ──────────────────────────────────────────────
describe("recurringServices execution dashboard", () => {
  it("returns dashboard with metrics", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    expect(svc).toBeDefined();

    const dashboard = await caller.recurringServices.getExecutionDashboard({ serviceId: svc!.id });
    expect(dashboard).toBeDefined();
    expect(dashboard.service).toBeDefined();
    expect(dashboard.billing).toBeDefined();
    expect(dashboard.workItems).toBeDefined();
    expect(dashboard.sla).toBeDefined();
    expect(dashboard.penalties).toBeDefined();
    expect(dashboard.metrics).toBeDefined();
    expect(dashboard.metrics.totalBilled).toBeDefined();
    expect(dashboard.metrics.totalPending).toBeDefined();
    expect(dashboard.metrics.completionRate).toBeDefined();
    expect(dashboard.metrics.monthsElapsed).toBeDefined();
  });
});

// ─── Stage pipeline tests ───────────────────────────────────────────────────
describe("recurringServices stage pipeline", () => {
  it("initialization stage starts as in_progress", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    const stages = await caller.recurringServices.getStages({ serviceId: svc!.id });
    const init = stages.find((s: any) => s.stageId === "inicializacion");
    expect(init?.status).toBe("in_progress");
  });

  it("plan_trabajo stage starts as locked", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    const stages = await caller.recurringServices.getStages({ serviceId: svc!.id });
    const plan = stages.find((s: any) => s.stageId === "plan_trabajo");
    expect(plan?.status).toBe("locked");
  });

  it("cannot close initialization without step1 confirmed", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    // Should fail because step1 not confirmed yet
    await expect(caller.recurringServices.closeInitializationStage({ serviceId: svc!.id })).rejects.toThrow();
  });

  it("can confirm step 1 after billing plan exists", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    await caller.recurringServices.confirmInitStep1({ serviceId: svc!.id });
    const detail = await caller.recurringServices.getById({ id: svc!.id });
    expect(detail.service.initStep1Confirmed).toBe(true);
  });

  it("cannot close initialization without documents", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    // Step1 confirmed but no docs and no dealId
    await expect(caller.recurringServices.closeInitializationStage({ serviceId: svc!.id })).rejects.toThrow();
  });

  it("can close initialization after full 2-step flow", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");

    // Upload a document
    const fakeBase64 = Buffer.from("test-content").toString("base64");
    await caller.recurringServices.uploadDocument({
      serviceId: svc!.id,
      docType: "propuesta_tecnica",
      fileName: "propuesta.pdf",
      fileBase64: fakeBase64,
      mimeType: "application/pdf",
    });

    // Sync Pipedrive (now uses real API - deal 1996)
    const syncResult = await caller.recurringServices.syncPipedrive({
      serviceId: svc!.id,
      dealId: "1996",
    });
    expect(syncResult.contactName).toBeTruthy();
    expect(syncResult.dealValue).toBeGreaterThan(0);

    // Now close should work
    await caller.recurringServices.closeInitializationStage({ serviceId: svc!.id });

    const stages = await caller.recurringServices.getStages({ serviceId: svc!.id });
    const init = stages.find((s: any) => s.stageId === "inicializacion");
    const plan = stages.find((s: any) => s.stageId === "plan_trabajo");
    expect(init?.status).toBe("completed");
    expect(plan?.status).toBe("in_progress");
  }, 30000);
});

// ─── Pipedrive API integration tests ────────────────────────────────────────
describe("recurringServices Pipedrive integration", () => {
  it("syncPipedrive returns full deal data from API", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    if (!svc) return; // Skip if no service exists
    const result = await caller.recurringServices.syncPipedrive({
      serviceId: svc.id,
      dealId: "1996",
    });
    expect(result.contactName).toBeDefined();
    expect(result.contactEmail).toBeDefined();
    expect(result.orgName).toBeDefined();
    expect(result.dealValue).toBeDefined();
    expect(result.dealCurrency).toBeDefined();
    expect(result.dealStatus).toBeDefined();
    expect(result.opportunityStartDate).toBeDefined();
    expect(result.activitiesCount).toBeGreaterThanOrEqual(0);
    expect(result.emailsCount).toBeGreaterThanOrEqual(0);
    expect(result.notesCount).toBeGreaterThanOrEqual(0);
    expect(result.flowSummary).toBeDefined();
  }, 30000);

  it("syncPipedrive fails with invalid deal ID", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    if (!svc) return;
    await expect(
      caller.recurringServices.syncPipedrive({ serviceId: svc.id, dealId: "999999999" })
    ).rejects.toThrow();
  }, 15000);

  it("syncPipedrive fails with non-numeric deal ID", async () => {
    const caller = appRouter.createCaller(makeCtx("admin"));
    const list = await caller.recurringServices.list();
    const svc = list.find((s: any) => s.serviceName === "Soporte N1");
    if (!svc) return;
    await expect(
      caller.recurringServices.syncPipedrive({ serviceId: svc.id, dealId: "abc" })
    ).rejects.toThrow();
  }, 15000);
});

// ─── Dashboard KPIs tests ──────────────────────────────────────────────────
describe("recurringServices dashboardKpis", () => {
  it("has dashboardKpis procedure", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.dashboardKpis).toBeDefined();
  });

  it("returns KPI structure with all expected fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const kpis = await caller.recurringServices.dashboardKpis();

    // Status counts
    expect(kpis.statusCounts).toBeDefined();
    expect(typeof kpis.statusCounts.total).toBe("number");
    expect(typeof kpis.statusCounts.activo).toBe("number");
    expect(typeof kpis.statusCounts.pausado).toBe("number");
    expect(typeof kpis.statusCounts.completado).toBe("number");
    expect(typeof kpis.statusCounts.cancelado).toBe("number");

    // Type counts
    expect(kpis.typeCounts).toBeDefined();
    expect(typeof kpis.typeCounts).toBe("object");

    // Stage counts
    expect(kpis.stageCounts).toBeDefined();
    expect(typeof kpis.stageCounts).toBe("object");

    // Billing
    expect(kpis.billing).toBeDefined();
    expect(kpis.billing.currentMonth).toBeDefined();
    expect(typeof kpis.billing.currentMonth.total).toBe("number");
    expect(typeof kpis.billing.currentMonth.invoiced).toBe("number");
    expect(kpis.billing.currentMonth).not.toHaveProperty("paid");
    expect(typeof kpis.billing.currentMonth.pending).toBe("number");
    expect(kpis.billing.overall).toBeDefined();
    expect(typeof kpis.billing.overall.total).toBe("number");
    expect(typeof kpis.billing.overall.invoiced).toBe("number");
    expect(kpis.billing.overall).not.toHaveProperty("paid");
    expect(typeof kpis.billing.overall.pending).toBe("number");
    expect(kpis.billing.monthly).toBeDefined();
    expect(Array.isArray(kpis.billing.monthly)).toBe(true);
    expect(kpis.billing.monthly.length).toBe(6);
    for (const m of kpis.billing.monthly) {
      expect(m.month).toMatch(/^\d{4}-\d{2}$/);
      expect(typeof m.facturado).toBe("number");
      expect(typeof m.pendiente).toBe("number");
      expect(m).not.toHaveProperty("pagado");
    }

    // SLA
    expect(kpis.sla).toBeDefined();
    expect(typeof kpis.sla.complianceRate).toBe("number");
    expect(kpis.sla.complianceRate).toBeGreaterThanOrEqual(0);
    expect(kpis.sla.complianceRate).toBeLessThanOrEqual(100);
    expect(typeof kpis.sla.activeWithSla).toBe("number");
    expect(typeof kpis.sla.activeTotal).toBe("number");
    expect(typeof kpis.sla.totalRules).toBe("number");

    // Penalties
    expect(kpis.penalties).toBeDefined();
    expect(typeof kpis.penalties.total).toBe("number");
    expect(typeof kpis.penalties.amount).toBe("number");

    // Services summary
    expect(kpis.servicesSummary).toBeDefined();
    expect(Array.isArray(kpis.servicesSummary)).toBe(true);
  }, 15000);

  it("servicesSummary items have billing and SLA info", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const kpis = await caller.recurringServices.dashboardKpis();

    for (const svc of kpis.servicesSummary) {
      expect(svc.id).toBeDefined();
      expect(svc.serviceName).toBeDefined();
      expect(svc.clientName).toBeDefined();
      expect(svc.status).toBeDefined();
      expect(svc.currentStage).toBeDefined();
      expect(typeof svc.billingTotal).toBe("number");
      expect(typeof svc.billingInvoiced).toBe("number");
      expect(svc).not.toHaveProperty("billingPaid");
      expect(typeof svc.billingPending).toBe("number");
      expect(typeof svc.billingProgress).toBe("number");
      expect(svc.billingProgress).toBeGreaterThanOrEqual(0);
      expect(svc.billingProgress).toBeLessThanOrEqual(100);
      expect(typeof svc.hasSla).toBe("boolean");
      expect(typeof svc.penaltiesCount).toBe("number");
      expect(typeof svc.penaltiesAmount).toBe("number");
    }
  }, 15000);

  it("statusCounts total matches sum of individual statuses", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const kpis = await caller.recurringServices.dashboardKpis();
    const sum = kpis.statusCounts.activo + kpis.statusCounts.pausado + kpis.statusCounts.completado + kpis.statusCounts.cancelado;
    expect(sum).toBe(kpis.statusCounts.total);
  }, 15000);

  it("statusCounts total matches servicesSummary length", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const kpis = await caller.recurringServices.dashboardKpis();
    expect(kpis.statusCounts.total).toBe(kpis.servicesSummary.length);
  }, 15000);

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.dashboardKpis()).rejects.toThrow();
  });
});

// ─── JSM Issues Summary & Re-sync ────────────────────────────────────────
describe("recurringServices.getJiraIssuesSummary", () => {
  it("returns issues summary structure", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list[0];
    const summary = await caller.recurringServices.getJiraIssuesSummary({ serviceId: svc.id });
    expect(summary).toHaveProperty("totalSynced");
    expect(summary).toHaveProperty("totalUnsynced");
    expect(summary).toHaveProperty("totalWorkItems");
    expect(summary).toHaveProperty("totalBilling");
    expect(summary).toHaveProperty("syncedWorkItems");
    expect(summary).toHaveProperty("syncedBilling");
    expect(summary).toHaveProperty("unsyncedWorkItems");
    expect(summary).toHaveProperty("unsyncedBilling");
    expect(Array.isArray(summary.syncedWorkItems)).toBe(true);
    expect(Array.isArray(summary.syncedBilling)).toBe(true);
  }, 15000);

  it("totalSynced + totalUnsynced = totalWorkItems + totalBilling", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list[0];
    const summary = await caller.recurringServices.getJiraIssuesSummary({ serviceId: svc.id });
    expect(summary.totalSynced + summary.totalUnsynced).toBe(summary.totalWorkItems + summary.totalBilling);
  }, 15000);

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.getJiraIssuesSummary({ serviceId: 1 })).rejects.toThrow();
  });
});

describe("recurringServices.resyncJsmTasks", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.resyncJsmTasks({ serviceId: 1 })).rejects.toThrow();
  });
});

describe("recurringServices.closeJiraSetupStage validation", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.closeJiraSetupStage({ serviceId: 1 })).rejects.toThrow();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Iteración 54: JIRA work plan sync + AI persistence
// ═══════════════════════════════════════════════════════════════════════════

describe("recurringServices.getWorkPlanFromJira", () => {
  it("returns work items and billing items with JIRA status", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list.find((s: any) => s.jsmProjectKey);
    if (!svc) return;
    const result = await caller.recurringServices.getWorkPlanFromJira({ serviceId: svc.id });
    expect(result).toHaveProperty("workItems");
    expect(result).toHaveProperty("billingItems");
    expect(result).toHaveProperty("jiraUnavailable");
    if (!result.jiraUnavailable) {
      expect(result).toHaveProperty("jiraStats");
      expect(result.jiraStats).toHaveProperty("total");
      expect(result.jiraStats).toHaveProperty("done");
      expect(result.jiraStats).toHaveProperty("inProgress");
      expect(result.jiraStats).toHaveProperty("todo");
      expect(result.jiraStats).toHaveProperty("completionRate");
      // Each work item should have JIRA fields
      if (result.workItems.length > 0) {
        const item = result.workItems[0];
        expect(item).toHaveProperty("jiraIssueKey");
        expect(item).toHaveProperty("jiraStatus");
        expect(item).toHaveProperty("jiraStatusCategory");
        expect(item).toHaveProperty("jiraAssignee");
        expect(item).toHaveProperty("jiraDueDate");
        expect(item).toHaveProperty("jiraSummary");
      }
    }
  }, 30000);

  it("returns jiraUnavailable for service without JSM project", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list.find((s: any) => !s.jsmProjectKey);
    if (!svc) return;
    const result = await caller.recurringServices.getWorkPlanFromJira({ serviceId: svc.id });
    expect(result.jiraUnavailable).toBe(true);
    expect(result.workItems).toEqual([]);
    expect(result.billingItems).toEqual([]);
  }, 15000);

  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.getWorkPlanFromJira({ serviceId: 1 })).rejects.toThrow();
  });
});

describe("recurringServices.getExecutionDashboard AI analysis", () => {
  it("returns aiAnalysis object with persistence fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list[0];
    const result = await caller.recurringServices.getExecutionDashboard({ serviceId: svc.id });
    expect(result).toHaveProperty("aiAnalysis");
    expect(result.aiAnalysis).toHaveProperty("healthStatus");
    expect(result.aiAnalysis).toHaveProperty("abstract");
    expect(result.aiAnalysis).toHaveProperty("daysOld");
    expect(result.aiAnalysis).toHaveProperty("expired");
    expect(typeof result.aiAnalysis.expired).toBe("boolean");
  }, 15000);

  it("includes metrics with contractProgress and completionRate", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const list = await caller.recurringServices.list();
    if (list.length === 0) return;
    const svc = list[0];
    const result = await caller.recurringServices.getExecutionDashboard({ serviceId: svc.id });
    expect(result.metrics).toHaveProperty("contractProgress");
    expect(result.metrics).toHaveProperty("completionRate");
    expect(result.metrics).toHaveProperty("monthsElapsed");
    expect(result.metrics).toHaveProperty("monthsRemaining");
  }, 15000);
});

describe("recurringServices.getOrRefreshAiAnalysis", () => {
  it("requires authentication", async () => {
    const caller = appRouter.createCaller(makeUnauthCtx());
    await expect(caller.recurringServices.getOrRefreshAiAnalysis({ serviceId: 1 })).rejects.toThrow();
  });

  it("has getWorkPlanFromJira procedure registered", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.getWorkPlanFromJira).toBeDefined();
  });

  it("has getOrRefreshAiAnalysis procedure registered", () => {
    const caller = appRouter.createCaller(makeCtx());
    expect(caller.recurringServices.getOrRefreshAiAnalysis).toBeDefined();
  });
});
