/**
 * tRPC Router for Recurring Services module.
 * Covers all 5 stages: Inicialización, Plan de Trabajo, JIRA Setup, Ejecución, Cierre.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { createAuditLog } from "./db";
import { buildJsmProjectUrls, createJiraSpace, createJiraIssue, CreateIssueInput, listJsmServiceDesks, searchJiraIssues } from "./jiraClient";
import { listRecurringServices, getRecurringServiceById, createRecurringService, updateRecurringService, getRecurringServiceStages, getRecurringServiceStage, completeRecurringStage, getBillingMonths, saveBillingMonths, updateBillingMonthStatus, updateBillingMonthJiraKey, getServiceDocuments, insertServiceDocument, deleteServiceDocument, getWorkPlanItems, insertWorkPlanItem, updateWorkPlanItem, deleteWorkPlanItem, bulkInsertWorkPlanItems, updateWorkPlanItemJiraKey, deleteAllWorkPlanItems, getSlaConfig, saveSlaConfig, getPenalties, insertPenalty, updatePenaltyJiraKey, updatePenaltyStatus, getDashboardKpisData, getRecurringDashboardV2Data, insertAiAnalysis, getLatestAiAnalysis, getAiAnalysisHistory, listActiveJsmIssueTypeMappings, saveRecurringJsmSnapshot, RecurringServiceJsmDbError } from "./recurringServicesDb";
import { nanoid } from "nanoid";
import { recurringServiceTypeSchema } from "../shared/recurringServiceTypes";
import { getExistingJsmLinkState, JsmExistingSpaceRunnerError, linkExistingJsmSpace, listExistingJsmSpaces, preflightExistingJsmSpace, revalidateExistingJsmSpace, unlinkExistingJsmSpace } from "./jsmExistingSpaceLinkRunner";
import { associateExistingJiraIssue, calculateJsmSetupReadiness, configureJsmIssueTypeMappings, confirmJsmSync, dryRunJsmSync, getJsmSyncConfiguration, JsmRecurringSyncError } from "./jsmRecurringSyncRunner";
import { buildRecurringServicesDashboardV2 } from "./recurringServicesDashboardV2";
import { collectRecurringJsmSnapshot } from "./recurringServicesJsmSnapshot";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const adminOrPmo = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "pmo"].includes(ctx.user.role))
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Requiere rol Admin o PMO",
    });
  return next({ ctx });
});

function audit(ctx: { user: { id: number; name: string | null; role: string } }, action: string, entity: string, entityId?: string | number | null, entityName?: string | null, details?: Record<string, any> | null) {
  return createAuditLog({
    action,
    entity,
    entityId,
    entityName,
    userId: ctx.user.id,
    userName: ctx.user.name ?? "Unknown",
    userRole: ctx.user.role,
    details,
  });
}

function throwExistingJsmError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof JsmExistingSpaceRunnerError || error instanceof RecurringServiceJsmDbError) {
    throw new TRPCError({
      code: error.code === "SERVICE_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

function throwJsmSyncError(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  if (error instanceof JsmRecurringSyncError || error instanceof RecurringServiceJsmDbError) {
    throw new TRPCError({
      code: error.code === "SERVICE_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const recurringServicesRouter = router({
  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD Base
  // ═══════════════════════════════════════════════════════════════════════════

  list: protectedProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          serviceType: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listRecurringServices(input ?? undefined);
    }),

  dashboardKpis: protectedProcedure.query(async () => {
    const { services, billingMonths, slaConfigs, penalties } = await getDashboardKpisData();

    // ── Status counts ──
    const statusCounts = {
      total: services.length,
      activo: 0,
      pausado: 0,
      completado: 0,
      cancelado: 0,
    };
    for (const s of services) {
      if (s.status in statusCounts) (statusCounts as any)[s.status]++;
    }

    // ── Type distribution ──
    const typeCounts: Record<string, number> = {};
    for (const s of services) {
      typeCounts[s.serviceType] = (typeCounts[s.serviceType] || 0) + 1;
    }

    // ── Total contract value ──
    let totalContractValue = 0;
    let totalContractCurrency = "USD";
    for (const s of services) {
      if (s.totalContractAmount) totalContractValue += parseFloat(String(s.totalContractAmount));
      if (s.currency) totalContractCurrency = s.currency; // use last found
    }

    // ── Billing / Revenue metrics ──
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // Monthly billing for last 6 months
    const monthlyBilling: {
      month: string;
      facturado: number;
      pagado: number;
      pendiente: number;
    }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const monthBills = billingMonths.filter((b: any) => b.dueDate && b.dueDate.startsWith(key));
      let facturado = 0,
        pagado = 0,
        pendiente = 0;
      for (const b of monthBills) {
        const amt = parseFloat(String(b.amount)) || 0;
        if (b.status === "pagado") pagado += amt;
        else if (b.status === "facturado") facturado += amt;
        else pendiente += amt;
      }
      monthlyBilling.push({ month: key, facturado, pagado, pendiente });
    }

    // Current month totals
    const currentMonthBills = billingMonths.filter((b: any) => b.dueDate && b.dueDate.startsWith(currentMonth));
    let currentMonthTotal = 0,
      currentMonthPaid = 0,
      currentMonthPending = 0;
    for (const b of currentMonthBills) {
      const amt = parseFloat(String(b.amount)) || 0;
      currentMonthTotal += amt;
      if (b.status === "pagado") currentMonthPaid += amt;
      else currentMonthPending += amt;
    }

    // Overall billing totals
    let totalBilled = 0,
      totalPaid = 0,
      totalPending = 0;
    for (const b of billingMonths) {
      const amt = parseFloat(String(b.amount)) || 0;
      totalBilled += amt;
      if (b.status === "pagado") totalPaid += amt;
      else if (b.status === "facturado") {
        /* facturado but not paid */
      } else totalPending += amt;
    }

    // ── SLA compliance ──
    // Count services that have SLA config vs total active services
    const activeServiceIds = new Set(services.filter((s: any) => s.status === "activo").map((s: any) => s.id));
    const servicesWithSla = new Set(slaConfigs.map((c: any) => c.serviceId));
    const activeWithSla = Array.from(activeServiceIds).filter(id => servicesWithSla.has(id)).length;
    const slaComplianceRate = activeServiceIds.size > 0 ? Math.round((activeWithSla / activeServiceIds.size) * 100) : 0;

    // SLA config summary
    const totalSlaRules = slaConfigs.length;
    const slaByPriority: Record<string, number> = {};
    for (const c of slaConfigs) {
      slaByPriority[c.priority] = (slaByPriority[c.priority] || 0) + 1;
    }

    // ── Penalties ──
    const totalPenalties = penalties.length;
    let penaltyAmount = 0;
    const penaltyByStatus: Record<string, number> = {};
    for (const p of penalties) {
      if (p.amount) penaltyAmount += parseFloat(String(p.amount));
      penaltyByStatus[p.status] = (penaltyByStatus[p.status] || 0) + 1;
    }

    // ── Stage distribution ──
    const stageCounts: Record<string, number> = {};
    for (const s of services) {
      stageCounts[s.currentStage] = (stageCounts[s.currentStage] || 0) + 1;
    }

    // ── Per-service summary ──
    const servicesSummary = services.map((s: any) => {
      const svcBilling = billingMonths.filter((b: any) => b.serviceId === s.id);
      const svcPaid = svcBilling.filter((b: any) => b.status === "pagado").reduce((sum: number, b: any) => sum + (parseFloat(String(b.amount)) || 0), 0);
      const svcTotal = svcBilling.reduce((sum: number, b: any) => sum + (parseFloat(String(b.amount)) || 0), 0);
      const svcPending = svcTotal - svcPaid;
      const hasSla = servicesWithSla.has(s.id);
      const svcPenalties = penalties.filter((p: any) => p.serviceId === s.id);
      return {
        id: s.id,
        serviceName: s.serviceName,
        clientName: s.clientName,
        status: s.status,
        currentStage: s.currentStage,
        serviceType: s.serviceType,
        durationMonths: s.durationMonths,
        currency: s.currency || "USD",
        billingTotal: svcTotal,
        billingPaid: svcPaid,
        billingPending: svcPending,
        billingProgress: svcTotal > 0 ? Math.round((svcPaid / svcTotal) * 100) : 0,
        hasSla,
        penaltiesCount: svcPenalties.length,
        penaltiesAmount: svcPenalties.reduce((sum: number, p: any) => sum + (parseFloat(String(p.amount)) || 0), 0),
      };
    });

    return {
      statusCounts,
      typeCounts,
      stageCounts,
      totalContractValue,
      totalContractCurrency,
      billing: {
        currentMonth: {
          total: currentMonthTotal,
          paid: currentMonthPaid,
          pending: currentMonthPending,
        },
        overall: { total: totalBilled, paid: totalPaid, pending: totalPending },
        monthly: monthlyBilling,
      },
      sla: {
        complianceRate: slaComplianceRate,
        activeWithSla,
        activeTotal: activeServiceIds.size,
        totalRules: totalSlaRules,
        byPriority: slaByPriority,
      },
      penalties: {
        total: totalPenalties,
        amount: penaltyAmount,
        byStatus: penaltyByStatus,
      },
      servicesSummary,
    };
  }),

  dashboardV2: protectedProcedure
    .input(
      z
        .object({
          cutOffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          clientName: z.string().min(1).optional(),
          status: z.string().min(1).optional(),
          serviceType: recurringServiceTypeSchema.optional(),
          health: z.enum(["critical", "attention", "stable", "no_data"]).optional(),
          currency: z.string().min(1).max(10).optional(),
          search: z.string().max(200).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const source = await getRecurringDashboardV2Data();
      const cutOffDate = input?.cutOffDate ?? new Date().toISOString().slice(0, 10);
      return buildRecurringServicesDashboardV2(source as any, {
        cutOffDate,
        filters: {
          clientName: input?.clientName,
          status: input?.status,
          serviceType: input?.serviceType,
          health: input?.health,
          currency: input?.currency,
          search: input?.search,
        },
      });
    }),

  refreshJsmSnapshot: adminOrPmo
    .input(z.object({ serviceId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const service = await getRecurringServiceById(input.serviceId);
      if (!service) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Servicio recurrente no encontrado" });
      }

      const snapshot = await collectRecurringJsmSnapshot({
        service: {
          id: service.id,
          jsmProjectKey: service.jsmProjectKey,
          jsmServiceDeskId: service.jsmServiceDeskId,
        },
        source: "manual",
        triggeredBy: ctx.user.id,
      });
      const persisted = await saveRecurringJsmSnapshot(snapshot);

      await audit(ctx, "recurring_service_jsm_snapshot_refresh", "recurring_service", service.id, service.serviceName, {
        snapshotId: persisted.id,
        created: persisted.created,
        snapshotStatus: snapshot.status,
        incidentCount: snapshot.incidentCount,
        openIncidentCount: snapshot.openIncidentCount,
        criticalOpenCount: snapshot.criticalOpenCount,
        overdueIncidentCount: snapshot.overdueIncidentCount,
        dataFingerprint: snapshot.dataFingerprint,
      });

      return { snapshot, persisted };
    }),

  refreshJsmSnapshots: adminOrPmo
    .input(z.object({ serviceIds: z.array(z.number().int().positive()).max(100).optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const services = await listRecurringServices();
      const requestedIds = input?.serviceIds ? new Set(input.serviceIds) : null;
      const eligible = services.filter(
        service =>
          service.status === "activo" &&
          (!requestedIds || requestedIds.has(service.id)) &&
          Boolean(service.jsmProjectKey && service.jsmServiceDeskId),
      );
      const skipped = services.filter(
        service =>
          service.status === "activo" &&
          (!requestedIds || requestedIds.has(service.id)) &&
          !(service.jsmProjectKey && service.jsmServiceDeskId),
      );

      const results = [];
      for (const service of eligible) {
        const snapshot = await collectRecurringJsmSnapshot({
          service: {
            id: service.id,
            jsmProjectKey: service.jsmProjectKey,
            jsmServiceDeskId: service.jsmServiceDeskId,
          },
          source: "manual",
          triggeredBy: ctx.user.id,
        });
        const persisted = await saveRecurringJsmSnapshot(snapshot);
        results.push({
          serviceId: service.id,
          serviceName: service.serviceName,
          status: snapshot.status,
          errorMessage: snapshot.errorMessage,
          incidentCount: snapshot.incidentCount,
          openIncidentCount: snapshot.openIncidentCount,
          criticalOpenCount: snapshot.criticalOpenCount,
          firstResponseCompliancePct: snapshot.firstResponseCompliancePct,
          resolutionCompliancePct: snapshot.resolutionCompliancePct,
          snapshotId: persisted.id,
          created: persisted.created,
        });
      }

      await audit(ctx, "recurring_service_jsm_portfolio_refresh", "recurring_service_portfolio", null, "Dashboard recurrente V2", {
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        successCount: results.filter(result => result.status === "success").length,
        partialCount: results.filter(result => result.status === "partial").length,
        errorCount: results.filter(result => result.status === "error").length,
        serviceIds: eligible.map(service => service.id),
      });

      return {
        eligibleCount: eligible.length,
        skippedCount: skipped.length,
        successCount: results.filter(result => result.status === "success").length,
        partialCount: results.filter(result => result.status === "partial").length,
        errorCount: results.filter(result => result.status === "error").length,
        skippedServices: skipped.map(service => ({ id: service.id, serviceName: service.serviceName })),
        results,
      };
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const service = await getRecurringServiceById(input.id);
    if (!service)
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Servicio no encontrado",
      });
    const stages = await getRecurringServiceStages(input.id);
    const billingMonths = await getBillingMonths(input.id);
    const documents = await getServiceDocuments(input.id);
    return { service, stages, billingMonths, documents };
  }),

  create: adminOrPmo
    .input(
      z.object({
        clientName: z.string().min(1),
        serviceName: z.string().min(1),
        serviceType: recurringServiceTypeSchema,
        durationMonths: z.number().min(1).max(120),
        billingType: z.enum(["cuota_fija", "cuotas_variables"]),
        fixedMonthlyAmount: z.number().optional(),
        currency: z.string().default("USD"),
        estimatedStartDate: z.string().optional(),
        dealId: z.string().optional(),
        pmId: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await createRecurringService({
        ...input,
        fixedMonthlyAmount: input.fixedMonthlyAmount ? String(input.fixedMonthlyAmount) : undefined,
        createdBy: ctx.user.id,
      });
      await audit(ctx, "create", "recurring_service", id, input.serviceName, {
        clientName: input.clientName,
        serviceType: input.serviceType,
      });
      return { id };
    }),

  update: adminOrPmo
    .input(
      z.object({
        id: z.number(),
        data: z.object({
          clientName: z.string().optional(),
          serviceName: z.string().optional(),
          serviceType: recurringServiceTypeSchema.optional(),
          durationMonths: z.number().optional(),
          billingType: z.enum(["cuota_fija", "cuotas_variables"]).optional(),
          fixedMonthlyAmount: z.number().optional(),
          currency: z.string().optional(),
          estimatedStartDate: z.string().optional(),
          dealId: z.string().optional(),
          pmId: z.number().optional(),
          status: z.enum(["activo", "pausado", "completado", "cancelado"]).optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.id);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      const updateData: any = { ...input.data };
      if (input.data.fixedMonthlyAmount !== undefined) {
        updateData.fixedMonthlyAmount = String(input.data.fixedMonthlyAmount);
      }
      await updateRecurringService(input.id, updateData);
      await audit(ctx, "update", "recurring_service", input.id, svc.serviceName, { fields: Object.keys(input.data) });
    }),

  updateStatus: adminOrPmo
    .input(
      z.object({
        id: z.number(),
        status: z.enum(["activo", "pausado", "completado", "cancelado"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.id);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      await updateRecurringService(input.id, { status: input.status });
      await audit(ctx, "status_change", "recurring_service", input.id, svc.serviceName, { from: svc.status, to: input.status });
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Stages
  // ═══════════════════════════════════════════════════════════════════════════

  getStages: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
    return getRecurringServiceStages(input.serviceId);
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 1: Inicialización
  // ═══════════════════════════════════════════════════════════════════════════

  saveBillingPlan: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        months: z.array(
          z.object({
            monthNumber: z.number(),
            dueDate: z.string().optional(),
            amount: z.number(),
            currency: z.string().default("USD"),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      await saveBillingMonths(
        input.serviceId,
        input.months.map(m => ({
          serviceId: input.serviceId,
          monthNumber: m.monthNumber,
          dueDate: m.dueDate,
          amount: String(m.amount),
          currency: m.currency,
        }))
      );
      await audit(ctx, "save_billing_plan", "recurring_service", input.serviceId, svc.serviceName, { monthCount: input.months.length });
    }),

  uploadDocument: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        docType: z.enum(["propuesta_tecnica", "pl", "sow", "contrato", "otro"]),
        fileName: z.string(),
        fileBase64: z.string(),
        mimeType: z.string().default("application/pdf"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      const buffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `recurring-services/${input.serviceId}/docs/${nanoid()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, buffer, input.mimeType);
      const docId = await insertServiceDocument({
        serviceId: input.serviceId,
        docType: input.docType,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        uploadedBy: ctx.user.id,
      });
      await audit(ctx, "upload_document", "recurring_service", input.serviceId, svc.serviceName, { docType: input.docType, fileName: input.fileName });
      return { id: docId, url };
    }),

  deleteDocument: adminOrPmo.input(z.object({ serviceId: z.number(), documentId: z.number() })).mutation(async ({ ctx, input }) => {
    await deleteServiceDocument(input.documentId);
    await audit(ctx, "delete_document", "recurring_service", input.serviceId, null, { documentId: input.documentId });
  }),

  syncPipedrive: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        dealId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });

      const dealIdNum = parseInt(input.dealId, 10);
      if (isNaN(dealIdNum))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Deal ID debe ser un número válido",
        });

      // Fetch real data from Pipedrive API
      const { syncDealComplete } = await import("./pipedriveClient");
      let syncResult;
      try {
        syncResult = await syncDealComplete(dealIdNum);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Error al conectar con Pipedrive: ${msg}`,
        });
      }

      // Persist all synced data
      await updateRecurringService(input.serviceId, {
        dealId: input.dealId,
        pipedrivePersonName: syncResult.contactName || null,
        pipedrivePersonEmail: syncResult.contactEmail || null,
        pipedrivePersonPhone: syncResult.contactPhone || null,
        pipedriveDealAmount: syncResult.dealValue ? String(syncResult.dealValue) : null,
        pipedriveDealCreatedAt: syncResult.opportunityStartDate?.split(" ")[0] || null,
        pipedriveDealClosedAt: syncResult.opportunityCloseDate?.split(" ")[0] || null,
        pipedriveInteractionCount: syncResult.activitiesCount + syncResult.emailsCount,
        pipedriveOrgName: syncResult.orgName || null,
        pipedriveOrgAddress: syncResult.orgAddress || null,
        pipedriveDealStatus: syncResult.dealStatus || null,
        pipedriveDealCurrency: syncResult.dealCurrency || null,
        pipedriveEmailsCount: syncResult.emailsCount,
        pipedriveNotesCount: syncResult.notesCount,
        pipedriveNotesRaw: syncResult.notes.length > 0 ? JSON.stringify(syncResult.notes) : null,
        pipedriveFlowSummary: JSON.stringify(syncResult.flowSummary),
        pipedriveSyncedAt: new Date(),
      });

      await audit(ctx, "pipedrive_sync", "recurring_service", input.serviceId, svc.serviceName, {
        dealId: input.dealId,
        source: "pipedrive_api",
        activitiesCount: syncResult.activitiesCount,
        emailsCount: syncResult.emailsCount,
        notesCount: syncResult.notesCount,
      });

      return {
        contactName: syncResult.contactName,
        contactEmail: syncResult.contactEmail,
        contactPhone: syncResult.contactPhone,
        orgName: syncResult.orgName,
        orgAddress: syncResult.orgAddress,
        dealValue: syncResult.dealValue,
        dealCurrency: syncResult.dealCurrency,
        dealStatus: syncResult.dealStatus,
        opportunityStartDate: syncResult.opportunityStartDate,
        opportunityCloseDate: syncResult.opportunityCloseDate,
        activitiesCount: syncResult.activitiesCount,
        doneActivitiesCount: syncResult.doneActivitiesCount,
        emailsCount: syncResult.emailsCount,
        notesCount: syncResult.notesCount,
        flowSummary: syncResult.flowSummary,
      };
    }),

  generatePipedriveAiSummary: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    if (!svc.dealId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No hay Deal ID de Pipedrive vinculado",
      });

    // Parse stored notes and flow summary for richer AI context
    let notesText = "Sin notas disponibles";
    if (svc.pipedriveNotesRaw) {
      try {
        const notes = JSON.parse(svc.pipedriveNotesRaw as string) as {
          content: string;
          date: string;
        }[];
        notesText = notes.map((n, i) => `Nota ${i + 1} (${n.date}): ${n.content}`).join("\n");
      } catch {
        notesText = "Error al parsear notas";
      }
    }

    let flowText = "Sin resumen de flujo";
    if (svc.pipedriveFlowSummary) {
      try {
        const flow = JSON.parse(svc.pipedriveFlowSummary as string);
        const actTypes = Object.entries(flow.activityTypes || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ");
        const emailSubjects = (flow.emailSubjects || []).slice(0, 10).join(", ");
        flowText = `Actividades: ${flow.totalActivities}, Emails: ${flow.totalEmails}, Notas: ${flow.totalNotes}, Cambios: ${flow.totalChanges}\nTipos de actividad: ${actTypes}\nTemas de email: ${emailSubjects}`;
      } catch {
        flowText = "Error al parsear flujo";
      }
    }

    const prompt = `Eres un analista de CRM senior de Prodigio Tech. Analiza la siguiente información REAL del deal de Pipedrive para un servicio recurrente y genera:
1. Un resumen ejecutivo del deal (2-3 párrafos) incluyendo la dinámica comercial
2. Cantidad total de interacciones realizadas para cerrar el deal y un análisis de la intensidad comercial
3. Preocupaciones o riesgos del cliente detectados a partir de las notas y emails
4. Recomendaciones concretas para la gestión del servicio

Datos del deal:
- Cliente: ${svc.clientName}
- Organización: ${svc.pipedriveOrgName ?? "N/A"} (${svc.pipedriveOrgAddress ?? "N/A"})
- Servicio: ${svc.serviceName}
- Tipo: ${svc.serviceType}
- Duración: ${svc.durationMonths} meses
- Contacto: ${svc.pipedrivePersonName ?? "N/A"} (${svc.pipedrivePersonEmail ?? "N/A"}, Tel: ${svc.pipedrivePersonPhone ?? "N/A"})
- Monto deal: ${svc.pipedriveDealAmount ?? "N/A"} ${svc.pipedriveDealCurrency ?? svc.currency}
- Estado: ${svc.pipedriveDealStatus ?? "N/A"}
- Fecha creación deal: ${svc.pipedriveDealCreatedAt ?? "N/A"}
- Fecha cierre deal: ${svc.pipedriveDealClosedAt ?? "N/A"}
- Total interacciones: ${svc.pipedriveInteractionCount ?? 0} (${svc.pipedriveEmailsCount ?? 0} emails, ${svc.pipedriveNotesCount ?? 0} notas)

Resumen de flujo del deal:
${flowText}

Notas del deal:
${notesText}

Responde en español con formato JSON:
{
  "summary": "...",
  "clientConcerns": "...",
  "recommendations": "..."
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Eres un analista CRM senior de Prodigio Tech. Responde siempre en español.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "pipedrive_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              summary: {
                type: "string",
                description: "Resumen ejecutivo del deal",
              },
              clientConcerns: {
                type: "string",
                description: "Preocupaciones del cliente",
              },
              recommendations: {
                type: "string",
                description: "Recomendaciones",
              },
            },
            required: ["summary", "clientConcerns", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "LLM no generó respuesta",
      });
    const parsed = JSON.parse(String(content));

    await updateRecurringService(input.serviceId, {
      pipedriveAiSummary: parsed.summary,
      pipedriveClientConcerns: parsed.clientConcerns,
      pipedriveAiRecommendations: parsed.recommendations,
    });
    await audit(ctx, "ai_generate", "recurring_service", input.serviceId, svc.serviceName, { type: "pipedrive_summary" });
    return parsed;
  }),

  confirmInitStep1: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const stage = await getRecurringServiceStage(input.serviceId, "inicializacion");
    if (!stage || stage.status !== "in_progress")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Etapa no está en progreso",
      });
    // Validate: billing plan must exist
    const billing = await getBillingMonths(input.serviceId);
    if (billing.length === 0)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe configurar el plan de cobro antes de confirmar",
      });
    await updateRecurringService(input.serviceId, {
      initStep1Confirmed: true,
    });
    await audit(ctx, "confirm_init_step1", "recurring_service", input.serviceId, svc.serviceName, { billingMonths: billing.length });
  }),

  closeInitializationStage: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const stage = await getRecurringServiceStage(input.serviceId, "inicializacion");
    if (!stage || stage.status !== "in_progress")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Etapa no está en progreso",
      });
    // Validate Step 1 confirmed
    if (!svc.initStep1Confirmed)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe confirmar el Paso 1 (datos generales y plan de cobro) antes de cerrar",
      });
    // Validate documents: at least one document uploaded
    const docs = await getServiceDocuments(input.serviceId);
    if (docs.length === 0)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe subir al menos un documento (propuesta, P&L, SoW o contrato)",
      });
    // Validate Pipedrive sync
    if (!svc.dealId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe sincronizar la información de Pipedrive antes de cerrar",
      });
    await completeRecurringStage(input.serviceId, "inicializacion", ctx.user.id);
    await audit(ctx, "stage_close", "recurring_service", input.serviceId, svc.serviceName, { stage: "inicializacion" });
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 2: Plan de Trabajo
  // ═══════════════════════════════════════════════════════════════════════════

  setFormalStartDate: adminOrPmo.input(z.object({ serviceId: z.number(), formalStartDate: z.string() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    // Calculate end date based on duration
    const start = new Date(input.formalStartDate);
    const end = new Date(start);
    end.setMonth(end.getMonth() + svc.durationMonths);
    await updateRecurringService(input.serviceId, {
      formalStartDate: input.formalStartDate,
      endDate: end.toISOString().split("T")[0],
    });
    await audit(ctx, "set_formal_start", "recurring_service", input.serviceId, svc.serviceName, { formalStartDate: input.formalStartDate });
  }),

  generateWorkPlan: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const docs = await getServiceDocuments(input.serviceId);

    const prompt = `Eres un Gerente de Proyectos Senior especializado en servicios recurrentes de TI.
Genera un plan de trabajo detallado para el siguiente servicio recurrente:

- Cliente: ${svc.clientName}
- Servicio: ${svc.serviceName}
- Tipo: ${svc.serviceType}
- Duración: ${svc.durationMonths} meses
- Fecha inicio formal: ${svc.formalStartDate ?? "Por definir"}
- Monto mensual: ${svc.fixedMonthlyAmount ?? "Variable"} ${svc.currency}
- Documentos adjuntos: ${docs.map(d => d.fileName).join(", ") || "Ninguno"}

El plan debe incluir:
1. Informes mensuales de gestión (uno por mes)
2. Hitos de facturación (uno por mes)
3. Tareas programadas recurrentes (revisiones, mantenimientos, etc.)
4. Definiciones de cobertura horaria
5. Definiciones de SLA por prioridad

Responde en JSON con este formato:
{
  "workPlanItems": [
    { "itemType": "informe_mensual|facturacion|tarea_programada|coverage_definition|sla_definition", "title": "...", "description": "...", "frequency": "mensual|semanal|quincenal|trimestral|unica", "monthNumber": 1 }
  ],
  "slaConfig": [
    { "priority": "critical|high|medium|low", "firstResponseMinutes": 30, "resolutionMinutes": 240, "coverageType": "24x7|8x5|personalizado" }
  ]
}`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Eres un Gerente de Proyectos Senior de Prodigio Tech. Genera planes de trabajo detallados para servicios recurrentes. Responde siempre en español.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "work_plan",
          strict: true,
          schema: {
            type: "object",
            properties: {
              workPlanItems: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    itemType: { type: "string" },
                    title: { type: "string" },
                    description: { type: "string" },
                    frequency: { type: "string" },
                    monthNumber: { type: "integer" },
                  },
                  required: ["itemType", "title", "description", "frequency", "monthNumber"],
                  additionalProperties: false,
                },
              },
              slaConfig: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "string" },
                    firstResponseMinutes: { type: "integer" },
                    resolutionMinutes: { type: "integer" },
                    coverageType: { type: "string" },
                  },
                  required: ["priority", "firstResponseMinutes", "resolutionMinutes", "coverageType"],
                  additionalProperties: false,
                },
              },
            },
            required: ["workPlanItems", "slaConfig"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "LLM no generó respuesta",
      });
    const parsed = JSON.parse(String(content));

    // Clear existing and insert new
    await deleteAllWorkPlanItems(input.serviceId);
    const validItemTypes = ["informe_mensual", "facturacion", "tarea_programada", "sla_definition", "coverage_definition"];
    const items = (parsed.workPlanItems || [])
      .filter((item: any) => validItemTypes.includes(item.itemType))
      .map((item: any, idx: number) => ({
        serviceId: input.serviceId,
        itemType: item.itemType as any,
        title: item.title,
        description: item.description,
        frequency: item.frequency,
        monthNumber: item.monthNumber,
        sortOrder: idx,
      }));
    if (items.length > 0) await bulkInsertWorkPlanItems(items);

    // Save SLA config
    const validPriorities = ["critical", "high", "medium", "low"];
    const validCoverage = ["24x7", "8x5", "personalizado"];
    const slaItems = (parsed.slaConfig || [])
      .filter((s: any) => validPriorities.includes(s.priority))
      .map((s: any) => ({
        serviceId: input.serviceId,
        priority: s.priority as any,
        firstResponseMinutes: s.firstResponseMinutes,
        resolutionMinutes: s.resolutionMinutes,
        coverageType: (validCoverage.includes(s.coverageType) ? s.coverageType : "8x5") as any,
      }));
    if (slaItems.length > 0) await saveSlaConfig(input.serviceId, slaItems);

    await audit(ctx, "ai_generate", "recurring_service", input.serviceId, svc.serviceName, {
      type: "work_plan",
      itemCount: items.length,
      slaCount: slaItems.length,
    });
    return { itemCount: items.length, slaCount: slaItems.length };
  }),

  getWorkPlan: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
    const items = await getWorkPlanItems(input.serviceId);
    const sla = await getSlaConfig(input.serviceId);
    return { items, sla };
  }),

  saveWorkPlanItem: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        item: z.object({
          id: z.number().optional(),
          itemType: z.enum(["informe_mensual", "facturacion", "tarea_programada", "sla_definition", "coverage_definition"]),
          title: z.string(),
          description: z.string().optional(),
          frequency: z.string().optional(),
          monthNumber: z.number().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.item.id) {
        await updateWorkPlanItem(input.item.id, {
          itemType: input.item.itemType,
          title: input.item.title,
          description: input.item.description,
          frequency: input.item.frequency,
          monthNumber: input.item.monthNumber,
        });
        return { id: input.item.id };
      } else {
        const id = await insertWorkPlanItem({
          serviceId: input.serviceId,
          itemType: input.item.itemType,
          title: input.item.title,
          description: input.item.description,
          frequency: input.item.frequency,
          monthNumber: input.item.monthNumber,
        });
        return { id };
      }
    }),

  deleteWorkPlanItem: adminOrPmo.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await deleteWorkPlanItem(input.id);
  }),

  saveSlaConfig: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        items: z.array(
          z.object({
            priority: z.enum(["critical", "high", "medium", "low"]),
            firstResponseMinutes: z.number(),
            resolutionMinutes: z.number(),
            coverageType: z.enum(["24x7", "8x5", "personalizado"]).default("8x5"),
            customCoverageDescription: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await saveSlaConfig(
        input.serviceId,
        input.items.map(i => ({
          serviceId: input.serviceId,
          ...i,
        }))
      );
      await audit(ctx, "save_sla_config", "recurring_service", input.serviceId, null, { count: input.items.length });
    }),

  closeWorkPlanStage: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const stage = await getRecurringServiceStage(input.serviceId, "plan_trabajo");
    if (!stage || stage.status !== "in_progress")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Etapa no está en progreso",
      });
    if (!svc.formalStartDate)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe definir la fecha formal de inicio",
      });
    const items = await getWorkPlanItems(input.serviceId);
    if (items.length === 0)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe tener al menos un ítem en el plan de trabajo",
      });
    await completeRecurringStage(input.serviceId, "plan_trabajo", ctx.user.id);
    await audit(ctx, "stage_close", "recurring_service", input.serviceId, svc.serviceName, { stage: "plan_trabajo" });
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 3: JIRA/JSM Setup
  // ═══════════════════════════════════════════════════════════════════════════

  setPlatformChoice: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        platform: z.enum(["prodigio", "cliente"]),
        clientPlatformUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      await updateRecurringService(input.serviceId, {
        jsmPlatform: input.platform,
        jsmClientPlatformUrl: input.clientPlatformUrl,
      });
      await audit(ctx, "set_platform", "recurring_service", input.serviceId, svc.serviceName, { platform: input.platform });
    }),

  listExistingJsmSpaces: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().max(100).optional(),
          page: z.number().int().positive().default(1),
          pageSize: z.number().int().min(1).max(100).default(25),
          linkStatus: z.enum(["all", "linked", "available"]).default("all"),
          health: z.enum(["all", "pending", "healthy", "warning", "blocked"]).default("all"),
          origin: z.enum(["all", "created", "linked", "legacy"]).default("all"),
        })
        .optional()
    )
    .query(async ({ input }) => {
      return listExistingJsmSpaces(input ?? {});
    }),

  getExistingJsmLinkState: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getExistingJsmLinkState(input.serviceId, input.limit);
      } catch (error) {
        return throwExistingJsmError(error);
      }
    }),

  preflightExistingJsmSpace: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        serviceDeskId: z.string().trim().min(1).max(50),
        operationId: z.string().trim().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await preflightExistingJsmSpace({ ...input, actor });
        await audit(ctx, "jsm_existing_preflight", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          serviceDeskId: input.serviceDeskId,
          status: result.preflight.status,
          canLink: result.preflight.canLink,
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_existing_preflight_failed", "recurring_service", input.serviceId, null, {
          serviceDeskId: input.serviceDeskId,
          errorCode: error instanceof JsmExistingSpaceRunnerError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwExistingJsmError(error);
      }
    }),

  linkExistingJsmSpace: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        preflightRunId: z.string().trim().min(8).max(191),
        operationId: z.string().trim().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await linkExistingJsmSpace({ ...input, actor });
        await audit(ctx, "jsm_existing_link", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          preflightRunId: input.preflightRunId,
          projectId: result.preflight.snapshot.projectId,
          projectKey: result.preflight.snapshot.projectKey,
          serviceDeskId: result.preflight.snapshot.serviceDeskId,
          health: result.preflight.warnings.length > 0 ? "warning" : "healthy",
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_existing_link_failed", "recurring_service", input.serviceId, null, {
          preflightRunId: input.preflightRunId,
          errorCode: error instanceof JsmExistingSpaceRunnerError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwExistingJsmError(error);
      }
    }),

  revalidateExistingJsmSpace: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        operationId: z.string().trim().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await revalidateExistingJsmSpace({ ...input, actor });
        await audit(ctx, "jsm_existing_revalidate", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          status: result.preflight.status,
          health: result.preflight.canLink ? (result.preflight.warnings.length > 0 ? "warning" : "healthy") : "blocked",
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_existing_revalidate_failed", "recurring_service", input.serviceId, null, {
          errorCode: error instanceof JsmExistingSpaceRunnerError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwExistingJsmError(error);
      }
    }),

  unlinkExistingJsmSpace: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        reason: z.string().trim().min(10).max(500),
        operationId: z.string().trim().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await unlinkExistingJsmSpace({ ...input, actor });
        await audit(ctx, "jsm_existing_unlink", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          projectId: result.priorIdentity.projectId,
          projectKey: result.priorIdentity.projectKey,
          serviceDeskId: result.priorIdentity.serviceDeskId,
          reason: input.reason,
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_existing_unlink_failed", "recurring_service", input.serviceId, null, {
          reason: input.reason,
          errorCode: error instanceof JsmExistingSpaceRunnerError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwExistingJsmError(error);
      }
    }),

  getJsmSyncConfiguration: protectedProcedure
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        limit: z.number().int().min(1).max(100).optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await getJsmSyncConfiguration(input.serviceId, input.limit);
      } catch (error) {
        return throwJsmSyncError(error);
      }
    }),

  saveJsmIssueTypeMappings: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        mappings: z
          .array(
            z.object({
              category: z.enum(["work_plan", "billing"]),
              issueTypeId: z.string().trim().min(1).max(50),
            })
          )
          .length(2),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const mappings = await configureJsmIssueTypeMappings({
          ...input,
          actor,
        });
        await audit(ctx, "jsm_issue_type_mappings_update", "recurring_service", input.serviceId, null, {
          mappings: mappings.map(mapping => ({
            category: mapping.category,
            issueTypeId: mapping.issueTypeId,
            issueTypeName: mapping.issueTypeName,
          })),
        });
        return mappings;
      } catch (error) {
        await audit(ctx, "jsm_issue_type_mappings_update_failed", "recurring_service", input.serviceId, null, {
          errorCode: error instanceof JsmRecurringSyncError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwJsmSyncError(error);
      }
    }),

  dryRunJsmSync: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        operationId: z.string().trim().min(8).max(191).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await dryRunJsmSync({ ...input, actor });
        await audit(ctx, "jsm_sync_dry_run", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          status: result.status,
          fingerprint: result.plan.fingerprint,
          counts: result.plan.counts,
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_sync_dry_run_failed", "recurring_service", input.serviceId, null, {
          errorCode: error instanceof JsmRecurringSyncError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwJsmSyncError(error);
      }
    }),

  confirmJsmSync: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        dryRunId: z.string().trim().min(8).max(191),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const actor = { id: ctx.user.id, name: ctx.user.name ?? "Unknown" };
      try {
        const result = await confirmJsmSync({ ...input, actor });
        await audit(ctx, "jsm_sync_confirm", "recurring_service", input.serviceId, null, {
          runId: result.runId,
          status: result.status,
          created: result.results.filter(item => item.status === "created").length,
          alreadyLinked: result.results.filter(item => item.status === "already_linked").length,
          blocked: result.results.filter(item => item.status === "blocked").length,
          errors: result.results.filter(item => item.status === "error").length,
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_sync_confirm_failed", "recurring_service", input.serviceId, null, {
          dryRunId: input.dryRunId,
          errorCode: error instanceof JsmRecurringSyncError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwJsmSyncError(error);
      }
    }),

  associateExistingJiraIssue: adminOrPmo
    .input(
      z.object({
        serviceId: z.number().int().positive(),
        category: z.enum(["work_plan", "billing"]),
        entityId: z.number().int().positive(),
        jiraIssueKey: z
          .string()
          .trim()
          .min(2)
          .max(50)
          .regex(/^[A-Za-z][A-Za-z0-9_]*-\d+$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await associateExistingJiraIssue(input);
        await audit(ctx, "jsm_existing_issue_associate", "recurring_service", input.serviceId, null, {
          category: input.category,
          entityId: input.entityId,
          jiraIssueKey: result.jiraIssueKey,
          reused: result.reused,
        });
        return result;
      } catch (error) {
        await audit(ctx, "jsm_existing_issue_associate_failed", "recurring_service", input.serviceId, null, {
          category: input.category,
          entityId: input.entityId,
          errorCode: error instanceof JsmRecurringSyncError || error instanceof RecurringServiceJsmDbError ? error.code : "unknown",
        }).catch(() => undefined);
        return throwJsmSyncError(error);
      }
    }),

  createJsmProject: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        spaceName: z.string(),
        spaceKey: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      if (svc.jsmPlatform !== "prodigio")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Solo se puede crear proyecto JSM cuando la plataforma es Prodigio",
        });

      // Servicios recurrentes siempre usan JSM (service_desk) con categoría Mesa de Servicio
      const result = await createJiraSpace({
        spaceName: input.spaceName,
        spaceKey: input.spaceKey,
        description: `Mesa de Servicio: ${svc.serviceName} - Cliente: ${svc.clientName}`,
        leadAccountId: "",
        projectType: "service_desk",
      });

      if (result.success && result.created) {
        let serviceDesk: Awaited<ReturnType<typeof listJsmServiceDesks>>[number] | undefined;
        try {
          const serviceDesks = await listJsmServiceDesks({ maxItems: 1000 });
          serviceDesk = serviceDesks.find(item => item.projectId === result.jiraProjectId || item.projectKey.toUpperCase() === result.jiraProjectKey?.toUpperCase());
        } catch {
          // La creación ya ocurrió en Jira. Se persiste con health warning y podrá revalidarse sin repetir el POST.
        }
        const urls = serviceDesk ? buildJsmProjectUrls(result.jiraProjectKey!, serviceDesk.id) : { agentUrl: result.jiraProjectUrl, portalUrl: null };
        const now = new Date();
        await updateRecurringService(input.serviceId, {
          jsmLinkSource: "created",
          jsmProjectKey: result.jiraProjectKey,
          jsmProjectId: result.jiraProjectId,
          jsmProjectName: serviceDesk?.projectName ?? input.spaceName,
          jsmServiceDeskId: serviceDesk?.id ?? null,
          jsmAgentUrl: urls.agentUrl,
          jsmPortalUrl: urls.portalUrl,
          jsmLinkHealth: serviceDesk ? "healthy" : "warning",
          jsmLastVerifiedAt: serviceDesk ? now : null,
          jsmLinkedAt: now,
          jsmLinkedBy: ctx.user.id,
        });
        await audit(ctx, "jsm_project_create", "recurring_service", input.serviceId, svc.serviceName, {
          jiraKey: result.jiraProjectKey,
          jiraProjectId: result.jiraProjectId,
          serviceDeskId: serviceDesk?.id ?? null,
          agentUrl: urls.agentUrl,
          portalUrl: urls.portalUrl,
          linkHealth: serviceDesk ? "healthy" : "warning",
        });
      }
      return result;
    }),

  syncJsmTasks: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async () => {
    return Promise.reject(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "La sincronización directa fue reemplazada por dry-run y confirmación explícita. Actualice la vista y vuelva a intentarlo.",
      })
    ) as Promise<
      Array<{
        id: number;
        title: string;
        status: string;
        jiraKey?: string;
        error?: string;
      }>
    >;
  }),

  // Get summary of synced JIRA issues for a service
  getJiraIssuesSummary: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const workItems = await getWorkPlanItems(input.serviceId);
    const billing = await getBillingMonths(input.serviceId);
    const mappings = await listActiveJsmIssueTypeMappings(input.serviceId);

    const syncedWorkItems = workItems
      .filter(w => w.jiraIssueKey)
      .map(w => ({
        id: w.id,
        jiraKey: w.jiraIssueKey!,
        title: w.title,
        type: w.itemType,
        frequency: w.frequency,
        monthNumber: w.monthNumber,
        category: "actividad" as const,
      }));
    const unsyncedWorkItems = workItems
      .filter(w => !w.jiraIssueKey)
      .map(w => ({
        id: w.id,
        title: w.title,
        type: w.itemType,
        frequency: w.frequency,
        monthNumber: w.monthNumber,
        category: "actividad" as const,
      }));
    const syncedBilling = billing
      .filter(b => b.jiraIssueKey)
      .map(b => ({
        id: b.id,
        jiraKey: b.jiraIssueKey!,
        title: `Facturación Mes ${b.monthNumber}`,
        amount: b.amount,
        currency: b.currency,
        monthNumber: b.monthNumber,
        category: "facturacion" as const,
      }));
    const unsyncedBilling = billing
      .filter(b => !b.jiraIssueKey)
      .map(b => ({
        id: b.id,
        title: `Facturación Mes ${b.monthNumber}`,
        amount: b.amount,
        currency: b.currency,
        monthNumber: b.monthNumber,
        category: "facturacion" as const,
      }));

    return {
      totalSynced: syncedWorkItems.length + syncedBilling.length,
      totalUnsynced: unsyncedWorkItems.length + unsyncedBilling.length,
      totalWorkItems: workItems.length,
      totalBilling: billing.length,
      syncedWorkItems,
      syncedBilling,
      unsyncedWorkItems,
      unsyncedBilling,
      jsmProjectKey: svc.jsmProjectKey,
      jsmPortalUrl: svc.jsmPortalUrl,
      readiness: calculateJsmSetupReadiness({
        platform: svc.jsmPlatform,
        clientPlatformUrl: svc.jsmClientPlatformUrl,
        projectKey: svc.jsmProjectKey,
        workItems,
        billing,
        mappings,
      }),
    };
  }),

  // Re-sync: create only missing JIRA issues
  resyncJsmTasks: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async () => {
    return Promise.reject(
      new TRPCError({
        code: "BAD_REQUEST",
        message: "La resincronización directa fue reemplazada por dry-run y confirmación explícita.",
      })
    ) as Promise<
      Array<{
        id: number;
        title: string;
        status: string;
        jiraKey?: string;
        error?: string;
        category: string;
      }>
    >;
  }),

  closeJiraSetupStage: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const stage = await getRecurringServiceStage(input.serviceId, "jira_setup");
    if (!stage || stage.status !== "in_progress")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Etapa no está en progreso",
      });
    const [workItems, billing, mappings] = await Promise.all([getWorkPlanItems(input.serviceId), getBillingMonths(input.serviceId), listActiveJsmIssueTypeMappings(input.serviceId)]);
    const readiness = calculateJsmSetupReadiness({
      platform: svc.jsmPlatform,
      clientPlatformUrl: svc.jsmClientPlatformUrl,
      projectKey: svc.jsmProjectKey,
      workItems,
      billing,
      mappings,
    });
    if (!readiness.canClose) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `No es posible cerrar JSM Setup: ${readiness.blockers.join(" ")}`,
      });
    }
    await completeRecurringStage(input.serviceId, "jira_setup", ctx.user.id);
    await audit(ctx, "stage_close", "recurring_service", input.serviceId, svc.serviceName, { stage: "jira_setup" });
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 4: Ejecución
  // ═══════════════════════════════════════════════════════════════════════════

  getExecutionDashboard: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const [billing, workItems, sla, penalties, latestAnalysis, analysisHistory] = await Promise.all([getBillingMonths(input.serviceId), getWorkPlanItems(input.serviceId), getSlaConfig(input.serviceId), getPenalties(input.serviceId), getLatestAiAnalysis(input.serviceId), getAiAnalysisHistory(input.serviceId, 5)]);

    // Calculate metrics
    const totalBilled = billing.filter(b => b.status === "facturado" || b.status === "pagado").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
    const totalPaid = billing.filter(b => b.status === "pagado").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
    const totalPending = billing.filter(b => b.status === "pendiente").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
    const totalPenalties = penalties.reduce((s, p) => s + parseFloat(String(p.amount ?? 0)), 0);
    const completedItems = workItems.filter(i => i.status === "completado").length;
    const totalItems = workItems.length;

    // Calculate months elapsed
    let monthsElapsed = 0;
    const now = new Date();
    if (svc.formalStartDate) {
      const start = new Date(svc.formalStartDate);
      monthsElapsed = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()));
    }

    // SLA Compliance calculation
    // Regla de negocio:
    // - Si no hay tickets/tareas → SLA = 0% (no hay evidencia de servicio activo)
    // - Si hay tareas con fecha vencida no completadas → SLA = 0%
    // - Si hay tareas pero 0% completadas y el servicio lleva tiempo activo → SLA = 0%
    // - Si hay SLA config y no hay multas → se calcula normalmente
    const hasSlaConfig = sla.length > 0;
    const activePenalties = penalties.filter(p => p.status === "identificada" || p.status === "aplicada");
    const overdueTasks = workItems.filter(i => {
      if (i.status === "completado") return false;
      if (!i.dueDate) return false;
      return new Date(i.dueDate) < now;
    });

    // Fetch JIRA overdue issues if project has JSM key
    let jiraOverdueCount = 0;
    let jiraTotalIssues = 0;
    let jiraCompletedIssues = 0;
    if (svc.jsmProjectKey) {
      try {
        const jiraResult = await searchJiraIssues(`project=${svc.jsmProjectKey} ORDER BY created ASC`, { maxResults: 200, fields: ["summary", "status", "duedate"] });
        jiraTotalIssues = jiraResult.issues.length;
        jiraCompletedIssues = jiraResult.issues.filter((i: any) => i.fields?.status?.statusCategory?.key === "done").length;
        jiraOverdueCount = jiraResult.issues.filter((i: any) => {
          const dd = i.fields?.duedate;
          return dd && new Date(dd) < now && i.fields?.status?.statusCategory?.key !== "done";
        }).length;
      } catch {
        /* JIRA unavailable - continue without */
      }
    }

    let slaCompliancePct: number | null = null;
    if (totalItems === 0 && jiraTotalIssues === 0) {
      // Sin tickets ni tareas → 0%
      slaCompliancePct = 0;
    } else if (overdueTasks.length > 0 || jiraOverdueCount > 0) {
      // Hay tareas/issues vencidos → SLA = 0%
      slaCompliancePct = 0;
    } else if (completedItems === 0 && jiraCompletedIssues === 0 && monthsElapsed > 0) {
      // 0% avance en tareas y el servicio ya lleva tiempo activo → SLA = 0%
      slaCompliancePct = 0;
    } else if (hasSlaConfig) {
      // Cálculo normal: 100% menos penalidades
      slaCompliancePct = Math.max(0, 100 - activePenalties.length * 15);
    } else {
      // Sin SLA config pero con tickets y sin atrasos → basado en avance
      const totalAll = totalItems + jiraTotalIssues;
      const completedAll = completedItems + jiraCompletedIssues;
      slaCompliancePct = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;
    }

    // Deliverables compliance (work items + JIRA completion)
    const totalAllItems = totalItems + jiraTotalIssues;
    const completedAllItems = completedItems + jiraCompletedIssues;
    const deliverablesCompliancePct = totalAllItems > 0 ? Math.round((completedAllItems / totalAllItems) * 100) : 0;

    // Billing compliance (on-time billing)
    const overdueMonths = billing.filter(b => {
      if (b.status !== "pendiente" || !b.dueDate) return false;
      return new Date(b.dueDate) < now;
    });
    const billingCompliancePct = billing.length > 0 ? Math.round(((billing.length - overdueMonths.length) / billing.length) * 100) : null;

    // AI analysis from history table (preferred) or legacy fields
    let aiAnalysis: any = null;
    let aiAnalysisDaysOld: number | null = null;
    let aiAnalysisExpired = false;
    let aiDimensions: any = null;

    if (latestAnalysis) {
      try {
        aiAnalysis = JSON.parse(latestAnalysis.fullAnalysis ?? "{}");
      } catch {
        /* ignore */
      }
      const daysDiff = Math.floor((Date.now() - new Date(latestAnalysis.createdAt).getTime()) / (1000 * 60 * 60 * 24));
      aiAnalysisDaysOld = daysDiff;
      aiAnalysisExpired = daysDiff > 5;
      aiDimensions = {
        sla: {
          status: latestAnalysis.slaDimension,
          score: latestAnalysis.slaScore,
          detail: latestAnalysis.slaDetail,
        },
        deliverables: {
          status: latestAnalysis.deliverablesDimension,
          score: latestAnalysis.deliverablesScore,
          detail: latestAnalysis.deliverablesDetail,
        },
        billing: {
          status: latestAnalysis.billingDimension,
          score: latestAnalysis.billingScore,
          detail: latestAnalysis.billingDetail,
        },
      };
    } else if (svc.aiFullAnalysis) {
      try {
        aiAnalysis = JSON.parse(svc.aiFullAnalysis);
      } catch {
        /* ignore */
      }
      if (svc.aiAnalysisDate) {
        const daysDiff = Math.floor((Date.now() - new Date(svc.aiAnalysisDate).getTime()) / (1000 * 60 * 60 * 24));
        aiAnalysisDaysOld = daysDiff;
        aiAnalysisExpired = daysDiff > 5;
      }
    }

    return {
      service: svc,
      billing,
      workItems,
      sla,
      penalties,
      metrics: {
        totalBilled,
        totalPaid,
        totalPending,
        totalPenalties,
        completedItems,
        totalItems,
        completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0,
        monthsElapsed,
        monthsRemaining: Math.max(0, svc.durationMonths - monthsElapsed),
        contractProgress: svc.durationMonths > 0 ? Math.round((monthsElapsed / svc.durationMonths) * 100) : 0,
        slaCompliancePct,
        slaFactors: {
          hasSlaConfig,
          totalWorkItems: totalItems,
          completedWorkItems: completedItems,
          overdueWorkItems: overdueTasks.length,
          jiraTotalIssues,
          jiraCompletedIssues,
          jiraOverdueIssues: jiraOverdueCount,
          activePenalties: activePenalties.length,
          monthsElapsed,
          reason: totalItems === 0 && jiraTotalIssues === 0 ? "no_tickets" : overdueTasks.length > 0 || jiraOverdueCount > 0 ? "overdue_items" : completedItems === 0 && jiraCompletedIssues === 0 && monthsElapsed > 0 ? "zero_progress" : hasSlaConfig ? "sla_penalty_calc" : "progress_based",
        },
        deliverablesCompliancePct,
        billingCompliancePct,
        overdueMonths: overdueMonths.length,
      },
      aiAnalysis: {
        data: aiAnalysis,
        healthStatus: latestAnalysis?.semaphore ?? svc.aiHealthStatus,
        healthJustification: latestAnalysis?.semaphoreJustification ?? svc.aiHealthJustification,
        abstract: latestAnalysis?.executiveAbstract ?? svc.aiExecutiveAbstract,
        analysisDate: latestAnalysis?.createdAt ?? svc.aiAnalysisDate,
        daysOld: aiAnalysisDaysOld,
        expired: aiAnalysisExpired,
        dimensions: aiDimensions,
        history: analysisHistory.map(a => ({
          id: a.id,
          semaphore: a.semaphore,
          createdAt: a.createdAt,
          slaDimension: a.slaDimension,
          deliverablesDimension: a.deliverablesDimension,
          billingDimension: a.billingDimension,
        })),
      },
    };
  }),

  // Sync work plan items from JIRA (get real status of each issue)
  getWorkPlanFromJira: protectedProcedure.input(z.object({ serviceId: z.number() })).query(async ({ input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    if (!svc.jsmProjectKey) return { workItems: [], billingItems: [], jiraUnavailable: true };

    const workItems = await getWorkPlanItems(input.serviceId);
    const billing = await getBillingMonths(input.serviceId);

    // Fetch all issues from JIRA project in one call
    let jiraIssuesMap = new Map<string, any>();
    try {
      const jiraResult = await searchJiraIssues(`project=${svc.jsmProjectKey} ORDER BY created ASC`, {
        maxResults: 200,
        fields: ["summary", "status", "issuetype", "assignee", "priority", "created", "updated", "duedate", "labels"],
      });
      for (const issue of jiraResult.issues) {
        jiraIssuesMap.set(issue.key, issue);
      }
    } catch (e: any) {
      return {
        workItems: [],
        billingItems: [],
        jiraUnavailable: true,
        error: e.message?.substring(0, 200),
      };
    }

    // Build a set of JIRA keys already covered by local work items
    const localJiraKeys = new Set(workItems.map(item => item.jiraIssueKey).filter(Boolean));

    // Map work items with JIRA status
    const enrichedWorkItems = workItems.map(item => {
      const jiraIssue = item.jiraIssueKey ? jiraIssuesMap.get(item.jiraIssueKey) : null;
      return {
        id: item.id,
        title: item.title,
        description: item.description,
        itemType: item.itemType,
        frequency: item.frequency,
        monthNumber: item.monthNumber,
        dueDate: item.dueDate,
        status: item.status,
        jiraIssueKey: item.jiraIssueKey,
        jiraStatus: jiraIssue?.fields?.status?.name ?? null,
        jiraStatusCategory: jiraIssue?.fields?.status?.statusCategory?.key ?? null,
        jiraAssignee: jiraIssue?.fields?.assignee?.displayName ?? null,
        jiraPriority: jiraIssue?.fields?.priority?.name ?? null,
        jiraDueDate: jiraIssue?.fields?.duedate ?? null,
        jiraUpdated: jiraIssue?.fields?.updated ?? null,
        jiraSummary: jiraIssue?.fields?.summary ?? null,
        sourceLocal: true,
      };
    });

    // Add JIRA issues that have NO local record (created directly in JIRA)
    // Exclude billing-type issues (labels: facturacion) — those go to billingItems
    const billingJiraKeys = new Set(billing.map(b => b.jiraIssueKey).filter(Boolean));
    for (const [key, issue] of Array.from(jiraIssuesMap.entries())) {
      if (localJiraKeys.has(key) || billingJiraKeys.has(key)) continue;
      const labels: string[] = issue.fields?.labels ?? [];
      if (labels.includes("facturacion")) continue; // skip billing issues
      if (labels.includes("test")) continue; // skip test issues
      enrichedWorkItems.push({
        id: -1, // no local id
        title: issue.fields?.summary ?? key,
        description: null,
        itemType: issue.fields?.issuetype?.name ?? "Task",
        frequency: labels.find((l: string) => ["mensual", "semanal", "trimestral", "unica"].includes(l)) ?? "unica",
        monthNumber: null,
        dueDate: issue.fields?.duedate ?? null,
        status: "pendiente" as const,
        jiraIssueKey: key,
        jiraStatus: issue.fields?.status?.name ?? null,
        jiraStatusCategory: issue.fields?.status?.statusCategory?.key ?? null,
        jiraAssignee: issue.fields?.assignee?.displayName ?? null,
        jiraPriority: issue.fields?.priority?.name ?? null,
        jiraDueDate: issue.fields?.duedate ?? null,
        jiraUpdated: issue.fields?.updated ?? null,
        jiraSummary: issue.fields?.summary ?? null,
        sourceLocal: false,
      });
    }

    // Map billing items with JIRA status
    const enrichedBilling = billing.map(month => {
      const jiraIssue = month.jiraIssueKey ? jiraIssuesMap.get(month.jiraIssueKey) : null;
      return {
        id: month.id,
        monthNumber: month.monthNumber,
        amount: month.amount,
        currency: month.currency,
        dueDate: month.dueDate,
        status: month.status,
        jiraIssueKey: month.jiraIssueKey,
        jiraStatus: jiraIssue?.fields?.status?.name ?? null,
        jiraStatusCategory: jiraIssue?.fields?.status?.statusCategory?.key ?? null,
        jiraAssignee: jiraIssue?.fields?.assignee?.displayName ?? null,
        jiraDueDate: jiraIssue?.fields?.duedate ?? null,
        jiraUpdated: jiraIssue?.fields?.updated ?? null,
      };
    });

    // Summary stats from JIRA
    const totalJiraIssues = jiraIssuesMap.size;
    const doneCount = Array.from(jiraIssuesMap.values()).filter(i => i.fields?.status?.statusCategory?.key === "done").length;
    const inProgressCount = Array.from(jiraIssuesMap.values()).filter(i => i.fields?.status?.statusCategory?.key === "indeterminate").length;
    const todoCount = totalJiraIssues - doneCount - inProgressCount;

    return {
      workItems: enrichedWorkItems,
      billingItems: enrichedBilling,
      jiraUnavailable: false,
      jiraStats: {
        total: totalJiraIssues,
        done: doneCount,
        inProgress: inProgressCount,
        todo: todoCount,
        completionRate: totalJiraIssues > 0 ? Math.round((doneCount / totalJiraIssues) * 100) : 0,
      },
      jsmProjectKey: svc.jsmProjectKey,
    };
  }),

  // Get or refresh AI analysis (auto-refresh if older than 5 days)
  getOrRefreshAiAnalysis: protectedProcedure
    .input(
      z.object({
        serviceId: z.number(),
        forceRefresh: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });

      // Check if we have a valid cached analysis from history table (less than 5 days old)
      if (!input.forceRefresh) {
        const latest = await getLatestAiAnalysis(input.serviceId);
        if (latest) {
          const daysDiff = Math.floor((Date.now() - new Date(latest.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 5) {
            try {
              const cached = JSON.parse(latest.fullAnalysis ?? "{}");
              return {
                ...cached,
                fromCache: true,
                daysOld: daysDiff,
                dimensions: {
                  sla: {
                    status: latest.slaDimension,
                    score: latest.slaScore,
                    detail: latest.slaDetail,
                  },
                  deliverables: {
                    status: latest.deliverablesDimension,
                    score: latest.deliverablesScore,
                    detail: latest.deliverablesDetail,
                  },
                  billing: {
                    status: latest.billingDimension,
                    score: latest.billingScore,
                    detail: latest.billingDetail,
                  },
                },
              };
            } catch {
              /* regenerate */
            }
          }
        }
        // Fallback: check legacy fields
        if (svc.aiFullAnalysis && svc.aiAnalysisDate) {
          const daysDiff = Math.floor((Date.now() - new Date(svc.aiAnalysisDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 5) {
            try {
              const cached = JSON.parse(svc.aiFullAnalysis);
              return { ...cached, fromCache: true, daysOld: daysDiff };
            } catch {
              /* regenerate */
            }
          }
        }
      }

      // Gather all data for analysis
      const billing = await getBillingMonths(input.serviceId);
      const workItems = await getWorkPlanItems(input.serviceId);
      const penalties = await getPenalties(input.serviceId);
      const slaConfig = await getSlaConfig(input.serviceId);

      const totalBilled = billing.filter(b => b.status === "facturado" || b.status === "pagado").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
      const totalPaid = billing.filter(b => b.status === "pagado").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
      const totalPending = billing.filter(b => b.status === "pendiente").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
      const completedItems = workItems.filter(i => i.status === "completado").length;
      const overdueItems = workItems.filter(i => {
        if (!i.dueDate) return false;
        return new Date(i.dueDate) < new Date() && i.status !== "completado";
      }).length;

      // Billing compliance
      const now = new Date();
      const overdueMonths = billing.filter(b => {
        if (b.status !== "pendiente" || !b.dueDate) return false;
        return new Date(b.dueDate) < now;
      });
      const activePenalties = penalties.filter(p => p.status === "identificada" || p.status === "aplicada");

      let jiraContext = "";
      if (svc.jsmProjectKey) {
        try {
          const jiraResult = await searchJiraIssues(`project=${svc.jsmProjectKey} ORDER BY created ASC`, { maxResults: 200, fields: ["summary", "status", "duedate"] });
          const done = jiraResult.issues.filter(i => i.fields?.status?.statusCategory?.key === "done").length;
          const inProg = jiraResult.issues.filter(i => i.fields?.status?.statusCategory?.key === "indeterminate").length;
          const todo = jiraResult.issues.length - done - inProg;
          const overdue = jiraResult.issues.filter(i => {
            const dd = i.fields?.duedate;
            return dd && new Date(dd) < new Date() && i.fields?.status?.statusCategory?.key !== "done";
          }).length;
          jiraContext = `\nESTADO JIRA (proyecto ${svc.jsmProjectKey}):\n- Total issues: ${jiraResult.issues.length}\n- Completados: ${done}\n- En progreso: ${inProg}\n- Pendientes: ${todo}\n- Vencidos sin completar: ${overdue}`;
        } catch {
          /* JIRA unavailable */
        }
      }

      let monthsElapsed = 0;
      if (svc.formalStartDate) {
        const start = new Date(svc.formalStartDate);
        monthsElapsed = Math.max(0, (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()));
      }

      const prompt = `Eres un Gerente de Proyectos Senior de Prodigio Tech. Genera un análisis ejecutivo del siguiente servicio recurrente:

DATOS DEL SERVICIO:
- Cliente: ${svc.clientName}
- Servicio: ${svc.serviceName}
- Tipo: ${svc.serviceType}
- Duración: ${svc.durationMonths} meses
- Inicio formal: ${svc.formalStartDate ?? "N/A"}
- Fin estimado: ${svc.endDate ?? "N/A"}
- Meses transcurridos: ${monthsElapsed}
- Avance temporal: ${svc.durationMonths > 0 ? Math.round((monthsElapsed / svc.durationMonths) * 100) : 0}%

FACTURACION:
- Total facturado: ${totalBilled} ${svc.currency}
- Total pagado: ${totalPaid} ${svc.currency}
- Total pendiente: ${totalPending} ${svc.currency}
- Cuotas pendientes: ${billing.filter(b => b.status === "pendiente").length} de ${billing.length}
- Cuotas pagadas: ${billing.filter(b => b.status === "pagado").length}
- Cuotas vencidas sin pagar: ${overdueMonths.length}

PLAN DE TRABAJO:
- Items completados: ${completedItems} de ${workItems.length}
- Items vencidos: ${overdueItems}
- Avance tareas: ${workItems.length > 0 ? Math.round((completedItems / workItems.length) * 100) : 0}%
${jiraContext}

SLAs CONFIGURADOS: ${slaConfig.length} niveles
MULTAS REGISTRADAS: ${penalties.length} (activas: ${activePenalties.length}, total monto: ${penalties.reduce((s, p) => s + parseFloat(String(p.amount ?? 0)), 0)} ${svc.currency})

EVALÚA EL SEMÁFORO DE SALUD CONSIDERANDO 3 DIMENSIONES:

1. CUMPLIMIENTO SLA (REGLAS ESTRICTAS):
   - Si NO hay tickets/tareas en el plan de trabajo → SLA = ROJO (score 0). No hay evidencia de servicio activo.
   - Si hay tareas programadas con fecha vencida y no completadas → SLA = ROJO (score 0). Hay incumplimiento directo.
   - Si hay multas activas → reducir score proporcionalmente.
   - Solo si hay tickets activos, sin atrasos y sin multas → SLA puede ser VERDE.

2. CUMPLIMIENTO ENTREGABLES: ¿Cuántos items del plan de trabajo están completados vs pendientes? ¿Hay items vencidos?
   - Si no hay items → score 0 (no hay entregables definidos).

3. FACTURACIÓN AL DÍA: ¿Hay cuotas vencidas sin pagar? ¿El flujo de facturación es saludable?

Para cada dimensión asigna: VERDE (>80% cumplimiento), AMARILLO (50-80%), ROJO (<50%)
El semáforo general es el peor de las 3 dimensiones.

Responde en JSON.`;

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: "Eres un Gerente de Proyectos Senior de Prodigio Tech. Analiza servicios recurrentes con perspectiva ejecutiva. Responde en español.",
          },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "executive_analysis_v2",
            strict: true,
            schema: {
              type: "object",
              properties: {
                semaphore: {
                  type: "string",
                  description: "VERDE, AMARILLO o ROJO",
                },
                semaphoreJustification: { type: "string" },
                executiveAbstract: {
                  type: "string",
                  description: "1 párrafo resumen ejecutivo corto",
                },
                executiveSummary: {
                  type: "string",
                  description: "Análisis detallado 2-3 párrafos",
                },
                dimensions: {
                  type: "object",
                  properties: {
                    sla: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          description: "VERDE, AMARILLO o ROJO",
                        },
                        score: { type: "integer", description: "0-100" },
                        detail: { type: "string" },
                      },
                      required: ["status", "score", "detail"],
                      additionalProperties: false,
                    },
                    deliverables: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          description: "VERDE, AMARILLO o ROJO",
                        },
                        score: { type: "integer", description: "0-100" },
                        detail: { type: "string" },
                      },
                      required: ["status", "score", "detail"],
                      additionalProperties: false,
                    },
                    billing: {
                      type: "object",
                      properties: {
                        status: {
                          type: "string",
                          description: "VERDE, AMARILLO o ROJO",
                        },
                        score: { type: "integer", description: "0-100" },
                        detail: { type: "string" },
                      },
                      required: ["status", "score", "detail"],
                      additionalProperties: false,
                    },
                  },
                  required: ["sla", "deliverables", "billing"],
                  additionalProperties: false,
                },
                risks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      level: { type: "string" },
                      description: { type: "string" },
                      mitigation: { type: "string" },
                    },
                    required: ["level", "description", "mitigation"],
                    additionalProperties: false,
                  },
                },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      priority: { type: "integer" },
                      title: { type: "string" },
                      description: { type: "string" },
                    },
                    required: ["priority", "title", "description"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["semaphore", "semaphoreJustification", "executiveAbstract", "executiveSummary", "dimensions", "risks", "recommendations"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "LLM no generó respuesta",
        });
      const parsed = JSON.parse(String(content));

      // Persist to legacy fields
      await updateRecurringService(input.serviceId, {
        aiHealthStatus: parsed.semaphore,
        aiHealthJustification: parsed.semaphoreJustification,
        aiExecutiveAbstract: parsed.executiveAbstract,
        aiFullAnalysis: JSON.stringify(parsed),
        aiAnalysisDate: new Date(),
      });

      // Persist to history table with dimension breakdown
      await insertAiAnalysis({
        serviceId: input.serviceId,
        semaphore: parsed.semaphore,
        semaphoreJustification: parsed.semaphoreJustification,
        executiveAbstract: parsed.executiveAbstract,
        fullAnalysis: JSON.stringify(parsed),
        slaDimension: parsed.dimensions?.sla?.status,
        slaScore: parsed.dimensions?.sla?.score,
        slaDetail: parsed.dimensions?.sla?.detail,
        deliverablesDimension: parsed.dimensions?.deliverables?.status,
        deliverablesScore: parsed.dimensions?.deliverables?.score,
        deliverablesDetail: parsed.dimensions?.deliverables?.detail,
        billingDimension: parsed.dimensions?.billing?.status,
        billingScore: parsed.dimensions?.billing?.score,
        billingDetail: parsed.dimensions?.billing?.detail,
        generatedBy: ctx.user.id,
      });

      await audit(ctx, "ai_generate", "recurring_service", input.serviceId, svc.serviceName, {
        type: "executive_analysis_v2",
        semaphore: parsed.semaphore,
        dimensions: {
          sla: parsed.dimensions?.sla?.status,
          deliverables: parsed.dimensions?.deliverables?.status,
          billing: parsed.dimensions?.billing?.status,
        },
      });

      return { ...parsed, fromCache: false, daysOld: 0 };
    }),

  createPenalty: adminOrPmo
    .input(
      z.object({
        serviceId: z.number(),
        penaltyDate: z.string(),
        description: z.string(),
        amount: z.number().optional(),
        currency: z.string().default("USD"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const svc = await getRecurringServiceById(input.serviceId);
      if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
      const id = await insertPenalty({
        serviceId: input.serviceId,
        penaltyDate: input.penaltyDate,
        description: input.description,
        amount: input.amount ? String(input.amount) : undefined,
        currency: input.currency,
        createdBy: ctx.user.id,
      });
      await audit(ctx, "penalty_create", "recurring_service", input.serviceId, svc.serviceName, { penaltyId: id, description: input.description });
      return { id };
    }),

  updatePenaltyStatus: adminOrPmo
    .input(
      z.object({
        id: z.number(),
        serviceId: z.number(),
        status: z.enum(["identificada", "aplicada", "disputada", "resuelta"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updatePenaltyStatus(input.id, input.status);
      await audit(ctx, "penalty_status_change", "recurring_service", input.serviceId, null, { penaltyId: input.id, status: input.status });
    }),

  // generateAiExecutiveSummary is now replaced by getOrRefreshAiAnalysis above
  generateAiExecutiveSummary: adminOrPmo.input(z.object({ serviceId: z.number() })).mutation(async ({ ctx, input }) => {
    // Delegate to getOrRefreshAiAnalysis with forceRefresh=true
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });

    const billing = await getBillingMonths(input.serviceId);
    const workItems = await getWorkPlanItems(input.serviceId);
    const penalties = await getPenalties(input.serviceId);
    const slaConfig = await getSlaConfig(input.serviceId);

    const totalBilled = billing.filter(b => b.status === "facturado" || b.status === "pagado").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
    const totalPending = billing.filter(b => b.status === "pendiente").reduce((s, b) => s + parseFloat(String(b.amount)), 0);
    const completedItems = workItems.filter(i => i.status === "completado").length;
    const overdueItems = workItems.filter(i => {
      if (!i.dueDate) return false;
      return new Date(i.dueDate) < new Date() && i.status !== "completado";
    }).length;

    let jiraContext = "";
    if (svc.jsmProjectKey) {
      try {
        const jiraResult = await searchJiraIssues(`project=${svc.jsmProjectKey} ORDER BY created ASC`, { maxResults: 200, fields: ["summary", "status", "duedate"] });
        const done = jiraResult.issues.filter(i => i.fields?.status?.statusCategory?.key === "done").length;
        const inProg = jiraResult.issues.filter(i => i.fields?.status?.statusCategory?.key === "indeterminate").length;
        const todo = jiraResult.issues.length - done - inProg;
        jiraContext = `\nESTADO JIRA:\n- Total: ${jiraResult.issues.length}, Completados: ${done}, En progreso: ${inProg}, Pendientes: ${todo}`;
      } catch {
        /* continue without JIRA */
      }
    }

    let monthsElapsed = 0;
    if (svc.formalStartDate) {
      const start = new Date(svc.formalStartDate);
      monthsElapsed = Math.max(0, (new Date().getFullYear() - start.getFullYear()) * 12 + (new Date().getMonth() - start.getMonth()));
    }

    const prompt = `Eres un Gerente de Proyectos Senior de Prodigio Tech. Genera un análisis ejecutivo:\n\nSERVICIO: ${svc.serviceName} (${svc.clientName})\nTipo: ${svc.serviceType} | Duración: ${svc.durationMonths} meses | Avance: ${monthsElapsed} meses\nFACTURACION: Facturado ${totalBilled} ${svc.currency}, Pendiente ${totalPending} ${svc.currency}\nTAREAS: ${completedItems}/${workItems.length} completadas, ${overdueItems} vencidas\nSLAs: ${slaConfig.length} | MULTAS: ${penalties.length}${jiraContext}\n\nResponde JSON con: semaphore, semaphoreJustification, executiveAbstract (1 párrafo corto), executiveSummary (detallado), risks, recommendations.`;

    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: "Eres un Gerente de Proyectos Senior de Prodigio Tech. Analiza servicios recurrentes. Responde en español.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "executive_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              semaphore: { type: "string" },
              semaphoreJustification: { type: "string" },
              executiveAbstract: { type: "string" },
              executiveSummary: { type: "string" },
              risks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    level: { type: "string" },
                    description: { type: "string" },
                    mitigation: { type: "string" },
                  },
                  required: ["level", "description", "mitigation"],
                  additionalProperties: false,
                },
              },
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    priority: { type: "integer" },
                    title: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["priority", "title", "description"],
                  additionalProperties: false,
                },
              },
            },
            required: ["semaphore", "semaphoreJustification", "executiveAbstract", "executiveSummary", "risks", "recommendations"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content)
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "LLM no generó respuesta",
      });
    const parsed = JSON.parse(String(content));

    // Persist
    await updateRecurringService(input.serviceId, {
      aiHealthStatus: parsed.semaphore,
      aiHealthJustification: parsed.semaphoreJustification,
      aiExecutiveAbstract: parsed.executiveAbstract,
      aiFullAnalysis: JSON.stringify(parsed),
      aiAnalysisDate: new Date(),
    });

    await audit(ctx, "ai_generate", "recurring_service", input.serviceId, svc.serviceName, { type: "executive_analysis", semaphore: parsed.semaphore });
    return { ...parsed, fromCache: false, daysOld: 0 };
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPA 5: Cierre
  // ═══════════════════════════════════════════════════════════════════════════

  closeService: adminOrPmo.input(z.object({ serviceId: z.number(), notes: z.string().optional() })).mutation(async ({ ctx, input }) => {
    const svc = await getRecurringServiceById(input.serviceId);
    if (!svc) throw new TRPCError({ code: "NOT_FOUND" });
    const stage = await getRecurringServiceStage(input.serviceId, "cierre");
    if (!stage || stage.status !== "in_progress")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Etapa de cierre no está en progreso",
      });
    await completeRecurringStage(input.serviceId, "cierre", ctx.user.id);
    await updateRecurringService(input.serviceId, { status: "completado" });
    await audit(ctx, "stage_close", "recurring_service", input.serviceId, svc.serviceName, { stage: "cierre", notes: input.notes });
  }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Billing Month Status
  // ═══════════════════════════════════════════════════════════════════════════

  updateBillingStatus: adminOrPmo
    .input(
      z.object({
        id: z.number(),
        serviceId: z.number(),
        status: z.enum(["pendiente", "facturado", "pagado"]),
        invoiceNumber: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateBillingMonthStatus(input.id, input.status, input.invoiceNumber);
      await audit(ctx, "billing_status_change", "recurring_service", input.serviceId, null, { billingId: input.id, status: input.status });
    }),
});
