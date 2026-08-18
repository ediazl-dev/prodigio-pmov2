import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import {
  upsertUser, getUserByOpenId, getAllUsers, updateUserRole, updateUserStatus, inviteUser,
  deleteUser, getUserByEmail,
  createInvitation, getInvitationByToken, acceptInvitation, getPendingInvitations,
  getAllProjects, getProjectsByPm, getProjectById, createProject, updateProject,
  getProjectStages, updateProjectStage, unlockNextStage,
  getSowByProject, upsertSow,
  getRisksByProject, bulkInsertRisks, getConfirmedRisksByProject, bulkUpdateRiskConfirmed,
  getWbsByProject, bulkInsertWbs, updateWbsItemJiraKey,
  getBillingByProject, upsertBillingMilestones,
  getDesignByProject, upsertDesign,
  getLessonsByProject, upsertLesson,
  saveUploadedFile, getDashboardStats,
  saveSowVersion, getSowVersionsByProject,
  getAllStageDeadlines, upsertStageDeadline,
  getStageOpening, getStageOpeningsByProject, recordStageOpening,
  getAllHolidays, getHolidaysByYear,
  calculateDeadlineDate, calculateRemainingBusinessDays, calculateBusinessDaysBetween,
  getExtensionsByProjectStage, getExtensionsByProject, createExtension,
  isStagePaused, getTotalExtraDays, getTotalPausedDays,
  hasNotificationBeenSent, recordNotificationSent,
  getComplianceMetrics,
  getStageApproval, createStageApproval, closeStageApproval, deleteStageApproval,
  getUploadedFilesByProject, deleteUploadedFile,
  getStageClosure, createStageClosure, getAllStageClosures,
  getNextSowVersionNumber,
  getRiskVersionsByProject, getNextRiskVersionNumber, insertRiskVersion, updateRiskJiraKey, updateRiskConfirmed,
  createAuditLog, getAuditLogs, getAuditLogDistinctActions, getAuditLogDistinctEntities,
} from "./db";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import { generateSowDocx } from "./sowDocxGenerator";
import { sowToMarkdown } from "./sowMarkdownGenerator";
import { generateRiskMatrixExcel } from "./riskExcelGenerator";
import { generateBacklogExcel } from "./ganttBacklogExcel";
import { parseGanttBuffer, summarizeGantt } from "./ganttParser";
import { extractSowContent, extractGanttContent } from "./documentExtractor";
import { generateStatusReportPptx, type ReportData } from "./pptxReportGenerator";
import { listJiraProjects, getProjectIssues, getJiraProject, createJiraIssue, transitionJiraIssue, getAssignableUsers, getProjectStatuses, jiraHealthCheck, searchJiraIssues, getTemplateStructure, createJiraSpace, getJiraCurrentUser, getJiraProjectReport, getProjectBoards, getJiraAdvanceReport } from "./jiraClient";
import { createJiraSpaceRecord, getJiraSpaceByProject, getAllJiraSpaces, updateJiraSpaceStatus, insertGanttUpload, getLatestGanttUpload, updateBillingMilestoneJiraKey, createLinkedProject, getManagedJiraProjectKeys, unlinkProject, deleteProjectAdmin, bulkUpsertFinancialData, getFinancialDataSyncInfo, getAllFinancialData as getAllFinancialDataFromDb, saveExecutiveVerdict, getLatestVerdict, getVerdictHistory, getVerdictById, insertLinkedProjectDocument, getLinkedProjectDocuments, deleteLinkedProjectDocument, getLinkedProjectDocumentById, getLatestPMAnalysis, getLatestPMAnalysisWithReview, getPMAnalysisHistory, getMyProfileData, getExecutiveProjectSource, getExecutiveContractMilestones, getExecutiveMilestoneAcceptances, getExecutiveMeetingMinutes, getExecutiveCommitments, getExecutiveRequirements, getLatestExecutiveRecoveryPlan, getExecutiveRecoveryPlans, getExecutiveRecoveryPlanById, approveExecutiveRecoveryPlan, getExecutiveGovernanceAssignments, getLatestExecutiveFinancialSnapshot, getLatestExecutiveProductionDashboardSnapshot, createExecutiveMilestoneAcceptance, createExecutiveMeetingMinute, createExecutiveCommitment, createExecutiveRequirement, createExecutiveRecoveryPlan, getExecutiveRequirementById, closeExecutiveRequirement, waiveExecutiveRequirement, createExecutiveVerdictReview, reviewExecutiveVerdict } from "./db";
import { recurringServicesRouter } from "./recurringServicesRouter";
import { pmAnalysisJsonSchema, pmAnalysisSchema, validatePMAnalysisOutput } from "./pmAnalysisSchema";
import { runRiskGenerationAttempts } from "./riskGeneration";
import { isExecutiveDashboardV2PilotEnabled } from "./executiveDashboardV2";
import { calculateExecutiveGovernance, classifyMilestoneTimeline } from "./executiveGovernanceEngine";
import { resolveExecutiveDashboardCutoff } from "./executiveDashboardFixture";
import { buildExecutiveFinancialEvidence } from "./executiveFinancialEvidence";
import { isoWeekFromDate } from "./executiveMinutes";
import { canApproveExecutiveRecoveryPlan } from "./executiveRecoveryPlanPolicy";
import { canCloseExecutiveRequirement, canWaiveExecutiveRequirement } from "./executiveRequirements";
import { assessVerdictReviewEligibility } from "./executiveVerdictReviewPolicy";
import { assessMilestoneAcceptanceEligibility } from "./executiveMilestoneAcceptancePolicy";
import { extractReviewableCommitments } from "./executiveCommitmentExtraction";
import { calculateExecutiveMinutesCoverage } from "./executiveMinutesCoverage";
import { buildExecutiveOperationalEvidence } from "./executiveOperationalEvidence";
import { resolveExternalEvidence } from "./executiveExternalEvidence";

// ==================== HELPERS ====================
const adminOrPmo = protectedProcedure.use(({ ctx, next }) => {
  if (!["admin", "pmo"].includes(ctx.user.role)) throw new TRPCError({ code: "FORBIDDEN", message: "Requiere rol Admin o PMO" });
  return next({ ctx });
});
const adminOnly = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Requiere rol Admin" });
  return next({ ctx });
});

/** Helper to create audit log with user context */
function audit(ctx: { user: { id: number; name: string | null; role: string } }, action: string, entity: string, entityId?: string | number | null, entityName?: string | null, details?: Record<string, any> | null) {
  return createAuditLog({ action, entity, entityId, entityName, userId: ctx.user.id, userName: ctx.user.name ?? "Unknown", userRole: ctx.user.role, details });
}

const EXECUTIVE_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024;
const executiveEvidenceDocumentTypeSchema = z.enum(["minute", "acceptance", "recovery_plan"]);
type ExecutiveEvidenceDocumentType = z.infer<typeof executiveEvidenceDocumentTypeSchema>;

export function validateExecutiveEvidenceUpload(input: {
  documentType: ExecutiveEvidenceDocumentType;
  fileName: string;
  mimeType: string;
  contentBase64: string;
}) {
  const buffer = Buffer.from(input.contentBase64, "base64");
  if (!buffer.length || buffer.length > EXECUTIVE_EVIDENCE_MAX_BYTES) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo debe tener contenido y no superar 25 MB" });
  }

  const fileName = input.fileName.replace(/[\\/:*?"<>|\x00-\x1F]/g, "_").replace(/\.+/g, ".").trim();
  if (!fileName || fileName === ".") throw new TRPCError({ code: "BAD_REQUEST", message: "El nombre del archivo no es válido" });

  const extension = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  const isPdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const isZip = buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04;
  const documentRules: Record<ExecutiveEvidenceDocumentType, { allowed: Array<{ extension: string; mimeType: string; signature: boolean }> }> = {
    acceptance: { allowed: [{ extension: "pdf", mimeType: "application/pdf", signature: isPdf }] },
    minute: { allowed: [
      { extension: "pdf", mimeType: "application/pdf", signature: isPdf },
      { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: isZip },
    ] },
    recovery_plan: { allowed: [
      { extension: "pdf", mimeType: "application/pdf", signature: isPdf },
      { extension: "docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", signature: isZip },
    ] },
  };
  const rule = documentRules[input.documentType].allowed.find((item) => item.extension === extension && item.mimeType === input.mimeType && item.signature);
  if (!rule) {
    const accepted = input.documentType === "acceptance" ? "PDF" : "PDF o DOCX";
    throw new TRPCError({ code: "BAD_REQUEST", message: `Formato inválido para esta evidencia. Se admite ${accepted} y la firma del archivo debe coincidir.` });
  }

  return { buffer, fileName, mimeType: input.mimeType, sha256: createHash("sha256").update(buffer).digest("hex") };
}

// ==================== AUTH ROUTER ====================
const authRouter = router({
  me: publicProcedure.query((opts) => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ==================== USERS ROUTER ====================
const usersRouter = router({
  list: adminOrPmo.query(async () => getAllUsers()),
  updateRole: adminOnly.input(z.object({ userId: z.number(), role: z.enum(["admin", "pmo", "pm", "consulta"]) }))
    .mutation(async ({ input, ctx }) => {
      await updateUserRole(input.userId, input.role);
      await audit(ctx, "update_role", "user", input.userId, null, { newRole: input.role });
      return { success: true };
    }),
  updateStatus: adminOnly.input(z.object({ userId: z.number(), status: z.enum(["activo", "invitado", "desactivado"]) }))
    .mutation(async ({ input, ctx }) => {
      await updateUserStatus(input.userId, input.status);
      await audit(ctx, "update_status", "user", input.userId, null, { newStatus: input.status });
      return { success: true };
    }),
  delete: adminOnly.input(z.object({ userId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      if (input.userId === ctx.user.id) throw new TRPCError({ code: "BAD_REQUEST", message: "No puedes eliminarte a ti mismo" });
      await deleteUser(input.userId);
      await audit(ctx, "delete", "user", input.userId);
      return { success: true };
    }),
  invite: adminOrPmo.input(z.object({
    email: z.string().email(),
    name: z.string().min(1),
    role: z.enum(["pmo", "pm", "consulta"]),
    origin: z.string().url(),
  }))
    .mutation(async ({ ctx, input }) => {
      // Validar email único
      const existingUser = await getUserByEmail(input.email);
      if (existingUser && existingUser.status === "activo") {
        throw new TRPCError({ code: "CONFLICT", message: "Ya existe un usuario activo con este correo electrónico" });
      }
      // Create invitation token (48h expiry)
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      const inv = await createInvitation({
        email: input.email,
        name: input.name,
        role: input.role,
        token,
        invitedBy: ctx.user.id,
        expiresAt,
      });
      // Also create/update user record with invitado status
      await inviteUser(input.email, input.name, input.role);
      // Send invitation email via built-in forge API
      const inviteUrl = `${input.origin}/invite/${token}`;
      const roleLabels: Record<string, string> = { pmo: "PMO", pm: "PM", consulta: "Consulta" };
      const roleLabel = roleLabels[input.role] ?? input.role;
      try {
        const emailPayload = {
          to: input.email,
          subject: `Invitación a Prodigio`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;text-align:center">
    <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/Prodigio-Logo-500_f9858498.png" alt="Prodigio Tech" style="height:64px;width:64px;object-fit:contain;border-radius:50%" />
    <h1 style="color:#fff;margin:16px 0 4px;font-size:22px">Prodigio</h1>
  </div>
  <div style="padding:32px">
    <h2 style="color:#111;margin:0 0 8px">Hola, ${input.name}</h2>
    <p style="color:#555;line-height:1.6">Has sido invitado/a a unirte a <strong>Prodigio</strong> con el rol de <strong>${roleLabel}</strong>.</p>
    <p style="color:#555;line-height:1.6">Prodigio centraliza la gestión de proyectos, elaboración de SoW, planificación y seguimiento del ciclo de vida completo de cada proyecto.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${inviteUrl}" style="background:#e91e8c;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Aceptar Invitación</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center">Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este correo.</p>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#aaa;font-size:11px;margin:0">Prodigio · ${new Date().getFullYear()}</p>
  </div>
</div>`,
        };
        await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          },
          body: JSON.stringify(emailPayload),
        });
      } catch (e) {
        console.warn("[Invite] Email send failed (non-critical):", e);
      }
      await audit(ctx, "invite", "user", null, input.name, { email: input.email, role: input.role });
      return { success: true, inviteUrl, token };
    }),
  listInvitations: adminOrPmo.query(async () => getPendingInvitations()),
  resendInvitation: adminOrPmo.input(z.object({
    userId: z.number(),
    origin: z.string().url(),
  }))
    .mutation(async ({ ctx, input }) => {
      // Obtener el usuario que necesita reenvío
      const db = await import("./db");
      const allUsers = await db.getAllUsers();
      const targetUser = allUsers.find((u: { id: number }) => u.id === input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "Usuario no encontrado" });
      if (targetUser.status === "activo") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario ya está activo, no necesita nueva invitación" });
      }
      if (!targetUser.email) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El usuario no tiene email registrado" });
      }
      // Crear nuevo token con 48h de expiración
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
      await createInvitation({
        email: targetUser.email,
        name: targetUser.name ?? targetUser.email,
        role: (targetUser.role === "admin" ? "pmo" : targetUser.role) as "pmo" | "pm" | "consulta",
        token,
        invitedBy: ctx.user.id,
        expiresAt,
      });
      // Enviar email con el nuevo enlace
      const inviteUrl = `${input.origin}/invite/${token}`;
      const roleLabels: Record<string, string> = { pmo: "PMO", pm: "PM", consulta: "Consulta", admin: "Admin" };
      const roleLabel = roleLabels[targetUser.role ?? "pmo"] ?? targetUser.role;
      try {
        const emailPayload = {
          to: targetUser.email,
          subject: `Nueva invitación a Prodigio`,
          html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:32px;text-align:center">
    <img src="https://d2xsxph8kpxj0f.cloudfront.net/310519663043443217/bXMkzYF2PmF6AbhicJnZQ6/Prodigio-Logo-500_f9858498.png" alt="Prodigio Tech" style="height:64px;width:64px;object-fit:contain;border-radius:50%" />
    <h1 style="color:#fff;margin:16px 0 4px;font-size:22px">Prodigio</h1>
  </div>
  <div style="padding:32px">
    <h2 style="color:#111;margin:0 0 8px">Hola, ${targetUser.name ?? targetUser.email}</h2>
    <p style="color:#555;line-height:1.6">Se ha generado un <strong>nuevo enlace de invitación</strong> para acceder a <strong>Prodigio</strong> con el rol de <strong>${roleLabel}</strong>.</p>
    <p style="color:#555;line-height:1.6">Tu enlace anterior había expirado. Este nuevo enlace es válido por 48 horas.</p>
    <div style="text-align:center;margin:32px 0">
      <a href="${inviteUrl}" style="background:#e91e8c;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:16px;display:inline-block">Aceptar Invitación</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center">Este enlace expira en 48 horas. Si no esperabas esta invitación, puedes ignorar este correo.</p>
  </div>
  <div style="background:#f9fafb;padding:16px;text-align:center;border-top:1px solid #e5e7eb">
    <p style="color:#aaa;font-size:11px;margin:0">Prodigio · ${new Date().getFullYear()}</p>
  </div>
</div>`,
        };
        await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}`,
          },
          body: JSON.stringify(emailPayload),
        });
      } catch (e) {
        console.warn("[ResendInvite] Email send failed (non-critical):", e);
      }
      await audit(ctx, "resend_invite", "user", input.userId, targetUser.name ?? targetUser.email, { email: targetUser.email, role: targetUser.role });
      return { success: true, inviteUrl, token };
    }),
  acceptInvite: publicProcedure.input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const inv = await acceptInvitation(input.token);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no válida o expirada" });
      return { success: true, email: inv.email, name: inv.name, role: inv.role };
    }),
  getInvite: publicProcedure.input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const inv = await getInvitationByToken(input.token);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND", message: "Invitación no encontrada" });
      if (inv.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Esta invitación ya fue utilizada o expiró" });
      if (new Date() > inv.expiresAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Esta invitación ha expirado" });
      return inv;
    }),
});

// ==================== PROJECTS ROUTER ====================
const projectsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    if (["admin", "pmo"].includes(ctx.user.role)) return getAllProjects();
    // Consulta users can see all projects (read-only)
    return getAllProjects();
  }),
  get: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const project = await getProjectById(input.id);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const stages = await getProjectStages(input.id);
    const sow = await getSowByProject(input.id);
    return { ...project, stages, sow };
  }),
  create: adminOrPmo.input(z.object({
    projectName: z.string().min(1),
    clientName: z.string().min(1),
    clientContact: z.string().optional(),
    clientEmail: z.string().email().optional(),
    projectType: z.enum(["apigee", "desarrollo", "integracion", "data", "otro"]).optional(),
    pmId: z.number().optional(),
    totalAmount: z.string().optional(),
    currency: z.string().optional(),
    startDate: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const id = await createProject({
      ...input,
      pmoId: ctx.user.id,
      status: "activo",
      currentStage: "sow",
    } as any);
    await audit(ctx, "create", "project", id, input.projectName, { clientName: input.clientName, projectType: input.projectType });
    return { id };
  }),
  update: adminOrPmo.input(z.object({ id: z.number(), data: z.record(z.string(), z.any()) }))
    .mutation(async ({ input, ctx }) => {
      await updateProject(input.id, input.data);
      await audit(ctx, "update", "project", input.id, null, { fields: Object.keys(input.data) });
      return { success: true };
    }),
  stats: protectedProcedure.query(async () => getDashboardStats()),
  assignPm: adminOrPmo.input(z.object({ projectId: z.number(), pmId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateProject(input.projectId, { pmId: input.pmId });
      await audit(ctx, "assign_pm", "project", input.projectId, null, { pmId: input.pmId });
      return { success: true };
    }),
});

// ==================== STAGES ROUTER ====================
const STAGE_CLOSURE_DISCLAIMER = "El Gerente de Proyecto confirma que la información presentada en esta etapa corresponde a lo acordado con el cliente y ha sido validada para proceder con el cierre formal.";

const stagesRouter = router({
  getAll: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getProjectStages(input.projectId)),
  complete: protectedProcedure.input(z.object({ projectId: z.number(), stageId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await unlockNextStage(input.projectId, input.stageId);
      await audit(ctx, "complete_stage", "stage", input.stageId, null, { projectId: input.projectId });
      return { success: true };
    }),
  updateProgress: protectedProcedure.input(z.object({ projectId: z.number(), stageId: z.string(), progress: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateProjectStage(input.projectId, input.stageId, { progress: input.progress });
      await audit(ctx, "update_progress", "stage", input.stageId, null, { projectId: input.projectId, progress: input.progress });
      return { success: true };
    }),

  // Get closure disclaimer text
  getClosureDisclaimer: publicProcedure.query(() => STAGE_CLOSURE_DISCLAIMER),

  // Get closure info for a stage
  getClosure: protectedProcedure.input(z.object({ projectId: z.number(), stageId: z.string() }))
    .query(async ({ input }) => {
      const closure = await getStageClosure(input.projectId, input.stageId);
      return closure;
    }),

  // Get all closures for a project
  getAllClosures: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getAllStageClosures(input.projectId)),

  // Formal stage closure with GP confirmation
  formalClose: adminOrPmo.input(z.object({
    projectId: z.number(),
    stageId: z.string(),
    confirmed: z.boolean(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!input.confirmed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe confirmar que la información corresponde a lo acordado con el cliente.",
      });
    }

    // For SoW stage, verify that the SoW has been generated (no approval document required here)
    if (input.stageId === "sow") {
      const sow = await getSowByProject(input.projectId);
      if (!sow) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe generar el SoW antes de cerrar esta etapa.",
        });
      }
    }

    // For Risks stage, verify that the formalized SoW document has been uploaded
    if (input.stageId === "risks") {
      const risksApproval = await getStageApproval(input.projectId, "risks");
      if (!risksApproval) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Debe cargar el SoW formalizado (firmado por el cliente) en el paso 1 de esta etapa antes de cerrarla.",
        });
      }
      // Mark the approval as closed and update SoW status
      await closeStageApproval(input.projectId, "risks", ctx.user.id);
      const sow = await getSowByProject(input.projectId);
      if (sow && sow.status !== "approved") {
        await upsertSow(input.projectId, { status: "approved", approvedAt: new Date(), finalDocUrl: risksApproval.fileUrl });
      }
    }

    // For Risks stage, automatically create JIRA issues from CONFIRMED risks in "Identificado" status
    let jiraRiskResults: any = null;
    if (input.stageId === "risks") {
      const jiraStart = Date.now();
      try {
        // Process confirmed risks; if none are confirmed, fall back to ALL risks (auto-confirm all)
        const confirmedRisks = await getConfirmedRisksByProject(input.projectId);
        const allRisks = await getRisksByProject(input.projectId);
        // Fallback: if no risk is explicitly confirmed, treat all risks as confirmed
        const risksToCreate = confirmedRisks.length > 0 ? confirmedRisks : allRisks;
        const usingFallback = confirmedRisks.length === 0 && allRisks.length > 0;
        if (usingFallback) {
          console.log(`[formalClose] No confirmed risks found for project ${input.projectId}. Using all ${allRisks.length} risks as fallback.`);
        }
        const space = await getJiraSpaceByProject(input.projectId);
        if (risksToCreate.length > 0 && space && space.jiraProjectKey) {
          // Find the "Riesgos PMO" issue type from the space
          const issueTypes = (space.issueTypes as any[]) ?? [];
          const riskIssueType = issueTypes.find((it: any) =>
            it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
          );

          const PROB_MAP: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
          const IMPACT_MAP: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
          const TYPE_MAP: Record<string, string> = {
            riesgo: "Técnico", riesgo_oculto: "Oculto",
            supuesto_no_validado: "Supuesto No Validado", dependencia_externa: "Dependencia Externa",
          };

          const results: { riskId: number; riskCode: string; issueKey: string; success: boolean; transitioned?: boolean; error?: string }[] = [];

          for (const risk of risksToCreate) {
            if (risk.jiraIssueKey) {
              results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: risk.jiraIssueKey, success: true });
              continue;
            }
            try {
              const description = [
                `*Tipo:* ${TYPE_MAP[risk.type] ?? risk.type}`,
                `*Categoría:* ${risk.category}`,
                `*Probabilidad:* ${PROB_MAP[risk.probability] ?? risk.probability}`,
                `*Impacto:* ${IMPACT_MAP[risk.impact] ?? risk.impact}`,
                "",
                `*Descripción:*\n${risk.description}`,
                "",
                `*Estrategia de Mitigación:*\n${risk.mitigation ?? "Sin mitigación definida"}`,
                risk.contingency ? `\n*Plan de Contingencia:*\n${risk.contingency}` : "",
                risk.estimatedCost ? `\n*Costo Estimado:* ${risk.estimatedCost}` : "",
                risk.dueDate ? `\n*Fecha Estimada:* ${risk.dueDate}` : "",
              ].filter(Boolean).join("\n");

              const created = await createJiraIssue({
                projectKey: space.jiraProjectKey!,
                summary: `[${risk.riskCode ?? "RISK"}] ${risk.description?.substring(0, 200) ?? "Riesgo identificado"}`,
                description,
                issueTypeName: riskIssueType?.name ?? "Task",
                labels: ["PMO-Risk", risk.category, risk.probability].filter(Boolean),
              });
              if (created?.key) {
                await updateRiskJiraKey(risk.id, created.key);
                // Transition to "Identificado" status in the Riesgos PMO workflow
                const transitioned = await transitionJiraIssue(created.key, "Identificado");
                results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: created.key, success: true, transitioned });
              } else {
                results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: "", success: false, error: "No se pudo crear el issue" });
              }
            } catch (err: any) {
              results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: "", success: false, error: err.message });
            }
          }

          const createdCount = results.filter(r => r.success && r.issueKey).length;
          const skippedCount = usingFallback ? 0 : allRisks.length - risksToCreate.length;
          const errorCount = results.filter(r => !r.success).length;
          const alreadyExisted = results.filter(r => r.success && r.issueKey && risksToCreate.find(rk => rk.id === r.riskId)?.jiraIssueKey).length;
          const logEntries = results.map((r, idx) => {
            const risk = risksToCreate.find(rk => rk.id === r.riskId);
            return {
              riskCode: r.riskCode,
              description: risk?.description?.substring(0, 120) ?? "",
              type: risk?.type ?? "riesgo",
              probability: risk?.probability ?? "media",
              impact: risk?.impact ?? "medio",
              status: r.success ? (risksToCreate.find(rk => rk.id === r.riskId)?.jiraIssueKey ? "skipped" as const : "created" as const) : "error" as const,
              jiraKey: r.issueKey || null,
              errorMsg: r.error || null,
              index: idx + 1,
              total: results.length,
            };
          });
          jiraRiskResults = {
            success: true,
            projectKey: space.jiraProjectKey,
            created: createdCount - alreadyExisted,
            skipped: alreadyExisted + skippedCount,
            errors: errorCount,
            jiraKeys: results.filter(r => r.issueKey).map(r => r.issueKey),
            logEntries,
            totals: { confirmed: risksToCreate.length, total: allRisks.length },
            elapsedMs: Date.now() - jiraStart,
            spaceUrl: space.jiraProjectUrl || null,
            results, // keep raw results for backward compat
          };
          await audit(ctx, "auto_create_jira_issues", "risks", input.projectId, space.spaceName, {
            created: createdCount,
            total: risksToCreate.length,
            skipped: skippedCount,
            spaceKey: space.jiraProjectKey,
            trigger: "formal_close",
            usingFallback,
            operationLog: results.map(r => ({
              riskCode: r.riskCode,
              status: r.success ? "created" : "error",
              jiraKey: r.issueKey || null,
              transitioned: r.transitioned ?? null,
              errorMsg: r.error || null,
            })),
          });
        }
      } catch (jiraErr: any) {
        console.warn(`[formalClose] Error creating JIRA issues for risks (non-blocking):`, jiraErr.message);
      }
    }

    // Record the formal closure
    await createStageClosure({
      projectId: input.projectId,
      stageId: input.stageId,
      closedBy: ctx.user.id,
      closedByName: ctx.user.name || "Unknown",
      confirmationText: STAGE_CLOSURE_DISCLAIMER,
      notes: input.notes,
    });

    // Complete the stage and unlock next
    if (input.stageId === "closure") {
      // Final stage: mark project as completed
      await updateProjectStage(input.projectId, "closure", { status: "completed", progress: 100, completedAt: new Date() });
      await updateProject(input.projectId, { status: "completado" });
      await audit(ctx, "complete_project", "closure", input.projectId, null, { notes: input.notes });
    } else {
      await unlockNextStage(input.projectId, input.stageId);
      await audit(ctx, "formal_close_stage", input.stageId, input.projectId, null, { notes: input.notes });
    }

    return { success: true, jiraRiskResults };
  }),
});

// ==================== SOW ROUTER ====================
const sowRouter = router({
  get: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getSowByProject(input.projectId)),

  save: protectedProcedure.input(z.object({
    projectId: z.number(),
    data: z.record(z.string(), z.any()),
  })).mutation(async ({ input, ctx }) => {
    const id = await upsertSow(input.projectId, input.data);
    await updateProjectStage(input.projectId, "sow", { progress: 60 });
    await audit(ctx, "save", "sow", input.projectId, null, { fields: Object.keys(input.data) });
    return { id };
  }),

  approve: protectedProcedure.input(z.object({ projectId: z.number(), finalDocUrl: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      await upsertSow(input.projectId, { status: "approved", approvedAt: new Date(), finalDocUrl: input.finalDocUrl });
      await unlockNextStage(input.projectId, "sow");
      await audit(ctx, "approve", "sow", input.projectId);
      return { success: true };
    }),

  // Get source documents uploaded for SoW generation
  getSourceDocs: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getUploadedFilesByProject(input.projectId, "sow_source")),

  // Delete a source document
  deleteSourceDoc: protectedProcedure.input(z.object({ fileId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteUploadedFile(input.fileId);
      return { success: true };
    }),

  // Agentic: extract from multiple PDF URLs
  extractFromPdf: protectedProcedure.input(z.object({
    projectId: z.number(),
    pdfUrls: z.array(z.object({ url: z.string(), fileName: z.string() })),
    projectName: z.string(),
    clientName: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    if (input.pdfUrls.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Debe cargar al menos un documento" });

    const systemPrompt = `Eres un experto en gestión de proyectos de tecnología para Prodigio Tech.
Tu tarea es analizar los documentos proporcionados (propuesta técnica y/o propuesta económica) y extraer la información estructurada para completar un Statement of Work (SoW) corporativo con el formato estándar de Prodigio Tech (11 secciones).
Debes combinar la información de TODOS los documentos proporcionados para generar un SoW completo y profesional.
Debes responder ÚNICAMENTE con un JSON válido siguiendo el esquema exacto proporcionado.
El texto de cada campo debe estar redactado en español, en tono formal y profesional, listo para ser incluido directamente en el documento final sin edición adicional.`;

    const docList = input.pdfUrls.map((d, i) => `Documento ${i + 1}: ${d.fileName}`).join("\n");
    const userPrompt = `Analiza los siguientes documentos del proyecto "${input.projectName}" para el cliente "${input.clientName}":
${docList}

Combina la información de TODOS los documentos y completa el siguiente esquema JSON del SoW corporativo de Prodigio Tech (formato estándar de 11 secciones).

IMPORTANTE: Cada campo de texto debe estar completamente redactado, en español formal, listo para el documento final. No uses placeholders como "[descripción]".

{
  "introText": "Párrafo introductorio completo que describe el propósito del SoW, el contexto del proyecto, las partes involucradas y la fecha de entrada en vigor. Debe mencionar explícitamente a Prodigio Tech y al cliente.",

  "generalObjective": "Párrafo que describe el objetivo general del proyecto de forma completa y profesional, mencionando el resultado esperado y el valor para el cliente.",

  "specificObjectives": [
    "Objetivo específico 1 redactado completamente",
    "Objetivo específico 2 redactado completamente",
    "Objetivo específico 3 redactado completamente",
    "Objetivo específico 4: Asegurar la calidad de los entregables mediante criterios de aceptación definidos."
  ],

  "activitiesIncluded": [
    "Actividad 1 con descripción completa extraída de la propuesta",
    "Actividad 2 con descripción completa",
    "Gestión de avances, riesgos e incidencias durante todo el ciclo del proyecto.",
    "Coordinación y comunicación con los stakeholders definidos."
  ],

  "deliverables": [
    {"name": "Nombre del entregable 1", "description": "Descripción completa del entregable y sus criterios de aceptación"},
    {"name": "Nombre del entregable 2", "description": "Descripción completa"}
  ],

  "limitations": [
    "El equipo de Prodigio debe contar con los accesos y permisos necesarios para todas las herramientas y servicios implicados en el proceso previo al inicio del proyecto.",
    "Actividades no descritas en la sección de Actividades Incluidas quedan fuera del alcance de este SoW.",
    "Soporte posterior a la finalización del proyecto, salvo acuerdo expreso entre las partes.",
    "Cambios de alcance no gestionados mediante el proceso formal de Gestión de Cambios."
  ],

  "assumptions": [
    "El Cliente dispondrá de los recursos y aprobaciones necesarias en los plazos acordados.",
    "La información proporcionada por el Cliente será completa, oportuna y veraz.",
    "No se consideran cambios significativos en el alcance, salvo acuerdo formal entre las partes.",
    "Cualquier modificación a estos supuestos podrá impactar en plazos, costos o alcance del proyecto."
  ],

  "clientDependencies": [
    "Designar un responsable del proyecto con poder de decisión antes del inicio.",
    "Proveer acceso oportuno a la información, sistemas y recursos necesarios antes de iniciar el servicio.",
    "Participación activa en instancias de validación y aprobación dentro de los plazos acordados.",
    "Retrasos en estas dependencias podrán afectar el cronograma del proyecto."
  ],

  "risks": [
    "Entregables, accesos o definiciones del cliente no se entregan en tiempo y forma.",
    "Falta de participación del cliente en revisiones, aprobaciones o comités de seguimiento.",
    "Retrasos en decisiones clave y aceptación de entregables por parte del cliente.",
    "Complejidades técnicas no consideradas en la etapa de definición del alcance."
  ],

  "prerequisites": [
    "Contar con TODOS los accesos necesarios para el equipo del proyecto antes de iniciar las actividades.",
    "Asignación del líder o contraparte técnica por parte del cliente, responsable de gestionar, aceptar y aprobar la implementación.",
    "Acceso a VPN, de ser necesario, para el equipo de Prodigio Tech asignado al proyecto."
  ],

  "milestones": [
    {"number": 1, "description": "Hito 1 — Kickoff del proyecto", "deliverable": "Acta de inicio y plan de proyecto aprobado"},
    {"number": 2, "description": "Hito 2 — descripción según propuesta", "deliverable": "Entregable asociado"},
    {"number": 3, "description": "Hito 3 — descripción según propuesta", "deliverable": "Entregable asociado"},
    {"number": 4, "description": "Hito final — Cierre y aceptación del proyecto", "deliverable": "Acta de aceptación final firmada"}
  ],

  "meetingFrequency": "Descripción de la frecuencia de reuniones operativas y ejecutivas (a definir y complementar en Kickoff).",
  "communicationChannel": "Canal oficial de comunicación a definir en Kickoff (correo electrónico, plataforma de gestión de proyectos, etc.).",

  "totalAmount": "monto total extraído de la propuesta económica (ej: 50000)",
  "currency": "USD",

  "billingMilestones": [
    {"description": "Descripción del hito de facturación 1 (ej: Kickoff)", "percentage": "30", "amount": "monto calculado"},
    {"description": "Descripción del hito de facturación 2", "percentage": "40", "amount": "monto calculado"},
    {"description": "Descripción del hito de facturación 3 (ej: Cierre)", "percentage": "30", "amount": "monto calculado"}
  ],

  "prodigioTeam": [
    {"role": "Project Manager", "name": "Por definir", "responsibilities": "Gestión del proyecto, coordinación de actividades, comunicación periódica del estado y entrega de los entregables comprometidos."},
    {"role": "Líder Técnico", "name": "Por definir", "responsibilities": "Ejecución técnica de los servicios definidos en el SoW."}
  ],

  "clientTeam": [
    {"role": "Sponsor / Responsable del Proyecto", "name": "Por definir", "responsibilities": "Proveer información, accesos y recursos necesarios. Aprobar entregables y solicitudes de cambio en los plazos acordados."},
    {"role": "Contraparte Técnica", "name": "Por definir", "responsibilities": "Participar activamente en instancias de revisión y validación. Informar riesgos o impedimentos técnicos."}
  ]
}

Si no encuentras información específica para un campo en los documentos, usa los valores por defecto indicados arriba.
Responde SOLO con el JSON, sin texto adicional ni bloques de código markdown.`;

    try {
      // Build content array with all PDFs
      const contentParts: any[] = input.pdfUrls.map(doc => ({
        type: "file_url" as const,
        file_url: { url: doc.url, mime_type: "application/pdf" as const },
      }));
      contentParts.push({ type: "text" as const, text: userPrompt });

      const sowJsonSchema = {
        type: "object" as const,
        properties: {
          projectName: { type: "string" },
          clientName: { type: "string" },
          startDate: { type: "string" },
          endDate: { type: "string" },
          duration: { type: "string" },
          executiveSummary: { type: "string" },
          objectives: { type: "array", items: { type: "string" } },
          scope: { type: "string" },
          outOfScope: { type: "array", items: { type: "string" } },
          deliverables: { type: "array", items: { type: "object", properties: { name: { type: "string" }, description: { type: "string" } }, required: ["name", "description"], additionalProperties: false } },
          methodology: { type: "string" },
          clientDependencies: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          prerequisites: { type: "array", items: { type: "string" } },
          milestones: { type: "array", items: { type: "object", properties: { number: { type: "number" }, description: { type: "string" }, deliverable: { type: "string" } }, required: ["number", "description", "deliverable"], additionalProperties: false } },
          meetingFrequency: { type: "string" },
          communicationChannel: { type: "string" },
          totalAmount: { type: "string" },
          currency: { type: "string" },
          billingMilestones: { type: "array", items: { type: "object", properties: { description: { type: "string" }, percentage: { type: "string" }, amount: { type: "string" } }, required: ["description", "percentage", "amount"], additionalProperties: false } },
          prodigioTeam: { type: "array", items: { type: "object", properties: { role: { type: "string" }, name: { type: "string" }, responsibilities: { type: "string" } }, required: ["role", "name", "responsibilities"], additionalProperties: false } },
          clientTeam: { type: "array", items: { type: "object", properties: { role: { type: "string" }, name: { type: "string" }, responsibilities: { type: "string" } }, required: ["role", "name", "responsibilities"], additionalProperties: false } },
        },
        required: ["projectName", "clientName", "executiveSummary", "scope", "deliverables", "milestones", "totalAmount", "currency", "billingMilestones", "prodigioTeam", "clientTeam"],
        additionalProperties: false,
      };

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: contentParts },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sow_extraction",
            strict: true,
            schema: sowJsonSchema,
          },
        } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      let contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      // Strip markdown code blocks if model still wraps response (fallback safety)
      contentStr = contentStr.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
      const parsedExtraction = JSON.parse(contentStr);
      const hasStructuredExtraction = Boolean(
        parsedExtraction
        && typeof parsedExtraction === "object"
        && !Array.isArray(parsedExtraction)
        && Object.keys(parsedExtraction).length > 0
      );
      const extracted = hasStructuredExtraction
        ? parsedExtraction
        : {
            projectName: input.projectName,
            clientName: input.clientName,
            startDate: "",
            endDate: "",
            duration: "",
            executiveSummary: `Borrador inicial del SoW para ${input.projectName}. Completar y validar el contenido extraído antes de su aprobación formal.`,
            objectives: [],
            scope: "Pendiente de completar con la propuesta y los antecedentes del proyecto.",
            outOfScope: [],
            deliverables: [],
            methodology: "Pendiente de validación por el equipo PMO.",
            clientDependencies: [],
            risks: [],
            prerequisites: [],
            milestones: [],
            meetingFrequency: "",
            communicationChannel: "",
            totalAmount: "",
            currency: "USD",
            billingMilestones: [],
            prodigioTeam: [],
            clientTeam: [],
            extractionFallback: true,
          };

      // Map LLM field names → form field names expected by the frontend
      const mapped = {
        generalObjective: extracted.executiveSummary ?? extracted.generalObjective ?? "",
        specificObjectives: extracted.objectives ?? extracted.specificObjectives ?? [],
        activitiesIncluded: Array.isArray(extracted.scope)
          ? extracted.scope
          : extracted.scope
            ? [extracted.scope]
            : extracted.activitiesIncluded ?? [],
        deliverables: extracted.deliverables ?? [],
        limitations: extracted.outOfScope ?? extracted.limitations ?? [],
        assumptions: extracted.assumptions ?? [],
        clientDependencies: extracted.clientDependencies ?? [],
        risks: extracted.risks ?? [],
        prerequisites: extracted.prerequisites ?? [],
        milestones: extracted.milestones ?? [],
        meetingFrequency: extracted.meetingFrequency ?? "",
        communicationChannel: extracted.communicationChannel ?? "",
        totalAmount: extracted.totalAmount ?? "",
        currency: extracted.currency ?? "USD",
        introText: extracted.introText ?? "",
        billingMilestones: extracted.billingMilestones ?? [],
        prodigioTeam: extracted.prodigioTeam ?? [],
        clientTeam: extracted.clientTeam ?? [],
        // Preserve extra fields from LLM (projectName, clientName, startDate, etc.)
        projectName: extracted.projectName ?? input.projectName,
        clientName: extracted.clientName ?? input.clientName,
        startDate: extracted.startDate ?? "",
        endDate: extracted.endDate ?? "",
        duration: extracted.duration ?? "",
        methodology: extracted.methodology ?? "",
      };

      const id = await upsertSow(input.projectId, {
        ...mapped,
        sourcePdfUrl: input.pdfUrls[0].url,
        aiExtracted: true,
        status: "draft",
      });

      await updateProjectStage(input.projectId, "sow", { progress: 40 });
      await audit(ctx, "extract_pdf", "sow", input.projectId, input.projectName, {
        documentsUsed: input.pdfUrls.map(d => d.fileName),
        documentCount: input.pdfUrls.length,
      });
      return { success: true, id, data: extracted };
    } catch (error: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al procesar documentos: ${error.message}` });
    }
  }),

  // Generate DOCX
  // Get next auto-serialized version number
  getNextVersion: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const nextVersion = await getNextSowVersionNumber(input.projectId);
      return { nextVersion };
    }),

  downloadDocx: protectedProcedure.input(z.object({
    projectId: z.number(),
    redactor: z.string().optional(),
    redactorRole: z.string().optional(),
    version: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const sow = await getSowByProject(input.projectId);
    // Auto-serialize version if not provided
    const autoVersion = input.version || await getNextSowVersionNumber(input.projectId);
    const docxBuffer = await generateSowDocx({
      projectName: project.projectName,
      clientName: project.clientName,
      version: autoVersion,
      redactor: input.redactor ?? ctx.user.name ?? "Prodigio Tech",
      redactorRole: input.redactorRole ?? ctx.user.role ?? "Project Manager",
      date: new Date().toLocaleDateString("es-CL"),
      generalObjective: sow?.generalObjective ?? undefined,
      specificObjectives: Array.isArray(sow?.specificObjectives) ? sow.specificObjectives as string[] : undefined,
      activitiesIncluded: Array.isArray(sow?.activitiesIncluded) ? sow.activitiesIncluded as string[] : undefined,
      deliverables: Array.isArray(sow?.deliverables) ? sow.deliverables as any[] : undefined,
      limitations: Array.isArray(sow?.limitations) ? sow.limitations as string[] : undefined,
      assumptions: Array.isArray(sow?.assumptions) ? sow.assumptions as string[] : undefined,
      clientDependencies: Array.isArray(sow?.clientDependencies) ? sow.clientDependencies as string[] : undefined,
      risks: Array.isArray(sow?.risks) ? sow.risks as string[] : undefined,
      prerequisites: Array.isArray(sow?.prerequisites) ? sow.prerequisites as string[] : undefined,
      milestones: Array.isArray(sow?.milestones) ? sow.milestones as any[] : undefined,
      meetingFrequency: sow?.meetingFrequency ?? undefined,
      communicationChannel: sow?.communicationChannel ?? undefined,
      totalAmount: sow?.totalAmount ?? undefined,
      currency: sow?.currency ?? "USD",
      billingMilestones: Array.isArray(sow?.billingMilestones) ? sow.billingMilestones as any[] : undefined,
      prodigioTeam: Array.isArray(sow?.prodigioTeam) ? sow.prodigioTeam as any[] : undefined,
      clientTeam: Array.isArray(sow?.clientTeam) ? sow.clientTeam as any[] : undefined,
      introText: sow?.introText ?? undefined,
    });
    // Upload to S3 and return URL
    const safeName = project.projectName.replace(/\s+/g, '_');
    const key = `sow-docx/${input.projectId}/${nanoid()}-SoW_${safeName}.docx`;
    const { url } = await storagePut(key, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    const fileName = `SoW_${safeName}_${autoVersion}.docx`;
    // Save version to history with serialized version
    await saveSowVersion({
      projectId: input.projectId,
      version: autoVersion,
      redactor: input.redactor ?? ctx.user.name ?? "Prodigio Tech",
      redactorRole: input.redactorRole ?? ctx.user.role ?? "Project Manager",
      fileName,
      url,
      fileSize: docxBuffer.length,
    });
    await audit(ctx, "download_docx", "sow", input.projectId, project.projectName, { version: autoVersion });
    return { url, fileName, version: autoVersion };
  }),
  // Generate DOCX preview (no version saved)
  previewDocx: protectedProcedure.input(z.object({
    projectId: z.number(),
    redactor: z.string().optional(),
    redactorRole: z.string().optional(),
    version: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const sow = await getSowByProject(input.projectId);
    const docxBuffer = await generateSowDocx({
      projectName: project.projectName,
      clientName: project.clientName,
      version: input.version ?? "1.0",
      redactor: input.redactor ?? ctx.user.name ?? "Prodigio Tech",
      redactorRole: input.redactorRole ?? ctx.user.role ?? "Project Manager",
      date: new Date().toLocaleDateString("es-CL"),
      generalObjective: sow?.generalObjective ?? undefined,
      specificObjectives: Array.isArray(sow?.specificObjectives) ? sow.specificObjectives as string[] : undefined,
      activitiesIncluded: Array.isArray(sow?.activitiesIncluded) ? sow.activitiesIncluded as string[] : undefined,
      deliverables: Array.isArray(sow?.deliverables) ? sow.deliverables as any[] : undefined,
      limitations: Array.isArray(sow?.limitations) ? sow.limitations as string[] : undefined,
      assumptions: Array.isArray(sow?.assumptions) ? sow.assumptions as string[] : undefined,
      clientDependencies: Array.isArray(sow?.clientDependencies) ? sow.clientDependencies as string[] : undefined,
      risks: Array.isArray(sow?.risks) ? sow.risks as string[] : undefined,
      prerequisites: Array.isArray(sow?.prerequisites) ? sow.prerequisites as string[] : undefined,
      milestones: Array.isArray(sow?.milestones) ? sow.milestones as any[] : undefined,
      meetingFrequency: sow?.meetingFrequency ?? undefined,
      communicationChannel: sow?.communicationChannel ?? undefined,
      totalAmount: sow?.totalAmount ?? undefined,
      currency: sow?.currency ?? "USD",
      billingMilestones: Array.isArray(sow?.billingMilestones) ? sow.billingMilestones as any[] : undefined,
      prodigioTeam: Array.isArray(sow?.prodigioTeam) ? sow.prodigioTeam as any[] : undefined,
      clientTeam: Array.isArray(sow?.clientTeam) ? sow.clientTeam as any[] : undefined,
      introText: sow?.introText ?? undefined,
    });
    // Upload preview to S3 with temporary key
    const safeName = project.projectName.replace(/\s+/g, '_');
    const key = `sow-preview/${input.projectId}/${nanoid()}-preview.docx`;
    const { url } = await storagePut(key, docxBuffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    return { url };
  }),
  // Preview SoW as Markdown (returns markdown string directly, no S3 upload)
  previewMarkdown: protectedProcedure.input(z.object({
    projectId: z.number(),
  })).query(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const sow = await getSowByProject(input.projectId);
    const markdown = sowToMarkdown({
      projectName: project.projectName,
      clientName: project.clientName,
      version: "1.0",
      redactor: ctx.user.name ?? "Prodigio Tech",
      redactorRole: ctx.user.role ?? "Project Manager",
      date: new Date().toLocaleDateString("es-CL"),
      generalObjective: sow?.generalObjective ?? undefined,
      specificObjectives: Array.isArray(sow?.specificObjectives) ? sow.specificObjectives as string[] : undefined,
      activitiesIncluded: Array.isArray(sow?.activitiesIncluded) ? sow.activitiesIncluded as string[] : undefined,
      deliverables: Array.isArray(sow?.deliverables) ? sow.deliverables as any[] : undefined,
      limitations: Array.isArray(sow?.limitations) ? sow.limitations as string[] : undefined,
      assumptions: Array.isArray(sow?.assumptions) ? sow.assumptions as string[] : undefined,
      clientDependencies: Array.isArray(sow?.clientDependencies) ? sow.clientDependencies as string[] : undefined,
      risks: Array.isArray(sow?.risks) ? sow.risks as string[] : undefined,
      prerequisites: Array.isArray(sow?.prerequisites) ? sow.prerequisites as string[] : undefined,
      milestones: Array.isArray(sow?.milestones) ? sow.milestones as any[] : undefined,
      meetingFrequency: sow?.meetingFrequency ?? undefined,
      communicationChannel: sow?.communicationChannel ?? undefined,
      totalAmount: sow?.totalAmount ?? undefined,
      currency: sow?.currency ?? "USD",
      billingMilestones: Array.isArray(sow?.billingMilestones) ? sow.billingMilestones as any[] : undefined,
      prodigioTeam: Array.isArray(sow?.prodigioTeam) ? sow.prodigioTeam as any[] : undefined,
      clientTeam: Array.isArray(sow?.clientTeam) ? sow.clientTeam as any[] : undefined,
      introText: sow?.introText ?? undefined,
    });
    return { markdown };
  }),

  // Download SoW as Markdown
  downloadMarkdown: protectedProcedure.input(z.object({
    projectId: z.number(),
    version: z.string().optional(),
    redactor: z.string().optional(),
    redactorRole: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND" });
    const sow = await getSowByProject(input.projectId);
    const markdown = sowToMarkdown({
      projectName: project.projectName,
      clientName: project.clientName,
      version: input.version ?? "1.0",
      redactor: input.redactor ?? ctx.user.name ?? "Prodigio Tech",
      redactorRole: input.redactorRole ?? ctx.user.role ?? "Project Manager",
      date: new Date().toLocaleDateString("es-CL"),
      generalObjective: sow?.generalObjective ?? undefined,
      specificObjectives: Array.isArray(sow?.specificObjectives) ? sow.specificObjectives as string[] : undefined,
      activitiesIncluded: Array.isArray(sow?.activitiesIncluded) ? sow.activitiesIncluded as string[] : undefined,
      deliverables: Array.isArray(sow?.deliverables) ? sow.deliverables as any[] : undefined,
      limitations: Array.isArray(sow?.limitations) ? sow.limitations as string[] : undefined,
      assumptions: Array.isArray(sow?.assumptions) ? sow.assumptions as string[] : undefined,
      clientDependencies: Array.isArray(sow?.clientDependencies) ? sow.clientDependencies as string[] : undefined,
      risks: Array.isArray(sow?.risks) ? sow.risks as string[] : undefined,
      prerequisites: Array.isArray(sow?.prerequisites) ? sow.prerequisites as string[] : undefined,
      milestones: Array.isArray(sow?.milestones) ? sow.milestones as any[] : undefined,
      meetingFrequency: sow?.meetingFrequency ?? undefined,
      communicationChannel: sow?.communicationChannel ?? undefined,
      totalAmount: sow?.totalAmount ?? undefined,
      currency: sow?.currency ?? "USD",
      billingMilestones: Array.isArray(sow?.billingMilestones) ? sow.billingMilestones as any[] : undefined,
      prodigioTeam: Array.isArray(sow?.prodigioTeam) ? sow.prodigioTeam as any[] : undefined,
      clientTeam: Array.isArray(sow?.clientTeam) ? sow.clientTeam as any[] : undefined,
      introText: sow?.introText ?? undefined,
    });
    // Upload to S3
    const safeName = project.projectName.replace(/\s+/g, '_');
    const key = `sow-markdown/${input.projectId}/${nanoid()}-SoW-${safeName}.md`;
    const { url } = await storagePut(key, Buffer.from(markdown, 'utf-8'), "text/markdown");
    const fileName = `SoW-${safeName}-v${input.version ?? '1.0'}.md`;
    return { url, fileName };
  }),

  // List SoW version history
  versions: protectedProcedure.input(z.object({ projectId: z.number() })).query(async ({ input }) => {
    return getSowVersionsByProject(input.projectId);
  }),
  // Get stage approval document
  getApproval: protectedProcedure.input(z.object({
    projectId: z.number(),
    stageId: z.string().optional(),
  })).query(async ({ input }) => {
    const approval = await getStageApproval(input.projectId, input.stageId ?? "sow");
    if (!approval) return null;
    // Enrich with user names
    let closedByName: string | null = null;
    let uploadedByName: string | null = null;
    if (approval.closedBy) {
      const allUsers = await getAllUsers();
      const closedUser = allUsers.find(u => u.id === approval.closedBy);
      closedByName = closedUser?.name ?? null;
      const uploadUser = allUsers.find(u => u.id === approval.uploadedBy);
      uploadedByName = uploadUser?.name ?? null;
    } else {
      const allUsers = await getAllUsers();
      const uploadUser = allUsers.find(u => u.id === approval.uploadedBy);
      uploadedByName = uploadUser?.name ?? null;
    }
    return { ...approval, closedByName, uploadedByName };
  }),

  // Upload approved SoW document (signed by client)
  uploadApproval: adminOrPmo.input(z.object({
    projectId: z.number(),
    stageId: z.string().default("sow"),
    fileName: z.string(),
    fileBase64: z.string(),
    mimeType: z.string(),
    notes: z.string().optional(),
    clientApproverName: z.string().optional(),
    clientApprovalDate: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const stageId = input.stageId ?? "sow";
    const key = `sow-approvals/${input.projectId}/${stageId}/${nanoid()}-${input.fileName}`;
    const { url } = await storagePut(key, buffer as Buffer, input.mimeType);
    const id = await createStageApproval({
      projectId: input.projectId,
      stageId,
      fileName: input.fileName,
      fileUrl: url,
      fileKey: key,
      fileSize: buffer.length,
      mimeType: input.mimeType,
      notes: input.notes,
      clientApproverName: input.clientApproverName,
      clientApprovalDate: input.clientApprovalDate,
      uploadedBy: ctx.user.id,
    });
    await audit(ctx, "upload_approval", stageId, input.projectId, input.fileName, {
      clientApproverName: input.clientApproverName,
      clientApprovalDate: input.clientApprovalDate,
    });
    return { id, url, fileName: input.fileName };
  }),

  // Delete approval document
  deleteApproval: adminOrPmo.input(z.object({
    approvalId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    await deleteStageApproval(input.approvalId);
    await audit(ctx, "delete_approval", "sow", input.approvalId);
    return { success: true };
  }),

  // Close SoW stage - DEPRECATED: use stages.formalClose instead
  // Kept for backward compatibility, delegates to the same logic
  closeStage: adminOrPmo.input(z.object({
    projectId: z.number(),
    confirmed: z.boolean().default(true),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!input.confirmed) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe confirmar que la información corresponde a lo acordado con el cliente.",
      });
    }
    // Verify that the SoW has been generated (approval document is no longer required here)
    const sow = await getSowByProject(input.projectId);
    if (!sow) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Debe generar el SoW antes de cerrar la etapa.",
      });
    }
    // Record formal closure
    await createStageClosure({
      projectId: input.projectId,
      stageId: "sow",
      closedBy: ctx.user.id,
      closedByName: ctx.user.name || "Unknown",
      confirmationText: STAGE_CLOSURE_DISCLAIMER,
      notes: input.notes,
    });
    // Complete the stage and unlock next
    await updateProjectStage(input.projectId, "sow", { status: "completed", progress: 100 });
    await unlockNextStage(input.projectId, "sow");
    await audit(ctx, "formal_close_stage", "sow", input.projectId, null, { notes: input.notes });
    return { success: true };
  }),

  // Upload PDF and get URL
  uploadPdf: protectedProcedure.input(z.object({
    projectId: z.number(),
    fileName: z.string(),
    fileBase64: z.string(),
    mimeType: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    const key = `sow-pdfs/${input.projectId}/${nanoid()}-${input.fileName}`;
    const { url } = await storagePut(key, buffer as Buffer, input.mimeType);
    await saveUploadedFile({
      projectId: input.projectId,
      uploadedBy: ctx.user.id,
      fileName: input.fileName,
      fileKey: key,
      fileUrl: url,
      mimeType: input.mimeType,
      fileSize: buffer.length,
      purpose: "sow_source",
    });
    return { url, key };
  }),
});

// ==================== RISKS ROUTER ====================
const risksRouter = router({
  get: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getRisksByProject(input.projectId)),

  generate: protectedProcedure.input(z.object({
    projectId: z.number(),
    context: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    const sow = await getSowByProject(input.projectId);
    // Fetch the formalized SoW PDF: prefer stageId="sow" (new location), fallback to "risks" (legacy)
    const sowApproval = await getStageApproval(input.projectId, "sow") ?? await getStageApproval(input.projectId, "risks");
    const projectType = project?.projectType ?? "otro";

    // Build structured SoW context from DB fields
    const sowStructuredContext = sow ? [
      `Objetivo General: ${sow.generalObjective || "N/A"}`,
      `Actividades Incluidas: ${JSON.stringify(sow.activitiesIncluded || [])}`,
      `Entregables: ${JSON.stringify(sow.deliverables || [])}`,
      `Limitaciones / Fuera de Alcance: ${JSON.stringify(sow.limitations || [])}`,
      `Supuestos: ${JSON.stringify(sow.assumptions || [])}`,
      `Dependencias del Cliente: ${JSON.stringify(sow.clientDependencies || [])}`,
      `Equipo Prodigio: ${JSON.stringify(sow.prodigioTeam || [])}`,
      `Equipo Cliente: ${JSON.stringify(sow.clientTeam || [])}`,
      `Monto Total: ${sow.totalAmount || "N/A"} ${sow.currency || "USD"}`,
      `Hitos de Facturación: ${JSON.stringify(sow.billingMilestones || [])}`,
    ].join("\n") : "SoW no disponible";

    // Risk catalog by project type — knowledge base of a Senior PM
    const riskCatalogByType: Record<string, string> = {
      apigee: `Riesgos estándar para proyectos Apigee/API Management:
- Complejidad de integración con sistemas legacy y múltiples backends
- Curva de aprendizaje del equipo en Apigee hybrid/cloud
- Gestión de políticas de seguridad (OAuth, API keys, rate limiting)
- Dependencia de infraestructura GCP/on-premise y permisos de red
- Migración de APIs existentes sin impacto en producción
- Compliance regulatorio (SFA, Open Banking, GDPR)
- Disponibilidad de ambientes de desarrollo/staging del cliente
- Cambios de requerimientos en contratos de APIs con terceros`,
      desarrollo: `Riesgos estándar para proyectos de Desarrollo de Software:
- Scope creep y cambios de requerimientos durante el desarrollo
- Deuda técnica acumulada y calidad del código
- Integración con sistemas externos y APIs de terceros
- Disponibilidad y estabilidad de ambientes del cliente
- Rotación de personal técnico clave
- Pruebas de aceptación del usuario (UAT) y criterios de aceptación ambiguos
- Rendimiento y escalabilidad bajo carga real
- Seguridad de datos y vulnerabilidades en el código`,
      integracion: `Riesgos estándar para proyectos de Integración:
- Incompatibilidad de formatos de datos entre sistemas
- Latencia y rendimiento en flujos de integración
- Disponibilidad y estabilidad de APIs/servicios de terceros
- Gestión de errores y reintentos en flujos críticos
- Cambios de versión en APIs externas sin previo aviso
- Seguridad en la transmisión de datos sensibles
- Falta de documentación técnica de sistemas legados
- Coordinación con múltiples equipos de TI del cliente`,
      data: `Riesgos estándar para proyectos de Data/Analytics:
- Calidad e integridad de los datos fuente
- Acceso y permisos a fuentes de datos del cliente
- Cambios en esquemas de bases de datos fuente
- Rendimiento de pipelines ETL/ELT con volúmenes reales
- Gobernanza de datos y cumplimiento normativo
- Disponibilidad de infraestructura de datos (data warehouse, lakes)
- Interpretación y validación de métricas de negocio
- Adopción de herramientas de BI por usuarios finales`,
      otro: `Riesgos estándar para proyectos de Tecnología:
- Alcance mal definido o requerimientos ambiguos
- Disponibilidad de recursos clave del cliente
- Cambios organizacionales durante el proyecto
- Dependencias de terceros y proveedores externos
- Gestión del cambio y adopción tecnológica
- Riesgos de seguridad y cumplimiento normativo`,
    };
    const riskCatalog = riskCatalogByType[projectType] || riskCatalogByType["otro"];

    // Build the LLM messages — with or without PDF
    const systemPrompt = `Eres un Gerente de Proyectos Senior (PMP, PMI-RMP) de Prodigio Tech con más de 15 años de experiencia liderando proyectos de tecnología y transformación digital para empresas de servicios financieros, telecomunicaciones y gobierno en Latinoamérica.

Tu especialidad es la **identificación y gestión proactiva de riesgos** bajo metodología PMI/PMBOK (Capítulo 11 - Gestión de Riesgos) combinada con marcos ágiles (Scrum, SAFe). Has gestionado más de 50 proyectos y has desarrollado un instinto afinado para detectar riesgos ocultos que otros gerentes pasan por alto.

## Tu Enfoque de Análisis de Riesgos

Como GP Senior, tu proceso de identificación de riesgos sigue estas técnicas:

1. **Análisis del SoW línea por línea**: Cada entregable, supuesto, limitación y dependencia es una fuente potencial de riesgo. Si el SoW dice "el cliente proveerá X", eso es una dependencia externa. Si dice "se asume que Y", eso es un supuesto no validado.

2. **Técnica de los 5 Porqués**: Para cada riesgo identificado, profundizas en la causa raíz preguntando "¿por qué podría fallar esto?" hasta llegar al factor subyacente real.

3. **Análisis de Stakeholders**: Identificas riesgos derivados de la dinámica entre equipos (Prodigio vs Cliente), niveles de madurez técnica del cliente, y posibles conflictos de prioridades.

4. **Lecciones Aprendidas**: Aplicas patrones de riesgo de proyectos similares anteriores de Prodigio Tech — sabes que los proyectos de tipo "${projectType}" típicamente fallan por razones específicas.

5. **Análisis de Dependencias Críticas**: Mapeas la cadena de dependencias del proyecto e identificas puntos únicos de fallo (SPOF) que podrían paralizar el avance.

6. **Riesgos de Segundo Orden**: No solo identificas el riesgo directo, sino también los efectos cascada — si el riesgo A se materializa, ¿qué otros riesgos desencadena?

## Reglas Estrictas

- Cada riesgo DEBE estar anclado a un elemento específico del SoW (entregable, actividad, supuesto, limitación, dependencia, hito de facturación, o composición del equipo)
- Las mitigaciones DEBEN ser concretas, accionables y asignadas a roles reales del equipo definido en el SoW (no roles genéricos como "el equipo")
- Cada mitigación debe incluir: (1) acción preventiva, (2) plan de contingencia, (3) indicador de alerta temprana
- Los riesgos deben ser específicos al proyecto, NO genéricos — evita frases como "problemas de comunicación" sin contexto

Responde SOLO con un objeto JSON con la key "risks" conteniendo un array de riesgos.`;

    const userPromptText = `Analiza el siguiente proyecto como Gerente de Proyectos Senior y genera una Matriz de Riesgos profesional de nivel ejecutivo.

## Datos del Proyecto
Nombre: ${project?.projectName || input.context}
Cliente: ${project?.clientName || "N/A"}
Tipo de Proyecto: ${projectType.toUpperCase()}

## Contenido del SoW Formalizado (datos estructurados)
${sowStructuredContext}

## Catálogo de Riesgos Estándar para Proyectos ${projectType.toUpperCase()}
${riskCatalog}

## Instrucciones de Análisis

1. **Lectura profunda del SoW**: Analiza CADA sección del SoW — objetivo, actividades, entregables, limitaciones, supuestos, dependencias, equipo y facturación. Cada sección es fuente de riesgos.

2. **Riesgos técnicos (5-6)**: Identifica riesgos específicos del tipo de proyecto "${projectType}" anclados a entregables y actividades concretas del SoW. No repitas el catálogo textualmente — contextualiza cada riesgo al proyecto.

3. **Riesgos organizacionales (3-4)**: Analiza la composición del equipo (Prodigio y Cliente), la estructura de gobernanza, y los canales de comunicación. ¿Hay roles críticos sin backup? ¿El cliente tiene capacidad para cumplir sus compromisos?

4. **Riesgos ocultos (3-4)**: Estos son los que te diferencian como GP Senior. Busca:
   - Supuestos implícitos no escritos en el SoW
   - Dependencias entre entregables que crean cuellos de botella
   - Riesgos de segundo orden (cascada)
   - Deuda técnica o complejidad subestimada
   - Riesgos políticos u organizacionales del lado del cliente

5. **Supuestos no validados (2-3)**: Cada supuesto del SoW es un riesgo potencial. ¿Qué pasa si el supuesto no se cumple?

6. **Dependencias externas (2-3)**: Identifica todas las dependencias del cliente y de terceros. ¿Cuáles son críticas para el camino crítico?

Responde con un objeto JSON: { "risks": [...] }

Cada riesgo debe tener esta estructura:
{
  "riskCode": "R001",
  "description": "Descripción específica: qué evento podría ocurrir, por qué (causa raíz en el contexto del proyecto), y cuál sería el impacto en costo/plazo/calidad. Referencia la sección específica del SoW.",
  "category": "tecnico" | "organizacional" | "externo" | "oculto",
  "type": "riesgo" | "riesgo_oculto" | "supuesto_no_validado" | "dependencia_externa",
  "probability": "alta" | "media" | "baja",
  "impact": "alto" | "medio" | "bajo",
  "mitigation": "1) Acción preventiva específica con responsable del equipo del SoW. 2) Plan de contingencia si el riesgo se materializa. 3) Indicador de alerta temprana para monitoreo.",
  "owner": "Rol específico del equipo del SoW (ej: Project Manager, Arquitecto de Soluciones, Líder Técnico, Sponsor del Cliente)"
}

Genera entre 16 y 20 riesgos. La matriz DEBE incluir como mínimo un riesgo de cada clasificación: Técnico (type "riesgo" y category "tecnico"), Oculto (type "riesgo_oculto"), Supuesto no validado (type "supuesto_no_validado") y Dependencia externa (type "dependencia_externa"). SOLO JSON con la estructura { "risks": [...] }.`;

    // If there's a formalized SoW PDF, use it as primary source (multimodal)
    let messages: any[];
    if (sowApproval?.fileUrl) {
      messages = [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "file_url" as const,
              file_url: { url: sowApproval.fileUrl, mime_type: "application/pdf" as const },
            },
            { type: "text" as const, text: `El PDF adjunto es el SoW formalizado y firmado con el cliente. Es tu fuente primaria de análisis. Léelo completo antes de generar los riesgos.\n\n${userPromptText}` },
          ],
        },
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPromptText },
      ];
    }

    // Attempt 1: with PDF if available
    console.log(`[generateRisks] Attempt 1 for project ${input.projectId}, type=${projectType}, hasSoW=${!!sow}, hasPDF=${!!sowApproval?.fileUrl}`);
    const attempts = [{ attempt: "attempt-1", messages }];

    // Attempt 2: texto sin PDF, sólo cuando el primer intento incluye el SoW firmado.
    if (sowApproval?.fileUrl) {
      attempts.push({
        attempt: "attempt-2-text",
        messages: [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPromptText },
        ],
      });
    }

    // Attempt 3: prompt reducido, ejecutado sólo cuando los anteriores no producen riesgos.
    attempts.push({
      attempt: "attempt-3-simplified",
      messages: [
        { role: "system" as const, content: `Eres un experto en gestión de riesgos de proyectos de tecnología. Genera una matriz de riesgos profesional para el proyecto descrito. Responde con un objeto JSON que contenga la key "risks" con un array de objetos de riesgo.` },
        { role: "user" as const, content: `Proyecto: ${project?.projectName || input.context}\nCliente: ${project?.clientName || "N/A"}\nTipo: ${projectType}\n\nDatos del SoW:\n${sowStructuredContext}\n\nGenera 14-18 riesgos con esta estructura:\n{ "risks": [{ "riskCode": "R001", "description": "...", "category": "tecnico|organizacional|externo|oculto", "type": "riesgo|riesgo_oculto|supuesto_no_validado|dependencia_externa", "probability": "alta|media|baja", "impact": "alto|medio|bajo", "mitigation": "...", "owner": "..." }] }` },
      ],
    });
    const { result: parsedResult, diagnostics: attemptDiagnostics } = await runRiskGenerationAttempts(
      attempts,
      async ({ messages: attemptMessages, response_format }) => response_format
        ? invokeLLM({ messages: attemptMessages as any, response_format: response_format as any })
        : invokeLLM({ messages: attemptMessages as any }),
    );
    for (const diagnostic of attemptDiagnostics) {
      console.log(`[generateRisks] ${diagnostic.attempt} ${diagnostic.mode} response in ${diagnostic.durationMs}ms; risks=${diagnostic.risks}; failure=${diagnostic.failure ?? "none"}; finishReason=${diagnostic.finishReason ?? "none"}; contentLength=${diagnostic.contentLength}`);
    }
    const parsed = parsedResult.risks;

    if (parsed.length === 0) {
      const lastDiagnostic = attemptDiagnostics.at(-1);
      console.error(`[generateRisks] Provider returned no usable risks for project ${input.projectId}; lastFailure=${lastDiagnostic?.failure ?? "unknown"}; finishReason=${lastDiagnostic?.finishReason ?? "unknown"}; contentLength=${lastDiagnostic?.contentLength ?? 0}`);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "La generación de riesgos no pudo completarse porque el proveedor IA devolvió una respuesta vacía o no estructurada. El SoW no fue modificado. Intenta nuevamente; si el problema persiste, informa a PMO.",
      });
    }

    await bulkInsertRisks(input.projectId, parsed as any);
    await updateProjectStage(input.projectId, "risks", { progress: 70 });
    await audit(ctx, "generate_risks", "risks", input.projectId, null, { count: parsed.length });
    return { success: true, risks: parsed };
  }),

  save: protectedProcedure.input(z.object({
    projectId: z.number(),
    risks: z.array(z.record(z.string(), z.any())),
  })).mutation(async ({ input, ctx }) => {
    await bulkInsertRisks(input.projectId, input.risks as any);
    await audit(ctx, "save", "risks", input.projectId, null, { count: input.risks.length });
    return { success: true };
  }),

  complete: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await unlockNextStage(input.projectId, "risks");
      await audit(ctx, "complete_stage", "risks", input.projectId);
      return { success: true };
    }),

  // ---- Risk Confirmation (for JIRA export) ----
  confirmRisk: protectedProcedure.input(z.object({
    riskId: z.number(),
    confirmed: z.boolean(),
  })).mutation(async ({ input, ctx }) => {
    await updateRiskConfirmed(input.riskId, input.confirmed);
    await audit(ctx, input.confirmed ? "confirm_risk" : "unconfirm_risk", "risks", input.riskId);
    return { success: true };
  }),

  bulkConfirmRisks: protectedProcedure.input(z.object({
    projectId: z.number(),
    confirmedIds: z.array(z.number()),
  })).mutation(async ({ input, ctx }) => {
    await bulkUpdateRiskConfirmed(input.projectId, input.confirmedIds);
    await audit(ctx, "bulk_confirm_risks", "risks", input.projectId, null, { confirmedCount: input.confirmedIds.length });
    return { success: true };
  }),

  // ---- Excel Export with versioning ----
  getVersions: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getRiskVersionsByProject(input.projectId)),

  getNextVersion: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const version = await getNextRiskVersionNumber(input.projectId);
      return { version };
    }),

  exportExcel: protectedProcedure.input(z.object({
    projectId: z.number(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    const riskList = await getRisksByProject(input.projectId);
    if (riskList.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No hay riesgos para exportar" });

    const version = await getNextRiskVersionNumber(input.projectId);
    const buffer = await generateRiskMatrixExcel(
      riskList,
      project.projectName,
      project.clientName ?? "Cliente",
      version,
    );

    const fileKey = `risks/${input.projectId}/matriz-riesgos-${version}-${Date.now()}.xlsx`;
    const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    await insertRiskVersion({
      projectId: input.projectId,
      version,
      fileUrl: url,
      fileKey,
      riskCount: riskList.length,
      notes: input.notes ?? null,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "Usuario",
    });

    await audit(ctx, "export_excel", "risks", input.projectId, project.projectName, { version, riskCount: riskList.length });
    return { success: true, version, url, riskCount: riskList.length };
  }),

  // ---- Agentic Review ----
  agenticReview: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const riskList = await getRisksByProject(input.projectId);
      const project = await getProjectById(input.projectId);
      if (riskList.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No hay riesgos para revisar" });

      const riskSummary = riskList.map(r => ({
        code: r.riskCode,
        description: r.description,
        type: r.type,
        category: r.category,
        probability: r.probability,
        impact: r.impact,
        mitigation: r.mitigation,
        contingency: r.contingency,
        owner: r.owner,
        dueDate: r.dueDate,
        estimatedCost: r.estimatedCost,
      }));

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Eres un Senior Risk Manager experto en evaluación de matrices de riesgo para proyectos de tecnología. Tu evaluación debe ser rigurosa, objetiva y orientada a la acción. Responde SOLO con JSON válido." },
          { role: "user", content: `Evalúa la siguiente Matriz de Riesgos del proyecto "${project?.projectName || "N/A"}" y proporciona una evaluación detallada de su calidad y completitud.

Matriz de Riesgos:
${JSON.stringify(riskSummary, null, 2)}

Responde SOLO con JSON:
{
  "overallScore": 85,
  "completenessScore": 80,
  "qualityScore": 90,
  "coverageScore": 85,
  "summary": "Resumen ejecutivo de la evaluación en 2-3 oraciones",
  "strengths": ["Fortaleza 1", "Fortaleza 2"],
  "gaps": [
    {
      "riskCode": "R001",
      "issue": "Descripción del problema encontrado",
      "severity": "alta|media|baja",
      "recommendation": "Acción específica para mejorar"
    }
  ],
  "missingCategories": ["Categorías de riesgo no cubiertas"],
  "risksWithoutMitigation": ["Códigos de riesgos sin mitigación adecuada"],
  "risksWithoutOwner": ["Códigos de riesgos sin responsable asignado"],
  "risksWithoutContingency": ["Códigos de riesgos sin plan de contingencia"],
  "recommendations": [
    {
      "priority": "alta|media|baja",
      "action": "Acción recomendada específica",
      "rationale": "Justificación de la recomendación"
    }
  ],
  "readyForJira": true,
  "readyForJiraReason": "Explicación de por qué está o no lista para crear issues en JIRA"
}` },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      let evaluation: any;
      try {
        evaluation = JSON.parse(contentStr);
      } catch {
        evaluation = { overallScore: 0, summary: "Error al procesar la evaluación", gaps: [], recommendations: [] };
      }

      await audit(ctx, "agentic_review", "risks", input.projectId, project?.projectName, { score: evaluation.overallScore });
      return { success: true, evaluation, riskCount: riskList.length };
    }),

  // ---- Create JIRA Issues from Risks ----
  createJiraIssues: adminOrPmo.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const riskList = await getRisksByProject(input.projectId);
      if (riskList.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "No hay riesgos para crear en JIRA" });

      const space = await getJiraSpaceByProject(input.projectId);
      if (!space || !space.jiraProjectKey) throw new TRPCError({ code: "BAD_REQUEST", message: "El proyecto no tiene un Space JIRA activo. Completa la etapa JIRA primero." });

      // Find the "Riesgos PMO" issue type from the space
      const issueTypes = (space.issueTypes as any[]) ?? [];
      const riskIssueType = issueTypes.find((it: any) =>
        it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
      );
      const issueTypeId = riskIssueType?.id;

      const PROB_MAP: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
      const IMPACT_MAP: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
      const TYPE_MAP: Record<string, string> = {
        riesgo: "Técnico", riesgo_oculto: "Oculto",
        supuesto_no_validado: "Supuesto No Validado", dependencia_externa: "Dependencia Externa",
      };

      const results: { riskId: number; riskCode: string; issueKey: string; success: boolean; error?: string }[] = [];

      for (const risk of riskList) {
        // Skip risks already in JIRA
        if (risk.jiraIssueKey) {
          results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: risk.jiraIssueKey, success: true });
          continue;
        }

        try {
          const description = [
            `*Tipo:* ${TYPE_MAP[risk.type] ?? risk.type}`,
            `*Categoría:* ${risk.category}`,
            `*Probabilidad:* ${PROB_MAP[risk.probability] ?? risk.probability}`,
            `*Impacto:* ${IMPACT_MAP[risk.impact] ?? risk.impact}`,
            "",
            `*Descripción:*\n${risk.description}`,
            "",
            `*Estrategia de Mitigación:*\n${risk.mitigation ?? "Sin mitigación definida"}`,
            risk.contingency ? `\n*Plan de Contingencia:*\n${risk.contingency}` : "",
            risk.estimatedCost ? `\n*Costo Estimado:* ${risk.estimatedCost}` : "",
            risk.dueDate ? `\n*Fecha Estimada:* ${risk.dueDate}` : "",
          ].filter(Boolean).join("\n");

          const issueData: any = {
            fields: {
              project: { key: space.jiraProjectKey },
              summary: `[${risk.riskCode ?? "RISK"}] ${risk.description?.substring(0, 200) ?? "Riesgo identificado"}`,
              description: {
                type: "doc",
                version: 1,
                content: [{
                  type: "paragraph",
                  content: [{ type: "text", text: description }],
                }],
              },
              issuetype: issueTypeId ? { id: issueTypeId } : { name: "Task" },
              labels: ["PMO-Risk", risk.category, risk.probability],
            },
          };

          if (risk.owner) issueData.fields.assignee = undefined; // Can't set by name, skip

          const created = await createJiraIssue({
            projectKey: space.jiraProjectKey!,
            summary: issueData.fields.summary,
            description,
            issueTypeName: riskIssueType?.name ?? "Task",
            labels: ["PMO-Risk", risk.category, risk.probability].filter(Boolean),
          });
          if (created?.key) {
            await updateRiskJiraKey(risk.id, created.key);
            results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: created.key, success: true });
          } else {
            results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: "", success: false, error: "No se pudo crear el issue" });
          }
        } catch (err: any) {
          results.push({ riskId: risk.id, riskCode: risk.riskCode ?? "", issueKey: "", success: false, error: err.message });
        }
      }

      const created = results.filter(r => r.success && r.issueKey).length;
      await audit(ctx, "create_jira_issues", "risks", input.projectId, space.spaceName, {
        created,
        total: riskList.length,
        spaceKey: space.jiraProjectKey,
        operationLog: results.map(r => ({
          riskCode: r.riskCode,
          status: r.success ? "created" : "error",
          jiraKey: r.issueKey || null,
          transitioned: (r as any).transitioned ?? null,
          errorMsg: r.error || null,
        })),
      });
      return { success: true, results, created, total: riskList.length, spaceKey: space.jiraProjectKey, spaceUrl: space.jiraProjectUrl };
    }),

  // ── Retry Risk JIRA: Re-attempt JIRA issue creation for risks without jiraIssueKey ──
  retryRiskJira: adminOrPmo.input(z.object({
    projectId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const startTime = Date.now();
    const jiraSpace = await getJiraSpaceByProject(input.projectId);
    if (!jiraSpace?.jiraProjectKey) throw new TRPCError({ code: "BAD_REQUEST", message: "El proyecto no tiene un Space JIRA asociado." });
    const projectKey = jiraSpace.jiraProjectKey;

    const allRisks = await getRisksByProject(input.projectId);
    const pending = allRisks.filter(r => !r.jiraIssueKey);
    if (pending.length === 0) {
      return {
        success: true, projectKey, message: "Todos los riesgos ya tienen issue JIRA",
        created: 0, skipped: allRisks.length, errors: 0,
        jiraKeys: allRisks.filter(r => r.jiraIssueKey).map(r => r.jiraIssueKey!),
        logEntries: [], totals: { confirmed: allRisks.length, total: allRisks.length },
        elapsedMs: 0, spaceUrl: jiraSpace.jiraProjectUrl || null,
      };
    }

    // Find the risk issue type
    const issueTypes = (jiraSpace.issueTypes as any[]) ?? [];
    const riskIssueType = issueTypes.find((it: any) =>
      it.name?.toLowerCase().includes("riesgo") || it.name?.toLowerCase().includes("risk")
    );

    const PROB_MAP: Record<string, string> = { alta: "Alta", media: "Media", baja: "Baja" };
    const IMPACT_MAP: Record<string, string> = { alto: "Alto", medio: "Medio", bajo: "Bajo" };
    const TYPE_MAP: Record<string, string> = {
      riesgo: "Técnico", riesgo_oculto: "Oculto",
      supuesto_no_validado: "Supuesto No Validado", dependencia_externa: "Dependencia Externa",
    };

    type RiskLogEntry = {
      timestamp: string; riskCode: string; description: string; type: string;
      probability: string; impact: string;
      status: "created" | "skipped" | "error";
      jiraKey: string | null; errorMsg: string | null;
      index: number; total: number;
    };
    const logEntries: RiskLogEntry[] = [];
    const results = { created: 0, skipped: 0, errors: 0, jiraKeys: [] as string[] };

    console.log(`[JIRA retryRiskJira] Retrying: ${pending.length} pending risks -> project ${projectKey}`);

    for (let i = 0; i < pending.length; i++) {
      const risk = pending[i];
      try {
        const description = [
          `*Tipo:* ${TYPE_MAP[risk.type] ?? risk.type}`,
          `*Categoría:* ${risk.category}`,
          `*Probabilidad:* ${PROB_MAP[risk.probability] ?? risk.probability}`,
          `*Impacto:* ${IMPACT_MAP[risk.impact] ?? risk.impact}`,
          "",
          `*Descripción:*\n${risk.description}`,
          "",
          `*Estrategia de Mitigación:*\n${risk.mitigation ?? "Sin mitigación definida"}`,
          risk.contingency ? `\n*Plan de Contingencia:*\n${risk.contingency}` : "",
          risk.estimatedCost ? `\n*Costo Estimado:* ${risk.estimatedCost}` : "",
          risk.dueDate ? `\n*Fecha Estimada:* ${risk.dueDate}` : "",
        ].filter(Boolean).join("\n");

        const created = await createJiraIssue({
          projectKey,
          summary: `[${risk.riskCode ?? "RISK"}] ${risk.description?.substring(0, 200) ?? "Riesgo identificado"}`,
          description,
          issueTypeName: riskIssueType?.name ?? "Task",
          labels: ["PMO-Risk", risk.category, risk.probability].filter(Boolean),
        });
        if (created?.key) {
          await updateRiskJiraKey(risk.id, created.key);
          // Transition to "Identificado" status
          const transitioned = await transitionJiraIssue(created.key, "Identificado");
          results.created++;
          results.jiraKeys.push(created.key);
          logEntries.push({
            timestamp: new Date().toISOString(), riskCode: risk.riskCode ?? "",
            description: risk.description?.substring(0, 120) ?? "",
            type: risk.type ?? "riesgo", probability: risk.probability ?? "media", impact: risk.impact ?? "medio",
            status: "created", jiraKey: created.key, errorMsg: null,
            index: i + 1, total: pending.length,
          });
          console.log(`[JIRA] Retry Risk ${i + 1}/${pending.length} CREATED ${created.key} (transitioned: ${transitioned})`);
        } else {
          results.errors++;
          logEntries.push({
            timestamp: new Date().toISOString(), riskCode: risk.riskCode ?? "",
            description: risk.description?.substring(0, 120) ?? "",
            type: risk.type ?? "riesgo", probability: risk.probability ?? "media", impact: risk.impact ?? "medio",
            status: "error", jiraKey: null, errorMsg: "No se pudo crear el issue",
            index: i + 1, total: pending.length,
          });
        }
      } catch (e: any) {
        console.error(`[JIRA] Retry Risk ${i + 1}/${pending.length} ERROR: ${e.message}`);
        results.errors++;
        logEntries.push({
          timestamp: new Date().toISOString(), riskCode: risk.riskCode ?? "",
          description: risk.description?.substring(0, 120) ?? "",
          type: risk.type ?? "riesgo", probability: risk.probability ?? "media", impact: risk.impact ?? "medio",
          status: "error", jiraKey: null, errorMsg: e.message,
          index: i + 1, total: pending.length,
        });
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[JIRA retryRiskJira] Done in ${elapsedMs}ms: ${results.created} created, ${results.errors} errors`);

    await audit(ctx, "retry_risk_jira", "risks", input.projectId, null, {
      ...results,
      elapsedMs,
      projectKey,
      pendingCount: pending.length,
      operationLog: logEntries.map(entry => ({
        riskCode: entry.riskCode,
        description: entry.description?.substring(0, 100),
        status: entry.status,
        jiraKey: entry.jiraKey,
        errorMsg: entry.errorMsg,
        timestamp: entry.timestamp,
      })),
    });

    return {
      success: true,
      projectKey,
      ...results,
      verified: results.errors === 0,
      logEntries,
      totals: { confirmed: pending.length, total: allRisks.length },
      elapsedMs,
      spaceUrl: jiraSpace.jiraProjectUrl || null,
    };
  }),
});

// ==================== WBS ROUTER ====================
const wbsRouter = router({
  get: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getWbsByProject(input.projectId)),

  getBilling: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const rows = await getBillingByProject(input.projectId);
      return rows.map(r => ({ ...r, dueDate: r.dueDate ? String(r.dueDate) : null }));
    }),

  generate: protectedProcedure.input(z.object({
    projectId: z.number(),
    context: z.string(),
  })).mutation(async ({ input, ctx: trpcCtx }) => {
    const sow = await getSowByProject(input.projectId);
    const llmContext = `Proyecto: ${input.context}. Objetivos: ${sow?.generalObjective || "N/A"}. Entregables: ${JSON.stringify(sow?.deliverables || [])}`;

    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Eres un Senior PM experto en planificación de proyectos de tecnología. Responde SOLO con JSON válido." },
        { role: "user", content: `Genera una WBS detallada con estimaciones PERT. Contexto: ${llmContext}

Responde SOLO con JSON:
{
  "tasks": [{
    "taskCode": "1.1",
    "taskName": "nombre de la tarea",
    "phase": "preparacion|inicio|planificacion|analisis|construccion|cierre",
    "optimistic": 1,
    "pessimistic": 5,
    "probable": 3,
    "expected": 3.0,
    "isCritical": true,
    "dependencies": "código de tarea dependiente o vacío",
    "assignee": "rol responsable"
  }],
  "billingMilestones": [{
    "description": "descripción del hito",
    "percentage": "30",
    "amount": ""
  }]
}

Mínimo 12 tareas distribuidas en todas las fases. Calcula expected = (optimistic + 4*probable + pessimistic) / 6. Identifica ruta crítica. SOLO JSON.` },
      ],
      response_format: { type: "json_object" } as any,
    });

    const rawContent3 = response.choices?.[0]?.message?.content;
    const contentStr3 = typeof rawContent3 === "string" ? rawContent3 : JSON.stringify(rawContent3 || "{}");
    const parsed = JSON.parse(contentStr3);
    const generatedTasks = (Array.isArray(parsed.tasks) ? parsed.tasks : []).map((task: any) => {
      const optimistic = Number(task.optimistic);
      const probable = Number(task.probable);
      const pessimistic = Number(task.pessimistic);
      const hasPertInputs = [optimistic, probable, pessimistic].every(Number.isFinite);
      const expected = hasPertInputs
        ? Math.round(((optimistic + 4 * probable + pessimistic) / 6) * 10) / 10
        : task.expected ?? null;

      return {
        ...task,
        optimistic: hasPertInputs ? optimistic : task.optimistic ?? null,
        probable: hasPertInputs ? probable : task.probable ?? null,
        pessimistic: hasPertInputs ? pessimistic : task.pessimistic ?? null,
        expected,
      };
    });
    const fallbackTasks = [
      ["1.1", "Preparar la gobernanza y el equipo del proyecto", "preparacion", 1, 2, 3, true, null, "PM"],
      ["1.2", "Definir repositorios, ambientes y controles de acceso", "preparacion", 1, 2, 3, false, "1.1", "DevOps"],
      ["2.1", "Realizar kickoff y validar los interesados", "inicio", 1, 2, 3, true, "1.1", "PM"],
      ["2.2", "Acordar el alcance operativo y los entregables", "inicio", 1, 2, 3, false, "2.1", "PM"],
      ["3.1", "Elaborar la planificación detallada y los hitos", "planificacion", 1, 2, 4, true, "2.1", "PM"],
      ["3.2", "Definir la estrategia de pruebas y aseguramiento", "planificacion", 1, 2, 3, false, "3.1", "QA"],
      ["4.1", "Levantar y validar los requerimientos funcionales", "analisis", 2, 3, 5, true, "3.1", "Consultor"],
      ["4.2", "Diseñar la solución técnica y sus integraciones", "analisis", 2, 3, 5, false, "4.1", "Arquitecto"],
      ["5.1", "Implementar los componentes priorizados", "construccion", 3, 5, 8, true, "4.2", "Dev Backend"],
      ["5.2", "Ejecutar pruebas técnicas y de aceptación", "construccion", 2, 3, 5, true, "5.1", "QA"],
      ["6.1", "Preparar la transferencia, documentación y capacitación", "cierre", 1, 2, 4, false, "5.2", "PM"],
      ["6.2", "Formalizar el cierre y las lecciones aprendidas", "cierre", 1, 2, 3, true, "6.1", "PM"],
    ].map(([taskCode, taskName, phase, optimistic, probable, pessimistic, isCritical, dependencies, assignee]) => ({
      taskCode,
      taskName,
      phase: phase as "preparacion" | "inicio" | "planificacion" | "analisis" | "construccion" | "cierre",
      optimistic,
      probable,
      pessimistic,
      expected: Math.round(((Number(optimistic) + 4 * Number(probable) + Number(pessimistic)) / 6) * 10) / 10,
      isCritical,
      dependencies,
      assignee,
      issueLevel: "task" as const,
    }));
    const tasks = generatedTasks.length > 0 ? generatedTasks : fallbackTasks;
    const generatedBilling = Array.isArray(parsed.billingMilestones) ? parsed.billingMilestones : [];
    const billing = generatedBilling.length > 0
      ? generatedBilling
      : [
          { description: "Hito de planificación aprobada", percentage: "30", currency: "USD" },
          { description: "Hito de construcción y pruebas completadas", percentage: "40", currency: "USD" },
          { description: "Hito de cierre y aceptación final", percentage: "30", currency: "USD" },
        ];

    await bulkInsertWbs(input.projectId, tasks);
    await upsertBillingMilestones(input.projectId, billing);
    await updateProjectStage(input.projectId, "planning", { progress: 70 });
    await audit(trpcCtx, "generate_wbs", "planning", input.projectId, null, { tasksCount: tasks.length, billingCount: billing.length });
    return { success: true, tasks, billing, usedFallback: generatedTasks.length === 0 };
  }),

  saveBilling: protectedProcedure.input(z.object({
    projectId: z.number(),
    milestones: z.array(z.record(z.string(), z.any())),
  })).mutation(async ({ input, ctx }) => {
    await upsertBillingMilestones(input.projectId, input.milestones);
    await audit(ctx, "save_billing", "planning", input.projectId, null, { count: input.milestones.length });
    return { success: true };
  }),

  generateBacklog: protectedProcedure.input(z.object({
    projectId: z.number(),
    context: z.string(),
  })).mutation(async ({ input, ctx: trpcCtxWbs }) => {
    const sow = await getSowByProject(input.projectId);
        // Use the formalized SoW: prefer stageId="sow" (new location), fallback to "risks" (legacy)
    const sowApproval = await getStageApproval(input.projectId, "sow") ?? await getStageApproval(input.projectId, "risks");
    const project = await getProjectById(input.projectId);
    // Build multimodal content: use SoW PDF if available
    const userContent: any[] = [];
    if (sowApproval?.fileUrl) {
      userContent.push({
        type: "file_url",
        file_url: { url: sowApproval.fileUrl, mime_type: "application/pdf" },
      });
      userContent.push({
        type: "text",
        text: `Analiza el SoW formalizado adjunto para el proyecto "${input.context}" (Tipo: ${project?.projectType || "tecnología"}).`,
      });
    } else {
      userContent.push({
        type: "text",
        text: `Proyecto: ${input.context}. Tipo: ${project?.projectType || "tecnología"}. Objetivos: ${sow?.generalObjective || "N/A"}. Entregables: ${JSON.stringify(sow?.deliverables || [])}. Actividades: ${JSON.stringify(sow?.activitiesIncluded || [])}.`,
      });
    }

    const projectTypeMap: Record<string, string> = {
      apigee: "Implementación de API Gateway Apigee (Google Cloud) con políticas de seguridad, developer portal, y gestión de tráfico.",
      desarrollo: "Desarrollo de software a medida con arquitectura de microservicios o monolítica, sprints ágiles y CI/CD.",
      integracion: "Integración de sistemas empresariales (ESB, middleware, APIs REST/SOAP) con transformación de datos.",
      data: "Proyecto de datos: ETL, data warehouse, analytics, BI o data science con pipelines y visualización.",
      otro: "Proyecto de tecnología general.",
    };
    const projectTypeDesc = projectTypeMap[project?.projectType || "otro"] || projectTypeMap["otro"];

    userContent.push({
      type: "text",
      text: `
Contexto del tipo de proyecto: ${projectTypeDesc}

Genera un backlog ágil completo con jerarquía Épica → Story → Task.

Reglas de mapeo:
- ÉPICA: Paquete de trabajo mayor o fase del proyecto (ej. "Infraestructura Azure", "Seguridad FAPI 2.0"). Representa 2-6 semanas de trabajo.
- STORY: Funcionalidad o entregable concreto dentro de una épica (ej. "Configurar ambientes CI/CD", "Implementar OAuth2"). Representa 3-10 días.
- TASK: Actividad técnica específica dentro de una story (ej. "Crear pipeline GitHub Actions", "Configurar variables de entorno"). Representa 1-3 días.
- MILESTONE: Hito de pago o entregable formal del proyecto.

Criterios de calidad:
- Mínimo 5 épicas, 15 stories, 40 tasks
- Cada story debe tener criterios de aceptación claros (Given/When/Then o lista de condiciones)
- Story points: Fibonacci (1, 2, 3, 5, 8, 13) según complejidad
- Cada task debe ser realizable en 1-3 días por un profesional senior
- Identificar la ruta crítica
- Asignar roles responsables (Arquitecto, Dev Backend, Dev Frontend, QA, DevOps, PM, Consultor)

Responde SOLO con JSON válido:
{
  "epics": [{
    "code": "E01",
    "title": "Nombre de la épica",
    "description": "Descripción del paquete de trabajo",
    "phase": "inicio|planificacion|analisis|construccion|cierre",
    "durationWeeks": 2,
    "stories": [{
      "code": "E01-S01",
      "title": "Nombre de la story",
      "description": "Descripción de la funcionalidad",
      "acceptanceCriteria": "Criterios de aceptación",
      "storyPoints": 5,
      "isCritical": false,
      "assignee": "Rol responsable",
      "tasks": [{
        "code": "E01-S01-T01",
        "title": "Nombre de la task",
        "description": "Descripción técnica",
        "optimistic": 1,
        "probable": 2,
        "pessimistic": 3,
        "assignee": "Rol responsable",
        "isCritical": false
      }]
    }]
  }],
  "milestones": [{
    "code": "M01",
    "title": "Nombre del hito",
    "description": "Descripción del hito de pago",
    "percentage": "30",
    "epicCode": "E01"
  }]
}

Solo JSON, sin texto adicional.`,
    });

    const backlogResponse = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Eres Gerente de Proyectos Senior de Prodigio Tech con 15+ años de experiencia en proyectos de tecnología en Latinoamérica. Dominas PMI/PMBOK y marcos ágiles (Scrum, SAFe). Tu especialidad es descomponer Statements of Work en backlogs ágiles precisos con jerarquía Épica→Story→Task. Cada item del backlog debe surgir directamente de los entregables, actividades y supuestos del SoW. Responde SOLO con JSON válido.`,
        },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" } as any,
    });

    const rawBacklog = backlogResponse.choices?.[0]?.message?.content;
    const backlogStr = typeof rawBacklog === "string" ? rawBacklog : JSON.stringify(rawBacklog || "{}");
    const parsed = JSON.parse(backlogStr);
    const epics: any[] = parsed.epics || [];
    const milestones: any[] = parsed.milestones || [];

    // Flatten hierarchy into wbs_tasks rows
    const flatTasks: any[] = [];
    for (const epic of epics) {
      flatTasks.push({
        taskCode: epic.code,
        taskName: epic.title,
        phase: epic.phase || "construccion",
        optimistic: epic.durationWeeks ? epic.durationWeeks * 5 : null,
        pessimistic: epic.durationWeeks ? epic.durationWeeks * 7 : null,
        probable: epic.durationWeeks ? epic.durationWeeks * 6 : null,
        expected: epic.durationWeeks ? epic.durationWeeks * 6 : null,
        isCritical: false,
        dependencies: null,
        assignee: "Equipo",
        issueLevel: "epic",
        epicCode: epic.code,
        storyCode: null,
        acceptanceCriteria: epic.description || null,
        storyPoints: null,
      });
      for (const story of epic.stories || []) {
        flatTasks.push({
          taskCode: story.code,
          taskName: story.title,
          phase: epic.phase || "construccion",
          optimistic: null,
          pessimistic: null,
          probable: null,
          expected: null,
          isCritical: story.isCritical || false,
          dependencies: null,
          assignee: story.assignee || null,
          issueLevel: "story",
          epicCode: epic.code,
          storyCode: story.code,
          acceptanceCriteria: story.acceptanceCriteria || null,
          storyPoints: story.storyPoints || null,
        });
        for (const task of story.tasks || []) {
          const exp = task.optimistic && task.probable && task.pessimistic
            ? (task.optimistic + 4 * task.probable + task.pessimistic) / 6
            : null;
          flatTasks.push({
            taskCode: task.code,
            taskName: task.title,
            phase: epic.phase || "construccion",
            optimistic: task.optimistic || null,
            pessimistic: task.pessimistic || null,
            probable: task.probable || null,
            expected: exp ? Math.round(exp * 10) / 10 : null,
            isCritical: task.isCritical || false,
            dependencies: null,
            assignee: task.assignee || null,
            issueLevel: "task",
            epicCode: epic.code,
            storyCode: story.code,
            acceptanceCriteria: null,
            storyPoints: null,
          });
        }
      }
    }
    for (const ms of milestones) {
      flatTasks.push({
        taskCode: ms.code,
        taskName: ms.title,
        phase: "cierre",
        optimistic: null, pessimistic: null, probable: null, expected: null,
        isCritical: true,
        dependencies: ms.epicCode || null,
        assignee: "PM",
        issueLevel: "milestone",
        epicCode: ms.epicCode || null,
        storyCode: null,
        acceptanceCriteria: ms.description || null,
        storyPoints: null,
      });
    }

    await bulkInsertWbs(input.projectId, flatTasks);
    await upsertBillingMilestones(input.projectId, milestones.map((m: any) => ({
      description: m.title,
      percentage: m.percentage || "",
      amount: "",
    })));
    await updateProjectStage(input.projectId, "planning", { progress: 75 });
    await audit(trpcCtxWbs, "generate_backlog", "planning", input.projectId, null, {
      epicsCount: epics.length,
      storiesCount: flatTasks.filter((t) => t.issueLevel === "story").length,
      tasksCount: flatTasks.filter((t) => t.issueLevel === "task").length,
      usedPdf: !!sowApproval?.fileUrl,
    });
    return {
      success: true,
      epicsCount: epics.length,
      storiesCount: flatTasks.filter((t) => t.issueLevel === "story").length,
      tasksCount: flatTasks.filter((t) => t.issueLevel === "task").length,
      milestonesCount: milestones.length,
      usedPdf: !!sowApproval?.fileUrl,
      items: flatTasks,
    };
  }),

  pushBacklogToJira: protectedProcedure.input(z.object({
    projectId: z.number(),
    selectedIds: z.array(z.number()).optional(), // if provided, only push these item IDs
  })).mutation(async ({ input, ctx: trpcCtxPush }) => {
    const project = await getProjectById(input.projectId);
    const jiraSpace = await getJiraSpaceByProject(input.projectId);
    if (!jiraSpace?.jiraProjectKey) throw new Error("El proyecto no tiene un Space JIRA asociado");
    const projectKey = jiraSpace.jiraProjectKey;

    const allItems = await getWbsByProject(input.projectId);
    // If selectedIds provided, filter to only those items (plus already-pushed items are skipped anyway)
    const selectedSet = input.selectedIds ? new Set(input.selectedIds) : null;
    const filterBySelection = (items: typeof allItems) =>
      selectedSet ? items.filter((i) => selectedSet.has(i.id)) : items;

    const epics = filterBySelection(allItems.filter((t) => t.issueLevel === "epic"));
    const stories = filterBySelection(allItems.filter((t) => t.issueLevel === "story"));
    const tasks = filterBySelection(allItems.filter((t) => t.issueLevel === "task"));
    const milestones = filterBySelection(allItems.filter((t) => t.issueLevel === "milestone"));

    // For linking, we still need the full epic/story key maps (including already-pushed items)
    const allEpics = allItems.filter((t) => t.issueLevel === "epic");
    const allStories = allItems.filter((t) => t.issueLevel === "story");

    const epicKeyMap: Record<string, string> = {}; // epicCode -> jiraIssueKey
    const storyKeyMap: Record<string, string> = {}; // storyCode -> jiraIssueKey
    const results = { created: 0, skipped: 0, errors: 0 };

    // Pre-populate key maps from ALL existing items (for parent linking)
    for (const e of allEpics) { if (e.jiraIssueKey && e.epicCode) epicKeyMap[e.epicCode] = e.jiraIssueKey; }
    for (const s of allStories) { if (s.jiraIssueKey && s.storyCode) storyKeyMap[s.storyCode] = s.jiraIssueKey; }

    // 1. Create Epics
    for (const epic of epics) {
      if (epic.jiraIssueKey) { if (epic.epicCode) epicKeyMap[epic.epicCode] = epic.jiraIssueKey; results.skipped++; continue; }
      try {
        const created = await createJiraIssue({
          projectKey,
          summary: `[${epic.taskCode}] ${epic.taskName}`,
          description: epic.acceptanceCriteria || epic.taskName,
          issueTypeName: "Epic",
          labels: ["pmo-backlog", "epic"],
        });
        epicKeyMap[epic.epicCode!] = created.key;
        await updateWbsItemJiraKey(epic.id, created.key);
        results.created++;
      } catch (e: any) { console.error(`[JIRA] Epic ${epic.taskCode}: ${e.message}`); results.errors++; }
    }

    // 2. Create Stories linked to Epics
    for (const story of stories) {
      if (story.jiraIssueKey) { if (story.storyCode) storyKeyMap[story.storyCode] = story.jiraIssueKey; results.skipped++; continue; }
      const parentEpicKey = story.epicCode ? epicKeyMap[story.epicCode] : undefined;
      try {
        const created = await createJiraIssue({
          projectKey,
          summary: `[${story.taskCode}] ${story.taskName}`,
          description: story.acceptanceCriteria
            ? `*Criterios de aceptación:*\n${story.acceptanceCriteria}\n\n*Story Points:* ${story.storyPoints || "?"}`
            : story.taskName,
          issueTypeName: "Story",
          labels: ["pmo-backlog", "story"],
        });
        storyKeyMap[story.storyCode!] = created.key;
        await updateWbsItemJiraKey(story.id, created.key, parentEpicKey || null);
        results.created++;
      } catch (e: any) { console.error(`[JIRA] Story ${story.taskCode}: ${e.message}`); results.errors++; }
    }

    // 3. Create Tasks linked to Stories
    for (const task of tasks) {
      if (task.jiraIssueKey) { results.skipped++; continue; }
      const parentStoryKey = task.storyCode ? storyKeyMap[task.storyCode] : undefined;
      try {
        const created = await createJiraIssue({
          projectKey,
          summary: `[${task.taskCode}] ${task.taskName}`,
          description: task.taskName,
          issueTypeName: "Task",
          labels: ["pmo-backlog", "task", ...(task.isCritical ? ["critical-path"] : [])],
        });
        await updateWbsItemJiraKey(task.id, created.key, parentStoryKey || null);
        results.created++;
      } catch (e: any) { console.error(`[JIRA] Task ${task.taskCode}: ${e.message}`); results.errors++; }
    }

    // 4. Create Milestones as "Hito PMO"
    for (const ms of milestones) {
      if (ms.jiraIssueKey) { results.skipped++; continue; }
      try {
        const created = await createJiraIssue({
          projectKey,
          summary: `[${ms.taskCode}] ${ms.taskName}`,
          description: ms.acceptanceCriteria || ms.taskName,
          issueTypeName: "Hito PMO",
          labels: ["pmo-backlog", "hito"],
        });
        await updateWbsItemJiraKey(ms.id, created.key);
        results.created++;
      } catch (e: any) { console.error(`[JIRA] Milestone ${ms.taskCode}: ${e.message}`); results.errors++; }
    }

    await updateProjectStage(input.projectId, "planning", { progress: 95 });
    await audit(trpcCtxPush, "push_backlog_jira", "planning", input.projectId, null, results);
    return { success: true, projectKey, ...results };
  }),

  // ── Gantt Upload & Parse ─────────────────────────────────────────────────────
  uploadGantt: protectedProcedure.input(z.object({
    projectId: z.number(),
    fileName: z.string(),
    fileBase64: z.string(), // base64 encoded xlsx
  })).mutation(async ({ input, ctx: ctxGantt }) => {
    const buffer = Buffer.from(input.fileBase64, "base64");
    // Upload to S3
    const fileKey = `gantt/${input.projectId}/${Date.now()}_${input.fileName}`;
    const { url: fileUrl } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    // Parse
    const rows = parseGanttBuffer(buffer);
    const summary = summarizeGantt(rows);
    // Save to DB
    await insertGanttUpload({
      projectId: input.projectId,
      fileName: input.fileName,
      fileUrl,
      parsedRows: rows.length,
      uploadedBy: ctxGantt.user.id,
    });

    // ── Extract project timeline from Gantt dates ──
    const allGanttDates = rows
      .map((r: any) => r.startDate || r.endDate)
      .filter(Boolean)
      .sort() as string[];
    if (allGanttDates.length > 0) {
      const ganttStartDate = allGanttDates[0];
      const ganttEndDate = allGanttDates[allGanttDates.length - 1];
      await updateProject(input.projectId, {
        startDate: ganttStartDate,
        endDate: ganttEndDate,
      } as any);
      console.log(`[uploadGantt] Updated project ${input.projectId} timeline: ${ganttStartDate} → ${ganttEndDate}`);
    }

    await audit(ctxGantt, "upload_gantt", "planning", input.projectId, null, { fileName: input.fileName, rows: rows.length, ...summary });
    return { success: true, fileUrl, summary, rows };
  }),

  getGanttUpload: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getLatestGanttUpload(input.projectId)),

  // ── Generate Backlog from Gantt ───────────────────────────────────────────────
  generateBacklogFromGantt: protectedProcedure.input(z.object({
    projectId: z.number(),
    ganttRows: z.array(z.object({
      rowIndex: z.number(),
      level: z.number(),
      name: z.string(),
      isHito: z.boolean(),
      isSummary: z.boolean(),
      duration: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      predecessors: z.string().nullable(),
      resources: z.string().nullable(),
      percentComplete: z.number(),
    })).optional(),
  })).mutation(async ({ input, ctx: ctxBacklog }) => {
    const startTime = Date.now();
    console.log(`[generateBacklog] START for project ${input.projectId}`);
    const sow = await getSowByProject(input.projectId);
        // Use the formalized SoW: prefer stageId="sow" (new location), fallback to "risks" (legacy)
    const sowApproval = await getStageApproval(input.projectId, "sow") ?? await getStageApproval(input.projectId, "risks");
    const project = await getProjectById(input.projectId);
    // If ganttRows not provided, re-parse from S3
    let ganttRowsToUse = input.ganttRows || [];
    if (ganttRowsToUse.length === 0) {
      const ganttUploadRecord = await getLatestGanttUpload(input.projectId);
      if (ganttUploadRecord?.fileUrl) {
        try {
          const resp = await fetch(ganttUploadRecord.fileUrl);
          const arrBuf = await resp.arrayBuffer();
          const buf = Buffer.from(arrBuf);
          ganttRowsToUse = parseGanttBuffer(buf);
        } catch (e: any) {
          console.error(`[generateBacklog] Failed to re-parse from S3: ${e.message}`);
        }
      }
    }
    if (ganttRowsToUse.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "No se encontraron datos del Gantt. Carga el archivo Gantt primero." });
    }

    // Build Gantt summary text for the LLM
    const ganttText = ganttRowsToUse
      .filter((r) => !r.isSummary || r.isHito)
      .map((r) => {
        const indent = "  ".repeat(Math.max(0, r.level - 1));
        const type = r.isHito ? "[HITO]" : r.level === 1 ? "[FASE]" : r.level === 2 ? "[SUBFASE]" : "[TAREA]";
        return `${indent}${type} ${r.name} | ${r.duration || ""} | ${r.startDate || ""} \u2192 ${r.endDate || ""} | Recursos: ${r.resources || "N/A"}`;
      })
      .join("\n");

    // Build SoW context text (always text, never PDF - PDF causes empty LLM responses)
    const sowContextText = sow
      ? `Proyecto: ${project?.projectName}. Cliente: ${project?.clientName}. Tipo: ${project?.projectType}. Objetivo: ${sow.generalObjective || "N/A"}. Objetivos específicos: ${JSON.stringify(sow.specificObjectives || []).substring(0, 500)}. Entregables: ${JSON.stringify(sow.deliverables || []).substring(0, 500)}.`
      : `Proyecto: ${project?.projectName}. Cliente: ${project?.clientName}. Tipo: ${project?.projectType}.`;

    const systemPrompt = `Eres Gerente de Proyectos Senior PMP de Prodigio Tech con 15+ años de experiencia en proyectos de tecnología en Latinoamérica. Dominas PMI/PMBOK y marcos ágiles (Scrum, SAFe). Tu especialidad es transformar Gantt de proyectos en backlogs ágiles precisos con jerarquía Épica\u2192Historia\u2192Tarea. Responde SOLO con JSON v\u00e1lido.`;

    const backlogPrompt = `${sowContextText}

A partir del siguiente Gantt del proyecto, genera un backlog ágil completo con jerarquía Épica \u2192 Historia de Usuario \u2192 Tarea.

GANTT DEL PROYECTO:
${ganttText}

Reglas de mapeo:
- ÉPICA: Mapea directamente desde las FASES y SUB-FASES del Gantt. Cada fase/sub-fase se convierte en una épica.
- HISTORIA DE USUARIO: Mapea desde las TAREAS del Gantt que representan funcionalidades o entregables. Agrúpalas bajo la épica correspondiente.
- TAREA: Descompone cada historia en actividades técnicas específicas de 1-3 días.
- HITO: Mantén los [HITO] del Gantt como milestones en el backlog.

Criterios de calidad:
- Cada historia debe tener criterios de aceptación claros
- Story points: Fibonacci (1, 2, 3, 5, 8, 13) según complejidad
- Asignar roles: Arquitecto, Dev Backend, Dev Frontend, QA, DevOps, PM, Consultor
- Preservar las fechas de inicio/fin del Gantt en cada item

Responde SOLO con JSON válido:
{
  "epics": [{
    "code": "E01",
    "title": "Nombre de la épica (desde fase Gantt)",
    "description": "Descripción del paquete de trabajo",
    "phase": "inicio|planificacion|analisis|construccion|cierre",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "durationWeeks": 2,
    "stories": [{
      "code": "E01-S01",
      "title": "Como [rol], quiero [funcionalidad] para [beneficio]",
      "description": "Descripción de la funcionalidad",
      "acceptanceCriteria": "Criterios de aceptación",
      "storyPoints": 5,
      "isCritical": false,
      "assignee": "Rol responsable",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "tasks": [{
        "code": "E01-S01-T01",
        "title": "Nombre de la tarea técnica",
        "description": "Descripción técnica",
        "optimistic": 1,
        "probable": 2,
        "pessimistic": 3,
        "assignee": "Rol responsable",
        "isCritical": false,
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD"
      }]
    }]
  }],
  "milestones": [{
    "code": "M01",
    "title": "Nombre del hito (desde [HITO] del Gantt)",
    "description": "Descripción del hito",
    "date": "YYYY-MM-DD",
    "epicCode": "E01"
  }]
}

Solo JSON, sin texto adicional.`;

    // Helper to parse LLM response into backlog structure
    const parseBacklogFromLLM = (responseObj: any): { epics: any[]; milestones: any[] } => {
      const rawContent = responseObj.choices?.[0]?.message?.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      console.log(`[generateBacklog] Received response (${contentStr.length} bytes)`);

      let epics: any[] = [];
      let milestones: any[] = [];
      try {
        const raw = JSON.parse(contentStr);
        if (typeof raw === "object" && raw !== null) {
          // Try known keys for epics
          epics = raw.epics || raw.backlog || raw.items || raw.data || [];
          if (epics.length === 0) {
            const arrayValues = Object.values(raw).filter(v => Array.isArray(v)) as any[][];
            // Find the array that looks like epics (objects with stories or code)
            for (const arr of arrayValues) {
              if (arr.length > 0 && arr[0] && (arr[0].stories || arr[0].code || arr[0].title)) {
                epics = arr;
                console.log(`[generateBacklog] Found epics under unexpected key, count: ${epics.length}`);
                break;
              }
            }
          }
          milestones = raw.milestones || raw.hitos || [];
        }
      } catch (e) {
        console.error(`[generateBacklog] JSON parse error`, e);
      }

      // Validate epics have minimum structure
      epics = epics.filter((e: any) => e && typeof e === "object" && (e.title || e.name || e.code));
      return { epics, milestones };
    };

    // Flatten parsed epics/milestones into wbs_tasks rows
    const flattenBacklog = (epics: any[], milestones: any[]): any[] => {
      const flatTasks: any[] = [];
      for (const epic of epics) {
        const epicTitle = epic.title || epic.name || `Epic ${epic.code}`;
        const epicPhase = ["inicio", "planificacion", "analisis", "construccion", "cierre"].includes(epic.phase) ? epic.phase : "construccion";
        flatTasks.push({ taskCode: epic.code, taskName: epicTitle, phase: epicPhase, optimistic: null, pessimistic: null, probable: null, expected: null, isCritical: false, dependencies: null, assignee: "Equipo", issueLevel: "epic", epicCode: epic.code, storyCode: null, acceptanceCriteria: epic.description || null, storyPoints: null, jiraIssueKey: null });
        for (const story of epic.stories || []) {
          const storyTitle = story.title || story.name || `Story ${story.code}`;
          flatTasks.push({ taskCode: story.code, taskName: storyTitle, phase: epicPhase, optimistic: null, pessimistic: null, probable: null, expected: null, isCritical: story.isCritical || false, dependencies: null, assignee: story.assignee || null, issueLevel: "story", epicCode: epic.code, storyCode: story.code, acceptanceCriteria: story.acceptanceCriteria || null, storyPoints: story.storyPoints || null, jiraIssueKey: null });
          for (const task of story.tasks || []) {
            const taskTitle = task.title || task.name || `Task ${task.code}`;
            const exp = task.optimistic && task.probable && task.pessimistic ? (task.optimistic + 4 * task.probable + task.pessimistic) / 6 : null;
            flatTasks.push({ taskCode: task.code, taskName: taskTitle, phase: epicPhase, optimistic: task.optimistic || null, pessimistic: task.pessimistic || null, probable: task.probable || null, expected: exp ? Math.round(exp * 10) / 10 : null, isCritical: task.isCritical || false, dependencies: null, assignee: task.assignee || null, issueLevel: "task", epicCode: epic.code, storyCode: story.code, acceptanceCriteria: null, storyPoints: null, jiraIssueKey: null });
          }
        }
      }
      for (const ms of milestones) {
        flatTasks.push({ taskCode: ms.code, taskName: ms.title || ms.name || `Milestone ${ms.code}`, phase: "cierre", optimistic: null, pessimistic: null, probable: null, expected: null, isCritical: true, dependencies: ms.epicCode || null, assignee: "PM", issueLevel: "milestone", epicCode: ms.epicCode || null, storyCode: null, acceptanceCriteria: ms.description || null, storyPoints: null, jiraIssueKey: null });
      }
      return flatTasks;
    };

    // ── Attempt 1: Text-only mode (never send PDF - causes empty responses) ──
    console.log(`[generateBacklog] Attempt 1 for project ${input.projectId}, ganttRows=${ganttRowsToUse.length}, hasSoW=${!!sow}`);
    let llmStart = Date.now();
    let response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: backlogPrompt },
      ],
      response_format: { type: "json_object" } as any,
    });
    console.log(`[generateBacklog] Attempt 1 LLM responded in ${Date.now() - llmStart}ms`);
    let { epics: parsedEpics, milestones: parsedMilestones } = parseBacklogFromLLM(response);
    console.log(`[generateBacklog] Attempt 1 parsed ${parsedEpics.length} epics, ${parsedMilestones.length} milestones`);

    // ── Attempt 2: Simplified prompt if first attempt returned empty ──
    if (parsedEpics.length === 0) {
      console.log(`[generateBacklog] Attempt 1 failed, retrying with simplified prompt...`);
      const simplifiedPrompt = `Transforma este Gantt en un backlog ágil JSON. Responde con {"epics": [...], "milestones": [...]}.

Proyecto: ${project?.projectName || "Proyecto"}
Cliente: ${project?.clientName || "Cliente"}

GANTT:
${ganttText.substring(0, 3000)}

Cada epic: {"code": "E01", "title": "...", "phase": "construccion", "stories": [{"code": "E01-S01", "title": "Como [rol]...", "acceptanceCriteria": "...", "storyPoints": 5, "tasks": [{"code": "E01-S01-T01", "title": "...", "optimistic": 1, "probable": 2, "pessimistic": 3}]}]}`;
      llmStart = Date.now();
      response = await invokeLLM({
        messages: [
          { role: "system", content: "Eres un experto en planificación ágil. Transforma Gantt en backlog JSON con estructura Épica\u2192Historia\u2192Tarea. Responde SOLO con JSON." },
          { role: "user", content: simplifiedPrompt },
        ],
        response_format: { type: "json_object" } as any,
      });
      console.log(`[generateBacklog] Attempt 2 (simplified) LLM responded in ${Date.now() - llmStart}ms`);
      ({ epics: parsedEpics, milestones: parsedMilestones } = parseBacklogFromLLM(response));
      console.log(`[generateBacklog] Attempt 2 parsed ${parsedEpics.length} epics, ${parsedMilestones.length} milestones`);
    }

    // ── Attempt 3: Minimal prompt as last resort ──
    if (parsedEpics.length === 0) {
      console.log(`[generateBacklog] Attempt 2 also failed, trying Attempt 3 with minimal prompt...`);
      const minimalPrompt = `Genera un backlog ágil JSON para este proyecto:\n\nNombre: ${project?.projectName}\nTareas del Gantt: ${ganttRowsToUse.filter(r => !r.isSummary).map(r => r.name).join(", ").substring(0, 2000)}\n\nResponde: {"epics": [{"code": "E01", "title": "...", "phase": "construccion", "stories": [{"code": "E01-S01", "title": "...", "storyPoints": 5, "tasks": [{"code": "E01-S01-T01", "title": "...", "optimistic": 1, "probable": 2, "pessimistic": 3}]}]}]}`;
      llmStart = Date.now();
      response = await invokeLLM({
        messages: [
          { role: "system", content: "Genera backlog ágil JSON. Responde SOLO con JSON válido con key \"epics\"." },
          { role: "user", content: minimalPrompt },
        ],
        response_format: { type: "json_object" } as any,
      });
      console.log(`[generateBacklog] Attempt 3 (minimal) LLM responded in ${Date.now() - llmStart}ms`);
      ({ epics: parsedEpics, milestones: parsedMilestones } = parseBacklogFromLLM(response));
      console.log(`[generateBacklog] Attempt 3 parsed ${parsedEpics.length} epics, ${parsedMilestones.length} milestones`);
    }

    let usedFallback = false;
    if (parsedEpics.length === 0) {
      const workRows = ganttRowsToUse.filter(row => !row.isSummary && !row.isHito && row.name.trim().length > 0);
      if (workRows.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "El Gantt no contiene tareas utilizables para construir el backlog." });
      }

      usedFallback = true;
      parsedEpics = [{
        code: "E01",
        title: `Plan de ejecución: ${project?.projectName || "Proyecto"}`,
        description: "Backlog derivado directamente de las tareas disponibles en el Gantt.",
        phase: "construccion",
        stories: workRows.map((row, index) => ({
          code: `E01-S${String(index + 1).padStart(2, "0")}`,
          title: row.name,
          acceptanceCriteria: `La actividad \"${row.name}\" se completa en las fechas y con los recursos definidos en el Gantt.`,
          storyPoints: 3,
          isCritical: index === workRows.length - 1,
          assignee: row.resources || "Equipo",
          tasks: [{
            code: `E01-S${String(index + 1).padStart(2, "0")}-T01`,
            title: `Ejecutar ${row.name}`,
            optimistic: 1,
            probable: 2,
            pessimistic: 3,
            assignee: row.resources || "Equipo",
            isCritical: index === workRows.length - 1,
          }],
        })),
      }];
      parsedMilestones = ganttRowsToUse
        .filter(row => row.isHito && row.name.trim().length > 0)
        .map((row, index) => ({
          code: `M${String(index + 1).padStart(2, "0")}`,
          title: row.name,
          description: `Hito derivado del Gantt para ${row.name}.`,
          date: row.startDate || row.endDate || null,
          epicCode: "E01",
        }));
    }

    const flatTasks2 = flattenBacklog(parsedEpics, parsedMilestones);
    await bulkInsertWbs(input.projectId, flatTasks2);
    // Re-read from DB to get real IDs for the frontend
    const savedItems = await getWbsByProject(input.projectId);
    await updateProjectStage(input.projectId, "planning", { progress: 60 });
    const epicsCount = flatTasks2.filter((t) => t.issueLevel === "epic").length;
    const storiesCount = flatTasks2.filter((t) => t.issueLevel === "story").length;
    const tasksCount = flatTasks2.filter((t) => t.issueLevel === "task").length;
    const milestonesCount = flatTasks2.filter((t) => t.issueLevel === "milestone").length;
    const elapsedMs = Date.now() - startTime;
    console.log(`[generateBacklog] DONE in ${elapsedMs}ms: ${epicsCount} epics, ${storiesCount} stories, ${tasksCount} tasks, ${milestonesCount} milestones`);
    await audit(ctxBacklog, "generate_backlog_from_gantt", "planning", input.projectId, null, {
      epicsCount, storiesCount, tasksCount, milestonesCount, elapsedMs, usedFallback,
    });
    return {
      success: true,
      epicsCount,
      storiesCount,
      tasksCount,
      milestonesCount,
      elapsedMs,
      usedFallback,
      items: savedItems,
    };
  }),

  // ── Download Backlog Excel ────────────────────────────────────────────────────
  downloadBacklogExcel: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input }) => {
      const project = await getProjectById(input.projectId);
      const items = await getWbsByProject(input.projectId);
      const backlogItems = items
        .filter((t) => ["epic", "story", "task", "milestone"].includes(t.issueLevel || ""))
        .map((t) => ({
          id: t.id,
          issueLevel: (t.issueLevel || "task") as "epic" | "story" | "task" | "milestone",
          taskCode: t.taskCode,
          taskName: t.taskName,
          epicCode: t.epicCode,
          storyCode: t.storyCode,
          storyPoints: t.storyPoints,
          acceptanceCriteria: t.acceptanceCriteria,
          assignee: t.assignee,
          phase: t.phase,
        }));
      const buffer = await generateBacklogExcel(project?.projectName || "Proyecto", backlogItems);
      const fileKey = `backlog/${input.projectId}/${Date.now()}_backlog.xlsx`;
      const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      return { url, fileName: `backlog_${project?.projectName?.replace(/\s+/g, "_") || "proyecto"}.xlsx` };
    }),

  // ── Close Section 1: Push to JIRA Epic/Story/Task board ──────────────────────
  closeSection1: protectedProcedure.input(z.object({
    projectId: z.number(),
    confirmationText: z.string().min(1),
    notes: z.string().optional(),
    selectedIds: z.array(z.number()).optional(),
  })).mutation(async ({ input, ctx: ctxClose1 }) => {
    const startTime = Date.now();
    const jiraSpace = await getJiraSpaceByProject(input.projectId);
    if (!jiraSpace?.jiraProjectKey) throw new TRPCError({ code: "BAD_REQUEST", message: "El proyecto no tiene un Space JIRA asociado. Configure JIRA primero." });
    const projectKey = jiraSpace.jiraProjectKey;

    const allItems = await getWbsByProject(input.projectId);
    const selectedSet = input.selectedIds ? new Set(input.selectedIds) : null;
    const filterSel = (items: typeof allItems) => selectedSet ? items.filter((i) => selectedSet.has(i.id)) : items;

    const epics = filterSel(allItems.filter((t) => t.issueLevel === "epic"));
    const stories = filterSel(allItems.filter((t) => t.issueLevel === "story"));
    const tasks = filterSel(allItems.filter((t) => t.issueLevel === "task"));

    const epicKeyMap: Record<string, string> = {};
    const storyKeyMap: Record<string, string> = {};
    const results = { created: 0, skipped: 0, errors: 0, jiraKeys: [] as string[] };

    // Detailed log entries for frontend display
    type LogEntry = { timestamp: string; type: "epic" | "story" | "task"; code: string; name: string; status: "created" | "skipped" | "error"; jiraKey: string | null; parentKey: string | null; errorMsg: string | null; index: number; total: number };
    const logEntries: LogEntry[] = [];
    const totalItems = epics.length + stories.length + tasks.length;
    let processedCount = 0;

    // Pre-populate from already-pushed items
    for (const e of allItems.filter((t) => t.issueLevel === "epic")) { if (e.jiraIssueKey && e.epicCode) epicKeyMap[e.epicCode] = e.jiraIssueKey; }
    for (const s of allItems.filter((t) => t.issueLevel === "story")) { if (s.jiraIssueKey && s.storyCode) storyKeyMap[s.storyCode] = s.jiraIssueKey; }

    console.log(`[JIRA closeSection1] Starting: ${epics.length} epics, ${stories.length} stories, ${tasks.length} tasks → project ${projectKey}`);

    // ── Epics ──
    for (let i = 0; i < epics.length; i++) {
      const epic = epics[i];
      processedCount++;
      if (epic.jiraIssueKey) {
        if (epic.epicCode) epicKeyMap[epic.epicCode] = epic.jiraIssueKey;
        results.skipped++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "epic", code: epic.taskCode || "", name: epic.taskName || "", status: "skipped", jiraKey: epic.jiraIssueKey, parentKey: null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Epic ${i + 1}/${epics.length} SKIPPED (already ${epic.jiraIssueKey}): ${epic.taskCode}`);
        continue;
      }
      try {
        const t0 = Date.now();
        const created = await createJiraIssue({ projectKey, summary: `[${epic.taskCode}] ${epic.taskName}`, description: epic.acceptanceCriteria || epic.taskName, issueTypeName: "Epic", labels: ["pmo-backlog", "epic"] });
        epicKeyMap[epic.epicCode!] = created.key;
        await updateWbsItemJiraKey(epic.id, created.key);
        results.created++; results.jiraKeys.push(created.key);
        logEntries.push({ timestamp: new Date().toISOString(), type: "epic", code: epic.taskCode || "", name: epic.taskName || "", status: "created", jiraKey: created.key, parentKey: null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Epic ${i + 1}/${epics.length} CREATED ${created.key} in ${Date.now() - t0}ms: ${epic.taskCode}`);
      } catch (e: any) {
        console.error(`[JIRA] Epic ${i + 1}/${epics.length} ERROR: ${e.message}`);
        results.errors++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "epic", code: epic.taskCode || "", name: epic.taskName || "", status: "error", jiraKey: null, parentKey: null, errorMsg: e.message, index: processedCount, total: totalItems });
      }
    }

    // ── Stories ──
    for (let i = 0; i < stories.length; i++) {
      const story = stories[i];
      processedCount++;
      if (story.jiraIssueKey) {
        if (story.storyCode) storyKeyMap[story.storyCode] = story.jiraIssueKey;
        results.skipped++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "story", code: story.taskCode || "", name: story.taskName || "", status: "skipped", jiraKey: story.jiraIssueKey, parentKey: null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Story ${i + 1}/${stories.length} SKIPPED (already ${story.jiraIssueKey}): ${story.taskCode}`);
        continue;
      }
      const parentEpicKey = story.epicCode ? epicKeyMap[story.epicCode] : undefined;
      try {
        const t0 = Date.now();
        const created = await createJiraIssue({ projectKey, summary: `[${story.taskCode}] ${story.taskName}`, description: story.acceptanceCriteria ? `*Criterios de aceptación:*\n${story.acceptanceCriteria}\n\n*Story Points:* ${story.storyPoints || "?"}` : story.taskName, issueTypeName: "Story", labels: ["pmo-backlog", "story"] });
        storyKeyMap[story.storyCode!] = created.key;
        await updateWbsItemJiraKey(story.id, created.key, parentEpicKey || null);
        results.created++; results.jiraKeys.push(created.key);
        logEntries.push({ timestamp: new Date().toISOString(), type: "story", code: story.taskCode || "", name: story.taskName || "", status: "created", jiraKey: created.key, parentKey: parentEpicKey || null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Story ${i + 1}/${stories.length} CREATED ${created.key} (parent: ${parentEpicKey || "none"}) in ${Date.now() - t0}ms: ${story.taskCode}`);
      } catch (e: any) {
        console.error(`[JIRA] Story ${i + 1}/${stories.length} ERROR: ${e.message}`);
        results.errors++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "story", code: story.taskCode || "", name: story.taskName || "", status: "error", jiraKey: null, parentKey: parentEpicKey || null, errorMsg: e.message, index: processedCount, total: totalItems });
      }
    }

    // ── Tasks ──
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      processedCount++;
      if (task.jiraIssueKey) {
        results.skipped++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "task", code: task.taskCode || "", name: task.taskName || "", status: "skipped", jiraKey: task.jiraIssueKey, parentKey: null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Task ${i + 1}/${tasks.length} SKIPPED (already ${task.jiraIssueKey}): ${task.taskCode}`);
        continue;
      }
      const parentStoryKey = task.storyCode ? storyKeyMap[task.storyCode] : undefined;
      try {
        const t0 = Date.now();
        const created = await createJiraIssue({ projectKey, summary: `[${task.taskCode}] ${task.taskName}`, description: task.taskName, issueTypeName: "Task", labels: ["pmo-backlog", "task", ...(task.isCritical ? ["critical-path"] : [])] });
        await updateWbsItemJiraKey(task.id, created.key, parentStoryKey || null);
        results.created++; results.jiraKeys.push(created.key);
        logEntries.push({ timestamp: new Date().toISOString(), type: "task", code: task.taskCode || "", name: task.taskName || "", status: "created", jiraKey: created.key, parentKey: parentStoryKey || null, errorMsg: null, index: processedCount, total: totalItems });
        console.log(`[JIRA] Task ${i + 1}/${tasks.length} CREATED ${created.key} (parent: ${parentStoryKey || "none"}) in ${Date.now() - t0}ms: ${task.taskCode}`);
      } catch (e: any) {
        console.error(`[JIRA] Task ${i + 1}/${tasks.length} ERROR: ${e.message}`);
        results.errors++;
        logEntries.push({ timestamp: new Date().toISOString(), type: "task", code: task.taskCode || "", name: task.taskName || "", status: "error", jiraKey: null, parentKey: parentStoryKey || null, errorMsg: e.message, index: processedCount, total: totalItems });
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[JIRA closeSection1] Done in ${elapsedMs}ms: ${results.created} created, ${results.skipped} skipped, ${results.errors} errors`);

    await updateProjectStage(input.projectId, "planning", { progress: 85 });
    // Create stage closure record for section 1
    try {
      await createStageClosure({
        projectId: input.projectId,
        stageId: "planning",
        closedBy: ctxClose1.user.id,
        closedByName: ctxClose1.user.name || "PM",
        confirmationText: `[Sección 1 - Planificación] ${input.confirmationText}`,
        notes: input.notes,
      });
    } catch (e: any) {
      console.warn(`[closeSection1] Could not create stage_closure: ${e.message}`);
    }
    // Auto-complete planning stage if section 2 is also closed (has JIRA milestones)
    try {
      const milestones = await getBillingByProject(input.projectId);
      const section2HasJira = milestones.some((m: any) => m.jiraIssueKey);
      if (section2HasJira) {
        console.log(`[closeSection1] Both sections closed for project ${input.projectId}. Auto-completing planning stage.`);
        await unlockNextStage(input.projectId, "planning");
      }
    } catch (e: any) {
      console.warn(`[closeSection1] Could not auto-complete planning stage: ${e.message}`);
    }
    await audit(ctxClose1, "close_planning_section1", "planning", input.projectId, null, {
      ...results,
      notes: input.notes,
      elapsedMs,
      projectKey,
      totalItems,
      operationLog: logEntries.map(entry => ({
        type: entry.type,
        code: entry.code,
        name: entry.name?.substring(0, 80),
        status: entry.status,
        jiraKey: entry.jiraKey,
        parentKey: entry.parentKey,
        errorMsg: entry.errorMsg,
        timestamp: entry.timestamp,
      })),
    });
    return {
      success: true,
      projectKey,
      ...results,
      verified: results.errors === 0,
      logEntries,
      totals: { epics: epics.length, stories: stories.length, tasks: tasks.length, total: totalItems },
      elapsedMs,
    };
  }),

  // ── Generate Milestones Agentically ──────────────────────────────────────────
  // Priority: Gantt [HITO] rows → SoW billingMilestones → propuesta económica (LLM)
  generateMilestones: protectedProcedure.input(z.object({
    projectId: z.number(),
  })).mutation(async ({ input, ctx: ctxMs }) => {
    const startTime = Date.now();
    console.log(`[generateMilestones] START for project ${input.projectId}`);

    const sow = await getSowByProject(input.projectId);
    const project = await getProjectById(input.projectId);
    const ganttUpload = await getLatestGanttUpload(input.projectId);

    const totalAmount = parseFloat(String(project?.totalAmount || sow?.totalAmount || "0"));
    const currency = project?.currency || sow?.currency || "USD";

    console.log(`[generateMilestones] Data: sow=${!!sow}, project=${project?.projectName}, gantt=${!!ganttUpload}, totalAmount=${totalAmount}, currency=${currency}`);

    // ── Source 1: Extract dates from Gantt ──
    let ganttHitos: { name: string; date: string | null }[] = [];
    let ganttTimeline: { startDate: string | null; endDate: string | null; phases: { name: string; endDate: string | null }[] } = { startDate: null, endDate: null, phases: [] };
    let allGanttRows: any[] = [];
    if (ganttUpload?.fileUrl) {
      try {
        const resp = await fetch(ganttUpload.fileUrl);
        const arrBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrBuf);
        const ganttRows = parseGanttBuffer(buf);
        allGanttRows = ganttRows;

        // Extract explicit [HITO] rows
        ganttHitos = ganttRows
          .filter((r) => r.isHito)
          .map((r) => ({ name: r.name.replace(/^\[HITO\]\s*/i, "").trim(), date: r.endDate || r.startDate }));
        console.log(`[generateMilestones] Found ${ganttHitos.length} [HITO] rows in Gantt`);

        // Extract overall timeline from all rows
        const allDates = ganttRows.map(r => r.startDate || r.endDate).filter(Boolean).sort();
        ganttTimeline.startDate = allDates[0] || null;
        ganttTimeline.endDate = allDates[allDates.length - 1] || null;

        // Extract phase-level end dates (level 1 summaries, or unique date clusters)
        const summaryRows = ganttRows.filter(r => r.isSummary && r.level <= 1);
        if (summaryRows.length > 0) {
          ganttTimeline.phases = summaryRows.map(r => ({ name: r.name, endDate: r.endDate }));
        } else {
          // If no clear phases, find distinct end dates to create phase boundaries
          const uniqueEndDates = Array.from(new Set(ganttRows.filter(r => r.endDate).map(r => r.endDate))).sort() as string[];
          // Pick evenly-spaced dates as phase boundaries
          if (uniqueEndDates.length >= 3) {
            const step = Math.floor(uniqueEndDates.length / 4);
            for (let i = 1; i <= 4 && i * step < uniqueEndDates.length; i++) {
              ganttTimeline.phases.push({ name: `Fase ${i}`, endDate: uniqueEndDates[Math.min(i * step, uniqueEndDates.length - 1)] });
            }
          }
        }
        console.log(`[generateMilestones] Gantt timeline: ${ganttTimeline.startDate} → ${ganttTimeline.endDate}, ${ganttTimeline.phases.length} phases`);
      } catch (e: any) {
        console.warn(`[generateMilestones] Failed to parse Gantt for hitos: ${e.message}`);
      }
    }

    // ── Source 2: SoW billingMilestones field ──
    let sowBillingMilestones: any[] = [];
    if (sow?.billingMilestones) {
      try {
        sowBillingMilestones = Array.isArray(sow.billingMilestones) ? sow.billingMilestones : JSON.parse(String(sow.billingMilestones));
        console.log(`[generateMilestones] Found ${sowBillingMilestones.length} billing milestones in SoW`);
      } catch { sowBillingMilestones = []; }
    }

    // ── Source 3: SoW milestones field (general milestones) ──
    let sowMilestones: any[] = [];
    if (sow?.milestones) {
      try {
        sowMilestones = Array.isArray(sow.milestones) ? sow.milestones : JSON.parse(String(sow.milestones));
        console.log(`[generateMilestones] Found ${sowMilestones.length} general milestones in SoW`);
      } catch { sowMilestones = []; }
    }

    // Build rich context for the LLM with all available sources
    const ganttHitosText = ganttHitos.length > 0
      ? `\n\nHITOS EXPLÍCITOS DEL GANTT (fuente primaria - usar estos como base):\n${ganttHitos.map((h, i) => `  ${i + 1}. ${h.name} | Fecha: ${h.date || "No definida"}`).join("\n")}`
      : "";

    const ganttTimelineText = ganttTimeline.startDate
      ? `\n\nTIMELINE DEL GANTT (${allGanttRows.length} tareas):\n  Inicio: ${ganttTimeline.startDate}\n  Fin: ${ganttTimeline.endDate}\n  Fases detectadas: ${ganttTimeline.phases.length > 0 ? ganttTimeline.phases.map((p, i) => `\n    ${i + 1}. ${p.name} → finaliza ${p.endDate || "sin fecha"}`).join("") : "No se detectaron fases claras"}`
      : "";

    const sowBillingText = sowBillingMilestones.length > 0
      ? `\n\nHITOS DE FACTURACIÓN DEL SOW (fuente secundaria):\n${JSON.stringify(sowBillingMilestones, null, 2).substring(0, 1500)}`
      : "";

    const sowMilestonesText = sowMilestones.length > 0
      ? `\n\nHITOS GENERALES DEL SOW:\n${JSON.stringify(sowMilestones, null, 2).substring(0, 1000)}`
      : "";

    const sowContextText = sow
      ? `Objetivo: ${sow.generalObjective || "N/A"}. Entregables: ${JSON.stringify(sow.deliverables || []).substring(0, 800)}.`
      : "";

    const systemPrompt = `Eres Gerente de Proyectos Senior PMP de Prodigio Tech con 15+ años de experiencia en estructurar hitos de pago para proyectos de tecnología en Latinoamérica. Alineas los pagos con entregables verificables y SIEMPRE asignas fechas objetivo a cada hito. Responde SOLO con JSON válido.`;

    const milestonePrompt = `Proyecto: ${project?.projectName}. Cliente: ${project?.clientName}. Tipo: ${project?.projectType}.
${sowContextText}

Monto total del proyecto: ${totalAmount > 0 ? `${currency} ${totalAmount}` : "No definido"}
Fecha inicio proyecto: ${project?.startDate || ganttTimeline.startDate || "No definida"}
Fecha fin proyecto: ${project?.endDate || ganttTimeline.endDate || "No definida"}
${ganttHitosText}${ganttTimelineText}${sowBillingText}${sowMilestonesText}

PRIORIDAD DE FUENTES para los hitos de pago:
1. HITOS DEL GANTT: Si hay [HITO] en el Gantt, DEBEN ser la base principal. Cada [HITO] del Gantt se convierte en un hito de facturación.
2. TIMELINE DEL GANTT: Si no hay [HITO] explícitos pero hay timeline, distribuir los hitos proporcionalmente a lo largo de la duración del proyecto usando las fechas de fin de las fases.
3. HITOS DEL SOW: Si no hay Gantt, usar los hitos de facturación del SoW como base.
4. PROPUESTA ECONÓMICA: Si no hay hitos en ninguna fuente, proponer hitos estándar basados en las fases del proyecto.

REGLA CRÍTICA - FECHA OBJETIVO (dueDate):
- CADA hito DEBE tener una fecha objetivo (dueDate) en formato YYYY-MM-DD
- Si hay fechas en el Gantt, usar las fechas de fin de fase como referencia
- Si hay fechas en el SoW, usarlas como referencia
- Si no hay fechas disponibles, calcular distribuyendo proporcionalmente entre inicio y fin del proyecto
- El campo "dateSource" indica de dónde viene la fecha: "gantt" si viene del Gantt, "sow" si viene del SoW, "ai" si fue calculada por la IA
- NUNCA dejar dueDate vacío o null

Reglas generales:
- Típicamente 3-6 hitos para proyectos de tecnología
- Distribuir el 100% del monto total entre los hitos
- Primer hito: al inicio del proyecto (anticipo 20-30%)
- Hitos intermedios: al completar fases importantes
- Último hito: al cierre y aceptación final (10-20%)
- Cada hito debe tener una descripción clara del entregable que lo gatilla

Responde SOLO con JSON válido:
{
  "milestones": [{
    "milestoneNumber": 1,
    "description": "Descripción clara del hito y entregable que lo gatilla",
    "percentage": "30",
    "amount": "30000",
    "currency": "USD",
    "dueDate": "2026-03-15",
    "dateSource": "gantt",
    "rationale": "Justificación del hito",
    "source": "gantt|sow|propuesta"
  }],
  "totalAmount": "${totalAmount || 100000}",
  "currency": "${currency}",
  "notes": "Observaciones generales sobre los hitos propuestos"
}

Solo JSON, sin texto adicional.`;

    // Helper to parse milestones from LLM response
    const parseMilestonesFromLLM = (responseObj: any): any[] => {
      const rawContent = responseObj.choices?.[0]?.message?.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      console.log(`[generateMilestones] Received response (${contentStr.length} bytes)`);

      try {
        const raw = JSON.parse(contentStr);
        if (typeof raw === "object" && raw !== null) {
          let items = raw.milestones || raw.hitos || raw.billing_milestones || raw.data || raw.items || [];
          if (items.length === 0) {
            const arrayValues = Object.values(raw).filter(v => Array.isArray(v)) as any[][];
            for (const arr of arrayValues) {
              if (arr.length > 0 && arr[0] && (arr[0].description || arr[0].milestoneNumber || arr[0].percentage)) {
                items = arr;
                console.log(`[generateMilestones] Found milestones under unexpected key, count: ${items.length}`);
                break;
              }
            }
          }
          return items.filter((m: any) => m && typeof m === "object" && (m.description || m.name));
        }
      } catch (e) {
        console.error(`[generateMilestones] JSON parse error`, e);
      }
      return [];
    };

    // ── Attempt 1: Full context text-only (never PDF) ──
    console.log(`[generateMilestones] Attempt 1: full context, ganttHitos=${ganttHitos.length}, sowBilling=${sowBillingMilestones.length}`);
    let llmStart = Date.now();
    let response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: milestonePrompt },
      ],
      response_format: { type: "json_object" } as any,
    });
    console.log(`[generateMilestones] Attempt 1 LLM responded in ${Date.now() - llmStart}ms`);
    let parsedMilestones = parseMilestonesFromLLM(response);
    console.log(`[generateMilestones] Attempt 1 parsed ${parsedMilestones.length} milestones`);

    // ── Attempt 2: Simplified prompt ──
    if (parsedMilestones.length === 0) {
      console.log(`[generateMilestones] Attempt 1 failed, retrying with simplified prompt...`);
      const simplifiedPrompt = `Genera hitos de pago JSON para: ${project?.projectName} (${project?.clientName}). Monto: ${currency} ${totalAmount || "100000"}. ${ganttHitos.length > 0 ? `Hitos del Gantt: ${ganttHitos.map(h => h.name).join(", ")}` : "3-5 hitos estándar"}. Responde: {"milestones": [{"milestoneNumber": 1, "description": "...", "percentage": "30", "amount": "30000", "currency": "${currency}", "dueDate": "YYYY-MM-DD"}]}`;
      llmStart = Date.now();
      response = await invokeLLM({
        messages: [
          { role: "system", content: "Genera hitos de pago en JSON. Responde SOLO con JSON válido con key \"milestones\"." },
          { role: "user", content: simplifiedPrompt },
        ],
        response_format: { type: "json_object" } as any,
      });
      console.log(`[generateMilestones] Attempt 2 (simplified) LLM responded in ${Date.now() - llmStart}ms`);
      parsedMilestones = parseMilestonesFromLLM(response);
      console.log(`[generateMilestones] Attempt 2 parsed ${parsedMilestones.length} milestones`);
    }

    // ── Attempt 3: Minimal prompt ──
    if (parsedMilestones.length === 0) {
      console.log(`[generateMilestones] Attempt 2 also failed, trying Attempt 3 with minimal prompt...`);
      llmStart = Date.now();
      response = await invokeLLM({
        messages: [
          { role: "system", content: "Genera exactamente 4 hitos de pago en JSON." },
          { role: "user", content: `{"milestones": [{"milestoneNumber": 1, "description": "Anticipo - Inicio del proyecto", "percentage": "30", "amount": "${Math.round(totalAmount * 0.3)}", "currency": "${currency}"}, ...]}. Proyecto: ${project?.projectName}. Total: ${currency} ${totalAmount || 100000}. Genera 4 hitos que sumen 100%.` },
        ],
        response_format: { type: "json_object" } as any,
      });
      console.log(`[generateMilestones] Attempt 3 (minimal) LLM responded in ${Date.now() - llmStart}ms`);
      parsedMilestones = parseMilestonesFromLLM(response);
      console.log(`[generateMilestones] Attempt 3 parsed ${parsedMilestones.length} milestones`);
    }

    if (parsedMilestones.length === 0) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "La IA no generó hitos de pago válidos después de 3 intentos. Intente nuevamente." });
    }

    // ── Post-process: fill missing dates from Gantt timeline ──
    const projectStart = project?.startDate || ganttTimeline.startDate;
    const projectEnd = project?.endDate || ganttTimeline.endDate;
    if (projectStart && projectEnd) {
      const startMs = new Date(projectStart).getTime();
      const endMs = new Date(projectEnd).getTime();
      const totalDuration = endMs - startMs;
      const count = parsedMilestones.length;
      parsedMilestones.forEach((m: any, idx: number) => {
        // Validate existing dueDate
        if (m.dueDate) {
          try {
            const d = new Date(m.dueDate);
            if (!isNaN(d.getTime())) return; // valid date, keep it
          } catch { /* invalid, will be recalculated */ }
        }
        // Calculate proportional date based on milestone position
        const fraction = (idx + 1) / count;
        const dateMs = startMs + Math.round(totalDuration * fraction);
        m.dueDate = new Date(dateMs).toISOString().split("T")[0];
        if (!m.dateSource) m.dateSource = "ai";
        console.log(`[generateMilestones] Filled missing date for milestone ${idx + 1}: ${m.dueDate} (calculated)`);
      });
    }

    // Save to DB with dateSource
    await upsertBillingMilestones(input.projectId, parsedMilestones.map((m: any) => {
      let dateVal: string | null = null;
      if (m.dueDate) {
        try { const d = new Date(m.dueDate); dateVal = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0]; } catch { dateVal = null; }
      }
      // Determine dateSource
      let dateSource: "gantt" | "sow" | "ai" | "manual" | null = null;
      if (dateVal) {
        if (m.dateSource === "gantt" || (m.source === "gantt" && ganttHitos.length > 0)) dateSource = "gantt";
        else if (m.dateSource === "sow" || m.source === "sow") dateSource = "sow";
        else if (ganttTimeline.startDate) dateSource = "gantt"; // date derived from Gantt timeline
        else dateSource = "ai";
      }
      return {
        description: m.description || m.name || "Hito de pago",
        percentage: m.percentage || null,
        amount: m.amount || null,
        currency: m.currency || currency,
        dueDate: dateVal,
        dateSource,
        responsableName: null,
        responsableEmail: null,
      };
    }));

    // Re-read from DB to get real IDs for the frontend
    const savedMilestonesRaw = await getBillingByProject(input.projectId);
    const savedMilestones = savedMilestonesRaw.map(r => ({ ...r, dueDate: r.dueDate ? String(r.dueDate) : null }));
    const elapsedMs = Date.now() - startTime;
    console.log(`[generateMilestones] DONE in ${elapsedMs}ms: ${savedMilestones.length} milestones saved. Sources: ganttHitos=${ganttHitos.length}, sowBilling=${sowBillingMilestones.length}`);

    await audit(ctxMs, "generate_milestones", "planning", input.projectId, null, {
      count: savedMilestones.length,
      ganttHitosUsed: ganttHitos.length,
      sowBillingUsed: sowBillingMilestones.length,
      elapsedMs,
    });
    return {
      success: true,
      milestones: savedMilestones,
      sources: {
        ganttHitos: ganttHitos.length,
        sowBilling: sowBillingMilestones.length,
        sowMilestones: sowMilestones.length,
      },
      totalAmount: String(totalAmount),
      currency,
      elapsedMs,
    };
  }),

  // ── Close Section 2: Push milestones to JIRA Hito PMO board ──────────────────
  closeSection2: protectedProcedure.input(z.object({
    projectId: z.number(),
    confirmationText: z.string().min(1),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx: ctxClose2 }) => {
    const startTime = Date.now();
    const jiraSpace = await getJiraSpaceByProject(input.projectId);
    if (!jiraSpace?.jiraProjectKey) throw new TRPCError({ code: "BAD_REQUEST", message: "El proyecto no tiene un Space JIRA asociado. Configure JIRA primero." });
    const projectKey = jiraSpace.jiraProjectKey;

    const milestones4 = await getBillingByProject(input.projectId);

    // ── Validate responsable and email on all milestones ──
    const incomplete = milestones4.filter((m: any) => !m.responsableName?.trim() || !m.responsableEmail?.trim());
    if (incomplete.length > 0) {
      const missing = incomplete.map((m: any) => {
        const fields: string[] = [];
        if (!m.responsableName?.trim()) fields.push("responsable");
        if (!m.responsableEmail?.trim()) fields.push("email");
        return `Hito ${m.milestoneNumber}: falta ${fields.join(" y ")}`;
      });
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `No se puede cerrar: ${incomplete.length} hito(s) sin responsable o email completo. ${missing.join(". ")}.`,
      });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const badEmails = milestones4.filter((m: any) => m.responsableEmail && !emailRegex.test(m.responsableEmail.trim()));
    if (badEmails.length > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Email inválido en hito(s): ${badEmails.map((m: any) => `Hito ${m.milestoneNumber} (${m.responsableEmail})`).join(", ")}`,
      });
    }
    const results2 = { created: 0, skipped: 0, errors: 0, jiraKeys: [] as string[] };

    type MilestoneLogEntry = { timestamp: string; milestoneNumber: number; description: string; status: "created" | "skipped" | "error"; jiraKey: string | null; errorMsg: string | null; index: number; total: number };
    const logEntries: MilestoneLogEntry[] = [];
    const totalMilestones = milestones4.length;

    console.log(`[JIRA closeSection2] Starting: ${totalMilestones} milestones \u2192 project ${projectKey}`);

    for (let i = 0; i < milestones4.length; i++) {
      const ms = milestones4[i];
      if (ms.jiraIssueKey) {
        results2.skipped++;
        logEntries.push({ timestamp: new Date().toISOString(), milestoneNumber: ms.milestoneNumber ?? (i + 1), description: ms.description || "", status: "skipped", jiraKey: ms.jiraIssueKey, errorMsg: null, index: i + 1, total: totalMilestones });
        console.log(`[JIRA] Hito ${i + 1}/${totalMilestones} SKIPPED (already ${ms.jiraIssueKey}): ${ms.description}`);
        continue;
      }
      try {
        const t0 = Date.now();
        const dueDate = ms.dueDate ? String(ms.dueDate) : undefined;
        const created = await createJiraIssue({
          projectKey,
          summary: `[Hito ${ms.milestoneNumber}] ${ms.description}`,
          description: `*Hito de Pago ${ms.milestoneNumber}*\n\n${ms.description}\n\n*Monto:* ${ms.currency || "USD"} ${ms.amount || "Por definir"}\n*Porcentaje:* ${ms.percentage || "?"}%\n*Fecha objetivo:* ${dueDate || "Por definir"}\n*Responsable:* ${ms.responsableName || "Por asignar"} (${ms.responsableEmail || ""})`,
          issueTypeName: "Hito PMO",
          labels: ["pmo-hito", "billing"],
          dueDate,
        });
        await updateBillingMilestoneJiraKey(ms.id, created.key, created.id);
        results2.created++;
        results2.jiraKeys.push(created.key);
        logEntries.push({ timestamp: new Date().toISOString(), milestoneNumber: ms.milestoneNumber ?? (i + 1), description: ms.description || "", status: "created", jiraKey: created.key, errorMsg: null, index: i + 1, total: totalMilestones });
        console.log(`[JIRA] Hito ${i + 1}/${totalMilestones} CREATED ${created.key} in ${Date.now() - t0}ms: ${ms.description}`);
      } catch (e: any) {
        console.error(`[JIRA] Hito ${i + 1}/${totalMilestones} ERROR: ${e.message}`);
        results2.errors++;
        logEntries.push({ timestamp: new Date().toISOString(), milestoneNumber: ms.milestoneNumber ?? (i + 1), description: ms.description || "", status: "error", jiraKey: null, errorMsg: e.message, index: i + 1, total: totalMilestones });
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[JIRA closeSection2] Done in ${elapsedMs}ms: ${results2.created} created, ${results2.skipped} skipped, ${results2.errors} errors`);

    await updateProjectStage(input.projectId, "planning", { progress: 100 });
    // Create stage closure record for section 2
    try {
      await createStageClosure({
        projectId: input.projectId,
        stageId: "planning",
        closedBy: ctxClose2.user.id,
        closedByName: ctxClose2.user.name || "PM",
        confirmationText: `[Sección 2 - Hitos de Pago] ${input.confirmationText}`,
        notes: input.notes,
      });
    } catch (e: any) {
      console.warn(`[closeSection2] Could not create stage_closure: ${e.message}`);
    }
    // Auto-complete planning stage if section 1 is also closed (has JIRA items)
    try {
      const wbsItems = await getWbsByProject(input.projectId);
      const section1HasJira = wbsItems.some((w: any) => w.jiraIssueKey && w.issueLevel);
      if (section1HasJira) {
        console.log(`[closeSection2] Both sections closed for project ${input.projectId}. Auto-completing planning stage.`);
        await unlockNextStage(input.projectId, "planning");
      }
    } catch (e: any) {
      console.warn(`[closeSection2] Could not auto-complete planning stage: ${e.message}`);
    }
    await audit(ctxClose2, "close_planning_section2", "planning", input.projectId, null, {
      ...results2,
      notes: input.notes,
      elapsedMs,
      projectKey,
      totalMilestones,
      operationLog: logEntries.map(entry => ({
        milestoneNumber: entry.milestoneNumber,
        description: entry.description?.substring(0, 100),
        status: entry.status,
        jiraKey: entry.jiraKey,
        errorMsg: entry.errorMsg,
        timestamp: entry.timestamp,
      })),
    });
    return {
      success: true,
      projectKey,
      ...results2,
      verified: results2.errors === 0,
      logEntries,
      totals: { milestones: totalMilestones },
      elapsedMs,
    };
  }),

  // ── Retry Section 2: Re-attempt JIRA milestone creation for items without jiraIssueKey ──
  retrySection2: protectedProcedure.input(z.object({
    projectId: z.number(),
  })).mutation(async ({ input, ctx: ctxRetry }) => {
    const startTime = Date.now();
    const jiraSpace = await getJiraSpaceByProject(input.projectId);
    if (!jiraSpace?.jiraProjectKey) throw new TRPCError({ code: "BAD_REQUEST", message: "El proyecto no tiene un Space JIRA asociado." });
    const projectKey = jiraSpace.jiraProjectKey;

    const milestones = await getBillingByProject(input.projectId);
    const pending = milestones.filter(m => !m.jiraIssueKey);
    if (pending.length === 0) return { success: true, projectKey, message: "Todos los hitos ya tienen issue JIRA", created: 0, skipped: milestones.length, errors: 0, jiraKeys: milestones.filter(m => m.jiraIssueKey).map(m => m.jiraIssueKey!), logEntries: [], totals: { milestones: milestones.length }, elapsedMs: 0, verified: true };

    const results = { created: 0, skipped: 0, errors: 0, jiraKeys: [] as string[] };
    type MilestoneLogEntry = { timestamp: string; milestoneNumber: number; description: string; status: "created" | "skipped" | "error"; jiraKey: string | null; errorMsg: string | null; index: number; total: number };
    const logEntries: MilestoneLogEntry[] = [];

    console.log(`[JIRA retrySection2] Retrying: ${pending.length} pending milestones -> project ${projectKey}`);

    for (let i = 0; i < pending.length; i++) {
      const ms = pending[i];
      try {
        const t0 = Date.now();
        const dueDate = ms.dueDate ? String(ms.dueDate) : undefined;
        const created = await createJiraIssue({
          projectKey,
          summary: `[Hito ${ms.milestoneNumber}] ${ms.description}`,
          description: `*Hito de Pago ${ms.milestoneNumber}*\n\n${ms.description}\n\n*Monto:* ${ms.currency || "USD"} ${ms.amount || "Por definir"}\n*Porcentaje:* ${ms.percentage || "?"}%\n*Fecha objetivo:* ${dueDate || "Por definir"}\n*Responsable:* ${ms.responsableName || "Por asignar"} (${ms.responsableEmail || ""})`,
          issueTypeName: "Hito PMO",
          labels: ["pmo-hito", "billing"],
          dueDate,
        });
        await updateBillingMilestoneJiraKey(ms.id, created.key, created.id);
        results.created++;
        results.jiraKeys.push(created.key);
        logEntries.push({ timestamp: new Date().toISOString(), milestoneNumber: ms.milestoneNumber ?? (i + 1), description: ms.description || "", status: "created", jiraKey: created.key, errorMsg: null, index: i + 1, total: pending.length });
        console.log(`[JIRA] Retry Hito ${i + 1}/${pending.length} CREATED ${created.key} in ${Date.now() - t0}ms`);
      } catch (e: any) {
        console.error(`[JIRA] Retry Hito ${i + 1}/${pending.length} ERROR: ${e.message}`);
        results.errors++;
        logEntries.push({ timestamp: new Date().toISOString(), milestoneNumber: ms.milestoneNumber ?? (i + 1), description: ms.description || "", status: "error", jiraKey: null, errorMsg: e.message, index: i + 1, total: pending.length });
      }
    }

    const elapsedMs = Date.now() - startTime;
    console.log(`[JIRA retrySection2] Done in ${elapsedMs}ms: ${results.created} created, ${results.errors} errors`);
    // Auto-complete planning stage if all milestones now have JIRA keys and section 1 is also closed
    if (results.errors === 0) {
      try {
        const currentStage = await getProjectStages(input.projectId);
        const planningStage = currentStage.find((s: any) => s.stageId === "planning");
        if (planningStage?.status === "in_progress") {
          const wbsItems = await getWbsByProject(input.projectId);
          const section1HasJira = wbsItems.some((w: any) => w.jiraIssueKey && w.issueLevel);
          if (section1HasJira) {
            console.log(`[retrySection2] All milestones synced and section 1 closed. Auto-completing planning stage.`);
            await unlockNextStage(input.projectId, "planning");
          }
        }
      } catch (e: any) {
        console.warn(`[retrySection2] Could not auto-complete planning stage: ${e.message}`);
      }
    }
    await audit(ctxRetry, "retry_planning_section2", "planning", input.projectId, null, {
      ...results,
      elapsedMs,
      projectKey,
      pendingCount: pending.length,
      operationLog: logEntries.map(entry => ({
        milestoneNumber: entry.milestoneNumber,
        description: entry.description?.substring(0, 100),
        status: entry.status,
        jiraKey: entry.jiraKey,
        errorMsg: entry.errorMsg,
        timestamp: entry.timestamp,
      })),
    });
    return {
      success: true,
      projectKey,
      ...results,
      verified: results.errors === 0,
      logEntries,
      totals: { milestones: pending.length },
      elapsedMs,
    };
  }),

  complete: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await unlockNextStage(input.projectId, "planning");
      await audit(ctx, "complete_stage", "planning", input.projectId);
      return { success: true };
    }),
});

// ==================== ADVANCE (ex-DESIGN) ROUTER ====================
const advanceRouter = router({
  /** Fetch full advance report from JIRA for a project */
  getReport: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const space = await getJiraSpaceByProject(input.projectId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado a este proyecto" });
      const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
      if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la key del proyecto JIRA" });
      const report = await getJiraAdvanceReport(projectKey);
      return report;
    }),

  /** Generate AI executive summary based on JIRA data */
  generateSummary: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const space = await getJiraSpaceByProject(input.projectId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado" });
      const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
      if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la key del proyecto JIRA" });
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      const report = await getJiraAdvanceReport(projectKey);

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Eres un Gerente de Proyectos PMO Senior de Prodigio Tech. Genera un resumen ejecutivo profesional del estado del proyecto basado en los datos de JIRA. Responde SOLO con JSON v\u00e1lido.` },
          { role: "user", content: `Proyecto: ${project.projectName} (${projectKey})
Deal: ${(project as any).dealId || "N/A"}

Datos del proyecto:
- Issues totales: ${report.totalIssues}
- Finalizados: ${report.doneCount} (${report.percentComplete}%)
- En progreso: ${report.inProgressCount}
- Pendientes: ${report.toDoCount}
- \u00c9picas: ${report.epics.length} (${report.epics.filter(e => e.statusCategory === "Done").length} finalizadas)
- Hitos: ${report.milestones.length} (${report.milestonesCumplidos} cumplidos, ${report.milestonesPendientes} pendientes)
- Riesgos: ${report.risks.length} (${report.risks.filter(r => r.statusCategory === "Done").length} cerrados)
- Cambios de alcance: ${report.scopeChanges.length}
- Equipo: ${report.team.length} miembros

Responde SOLO con JSON:
{
  "summary": "P\u00e1rrafo de 3-5 l\u00edneas describiendo el estado general del proyecto, avance, logros principales y pendientes.",
  "semaphore": "VERDE|AMARILLO|ROJO",
  "semaphoreDescription": "Descripci\u00f3n breve del sem\u00e1foro",
  "nextSteps": [
    { "title": "T\u00edtulo de la acci\u00f3n", "description": "Descripci\u00f3n detallada", "priority": "URGENTE|ALTA|MEDIA" }
  ]
}` },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      const parsed = JSON.parse(contentStr);
      await audit(ctx, "generate_advance_summary", "advance", input.projectId, project.projectName);
      return { success: true, data: parsed };
    }),

  /** Generate PPTX report and upload to S3 */
  generatePptx: protectedProcedure.input(z.object({
    projectId: z.number(),
    summary: z.object({
      summary: z.string(),
      semaphore: z.string(),
      semaphoreDescription: z.string(),
      nextSteps: z.array(z.object({ title: z.string(), description: z.string(), priority: z.string() })),
    }).optional(),
  })).mutation(async ({ input, ctx }) => {
    const space = await getJiraSpaceByProject(input.projectId);
    if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado" });
    const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
    if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontr\u00f3 la key del proyecto JIRA" });
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    const report = await getJiraAdvanceReport(projectKey);

    const { generateAdvanceReportPptx } = await import("./advanceReportPptx");
    const buffer = await generateAdvanceReportPptx({
      projectName: project.projectName,
      dealId: (project as any).dealId,
      report,
      summary: input.summary,
    });

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const fileName = `Reporte ${project.projectName} ${dd}${mm}${yyyy}.pptx`;
    const fileKey = `advance-reports/${input.projectId}/${fileName}`;

    const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.presentationml.presentation");
    await audit(ctx, "generate_pptx_report", "advance", input.projectId, project.projectName);
    return { success: true, url, fileName };
  }),

  /** Generate DOCX report and upload to S3 */
  generateDocx: protectedProcedure.input(z.object({
    projectId: z.number(),
    summary: z.object({
      summary: z.string(),
      semaphore: z.string(),
      semaphoreDescription: z.string(),
      nextSteps: z.array(z.object({ title: z.string(), description: z.string(), priority: z.string() })),
    }).optional(),
  })).mutation(async ({ input, ctx }) => {
    const space = await getJiraSpaceByProject(input.projectId);
    if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado" });
    const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
    if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la key del proyecto JIRA" });
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    const report = await getJiraAdvanceReport(projectKey);

    const { generateAdvanceReportDocx } = await import("./advanceReportDocx");
    const buffer = await generateAdvanceReportDocx({
      projectName: project.projectName,
      dealId: (project as any).dealId,
      report,
      summary: input.summary,
    });

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yyyy = now.getFullYear();
    const safeName = project.projectName.replace(/[^a-zA-Z0-9_-]+/g, "_");
    const fileName = `Reporte_${safeName}_${dd}${mm}${yyyy}.docx`;
    const fileKey = `advance-reports/${input.projectId}/${nanoid()}-${fileName}`;
    const { url } = await storagePut(fileKey, buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    await audit(ctx, "generate_docx_report", "advance", input.projectId, project.projectName);
    return { success: true, url, fileName };
  }),

  /** Get linked project executive dashboard combining JIRA + Financial data */
  getLinkedDashboard: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      const space = await getJiraSpaceByProject(input.projectId);
      const projectKey = space ? (space.jiraProjectKey ?? space.jiraProjectId) : null;

      // Fetch JIRA data if available, otherwise return empty
      let jiraData = {
        totalIssues: 0, doneCount: 0, inProgressCount: 0, toDoCount: 0,
        percentComplete: 0, epics: [] as any[], milestones: [] as any[],
        milestonesCumplidos: 0, milestonesPendientes: 0,
        milestoneCompletionPct: 0, primaryProgressPct: 0, primaryProgressSource: "JIRA_FALLBACK" as "MILESTONES" | "JIRA_FALLBACK",
        risks: [] as any[], scopeChanges: [] as any[], team: [] as any[],
        byStatus: [] as any[], byType: [] as any[],
      };
      let hasJira = false;
      if (projectKey) {
        try {
          const jiraReport = await getJiraAdvanceReport(projectKey);
          jiraData = {
            totalIssues: jiraReport.totalIssues,
            doneCount: jiraReport.doneCount,
            inProgressCount: jiraReport.inProgressCount,
            toDoCount: jiraReport.toDoCount,
            percentComplete: jiraReport.percentComplete,
            epics: jiraReport.epics,
            milestones: jiraReport.milestones,
            milestonesCumplidos: jiraReport.milestonesCumplidos,
            milestonesPendientes: jiraReport.milestonesPendientes,
            milestoneCompletionPct: jiraReport.milestoneCompletionPct,
            primaryProgressPct: jiraReport.primaryProgressPct,
            primaryProgressSource: jiraReport.primaryProgressSource,
            risks: jiraReport.risks,
            scopeChanges: jiraReport.scopeChanges,
            team: jiraReport.team,
            byStatus: jiraReport.byStatus,
            byType: jiraReport.byType,
          };
          hasJira = true;
        } catch (err) {
          console.warn("Failed to fetch JIRA data:", err);
        }
      }

      const { getFinancialDataForDeal, extractDealId } = await import("./financialDataFetcher");
      const dealId = extractDealId(project.projectName) || "";
      let financialData = null;
      try {
        if (dealId) {
          financialData = await getFinancialDataForDeal(dealId);
        }
      } catch (err) {
        console.warn("Failed to fetch financial data:", err);
      }

      // For platform projects, also try to get SoW/WBS stage data
      let platformStageData = null;
      if (!hasJira) {
        try {
          const stages = await getProjectStages(input.projectId);
          const sowData = await getSowByProject(input.projectId);
          const wbsTasks = await getWbsByProject(input.projectId);
          platformStageData = {
            stages: stages || [],
            sowSummary: sowData ? {
              generalObjective: sowData.generalObjective || "",
              totalAmount: sowData.totalAmount || 0,
              currency: sowData.currency || "UF",
              deliverables: ((sowData.deliverables as any[]) || []).length,
              milestones: ((sowData.milestones as any[]) || []).length,
            } : null,
            wbsTaskCount: wbsTasks?.length || 0,
          };
        } catch { /* ignore */ }
      }

      return {
        project: {
          id: project.id,
          name: project.projectName,
          client: (project as any).clientName || "",
          dealId,
          origin: (project as any).origin || "platform",
          jiraProjectKey: projectKey || "",
        },
        jira: jiraData,
        financial: financialData,
        hasJira,
        platformStageData,
      };
    }),

  /** Preclasificación no persistente: el usuario debe revisar cada compromiso antes de registrarlo. */
  previewExecutiveCommitments: adminOrPmo.input(z.object({
    projectId: z.number(),
    rawText: z.string().trim().min(20).max(30000),
  })).mutation(async ({ input }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "La preclasificación documental v2 está habilitada sólo para el piloto Tanner" });
    const commitments = extractReviewableCommitments(input.rawText);
    return {
      commitments,
      notice: "Resultado preclasificado: revísalo y confirma cada campo antes de registrar la minuta. No se ha guardado evidencia ni compromiso.",
    };
  }),

  /** Carga validada: subir un archivo no acredita por sí mismo una minuta, acta ni PRD. */
  uploadExecutiveEvidence: adminOrPmo.input(z.object({
    projectId: z.number(),
    documentType: executiveEvidenceDocumentTypeSchema,
    fileName: z.string().trim().min(1).max(500),
    mimeType: z.string().trim().min(1).max(150),
    contentBase64: z.string().min(4).max(36_000_000),
  })).mutation(async ({ input, ctx }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "La carga documental v2 está habilitada sólo para el piloto Tanner" });
    const source = await getExecutiveProjectSource(input.projectId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
    const validated = validateExecutiveEvidenceUpload(input);
    const folder = input.documentType === "acceptance" ? "actas" : input.documentType === "minute" ? "minutas" : "prd";
    const key = `executive-evidence/project-${input.projectId}/${folder}/${Date.now()}-${nanoid(10)}-${validated.fileName}`;
    const stored = await storagePut(key, validated.buffer, validated.mimeType);
    await audit(ctx, "executive_evidence_uploaded", "executive_evidence_file", stored.key, validated.fileName, {
      projectId: input.projectId,
      sourceId: source.id,
      documentType: input.documentType,
      sizeBytes: validated.buffer.length,
      mimeType: validated.mimeType,
      sha256: validated.sha256,
      status: "uploaded_pending_governance_registration",
    });
    return {
      fileName: validated.fileName,
      fileUrl: stored.url,
      sha256: validated.sha256,
      sizeBytes: validated.buffer.length,
      mimeType: validated.mimeType,
      notice: "Archivo validado y almacenado. Aún debes registrar y revisar la evidencia para que afecte al gobierno ejecutivo.",
    };
  }),

  /** Registro de una minuta real. Sólo PMO/Admin puede cargar la referencia y sus compromisos revisables. */
  recordExecutiveMinute: adminOrPmo.input(z.object({
    projectId: z.number(),
    meetingDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    title: z.string().trim().min(3).max(500),
    fileName: z.string().trim().min(1).max(500),
    fileUrl: z.string().url().max(1000),
    commitments: z.array(z.object({
      title: z.string().trim().min(3).max(500),
      ownerName: z.string().trim().max(200).optional(),
      dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      notes: z.string().trim().max(5000).optional(),
    })).max(50).default([]),
  })).mutation(async ({ input, ctx }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "El registro documental v2 está habilitado sólo para el piloto Tanner" });
    const source = await getExecutiveProjectSource(input.projectId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
    const minuteId = await createExecutiveMeetingMinute({
      projectId: input.projectId,
      sourceId: source.id,
      meetingDate: input.meetingDate,
      isoWeek: isoWeekFromDate(input.meetingDate),
      title: input.title,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      reviewStatus: "received",
      uploadedBy: ctx.user.id,
      uploadedByName: ctx.user.name ?? null,
    });
    const commitmentIds = await Promise.all(input.commitments.map((commitment) => createExecutiveCommitment({
      projectId: input.projectId,
      minuteId,
      title: commitment.title,
      ownerName: commitment.ownerName ?? null,
      dueDate: commitment.dueDate ?? null,
      notes: commitment.notes ?? null,
      commitmentStatus: "open",
    })));
    await audit(ctx, "executive_minute_recorded", "executive_meeting_minute", minuteId, input.title, { projectId: input.projectId, sourceId: source.id, commitments: commitmentIds.length });
    return { minuteId, commitmentIds, isoWeek: isoWeekFromDate(input.meetingDate) };
  }),

  /** El acta es la única evidencia que puede incorporar un hito al avance cardinal. */
  recordExecutiveMilestoneAcceptance: adminOrPmo.input(z.object({
    projectId: z.number(),
    milestoneId: z.number(),
    acceptedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    evidenceFileName: z.string().trim().min(1).max(500),
    evidenceUrl: z.string().url().max(1000),
    evidenceSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    notes: z.string().trim().max(10000).optional(),
  })).mutation(async ({ input, ctx }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "Las actas v2 están habilitadas sólo para el piloto Tanner" });
    const source = await getExecutiveProjectSource(input.projectId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
    const milestones = await getExecutiveContractMilestones(input.projectId, source.id);
    const acceptances = await getExecutiveMilestoneAcceptances(input.projectId, source.id);
    const milestone = milestones.find((item) => item.id === input.milestoneId);
    const eligibility = assessMilestoneAcceptanceEligibility({
      milestoneExists: Boolean(milestone),
      alreadyAccepted: acceptances.some((acceptance) => acceptance.milestoneId === input.milestoneId && acceptance.acceptanceStatus === "accepted"),
      evidenceUrl: input.evidenceUrl,
      evidenceFileName: input.evidenceFileName,
    });
    if (!eligibility.allowed) throw new TRPCError({ code: "BAD_REQUEST", message: eligibility.reason });
    const id = await createExecutiveMilestoneAcceptance({
      ...input,
      sourceId: source.id,
      acceptanceStatus: "accepted",
      evidenceSha256: input.evidenceSha256 ?? null,
      notes: input.notes ?? null,
      recordedBy: ctx.user.id,
      recordedByName: ctx.user.name ?? null,
    });
    await audit(ctx, "executive_milestone_accepted", "executive_milestone_acceptance", id, milestone?.milestoneCode ?? null, { projectId: input.projectId, sourceId: source.id, milestoneId: input.milestoneId, acceptedAt: input.acceptedAt, evidenceUrl: input.evidenceUrl });
    return { id, milestoneId: input.milestoneId, acceptanceStatus: "accepted" as const };
  }),

  /** Exigencias ejecutivas: sólo Admin/PMO crea y cierra con evidencia; Delivery asignado puede anular con motivo. */
  createExecutiveRequirement: adminOrPmo.input(z.object({
    projectId: z.number(),
    requirementCode: z.string().trim().min(3).max(50),
    priority: z.enum(["P0", "P1", "P2"]),
    title: z.string().trim().min(3).max(500),
    rationale: z.string().trim().min(3).max(10000),
    ownerName: z.string().trim().min(2).max(200),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    acceptanceCriteria: z.string().trim().min(3).max(10000),
    consequence: z.string().trim().min(3).max(10000),
  })).mutation(async ({ input, ctx }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "Las exigencias v2 están habilitadas sólo para el piloto Tanner" });
    const source = await getExecutiveProjectSource(input.projectId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
    const id = await createExecutiveRequirement({ ...input, sourceId: source.id, requirementStatus: "open" });
    await audit(ctx, "executive_requirement_created", "executive_requirement", id, input.title, { projectId: input.projectId, sourceId: source.id, priority: input.priority, requirementCode: input.requirementCode });
    return { id };
  }),

  closeExecutiveRequirement: adminOrPmo.input(z.object({
    projectId: z.number(), requirementId: z.number(), closureEvidenceUrl: z.string().url().max(1000), closureNotes: z.string().trim().max(10000).optional(),
  })).mutation(async ({ input, ctx }) => {
    const requirement = await getExecutiveRequirementById(input.requirementId);
    if (!requirement || requirement.projectId !== input.projectId) throw new TRPCError({ code: "NOT_FOUND", message: "Exigencia ejecutiva no encontrada para este proyecto" });
    if (!canCloseExecutiveRequirement({ status: requirement.requirementStatus, closureEvidenceUrl: input.closureEvidenceUrl })) throw new TRPCError({ code: "BAD_REQUEST", message: "La exigencia ya está terminal o no cuenta con evidencia de cierre válida" });
    await closeExecutiveRequirement(input.requirementId, { closedBy: ctx.user.id, closureEvidenceUrl: input.closureEvidenceUrl, closureNotes: input.closureNotes ?? null });
    await audit(ctx, "executive_requirement_closed", "executive_requirement", input.requirementId, requirement.title, { projectId: input.projectId, evidence: input.closureEvidenceUrl });
    return { id: input.requirementId, status: "closed" as const };
  }),

  waiveExecutiveRequirement: protectedProcedure.input(z.object({ projectId: z.number(), requirementId: z.number(), reason: z.string().trim().min(3).max(10000) }))
    .mutation(async ({ input, ctx }) => {
      const requirement = await getExecutiveRequirementById(input.requirementId);
      if (!requirement || requirement.projectId !== input.projectId) throw new TRPCError({ code: "NOT_FOUND", message: "Exigencia ejecutiva no encontrada para este proyecto" });
      const assignments = await getExecutiveGovernanceAssignments(input.projectId, requirement.sourceId ?? undefined);
      const isAssignedDeliveryManager = assignments.some((assignment) => assignment.active && assignment.governanceRole === "delivery_manager" && assignment.userId === ctx.user.id);
      if (!canWaiveExecutiveRequirement({ status: requirement.requirementStatus, isAssignedDeliveryManager, reason: input.reason })) throw new TRPCError({ code: "FORBIDDEN", message: "Sólo el Gerente de Delivery asignado puede anular una exigencia abierta con un motivo explícito" });
      await waiveExecutiveRequirement(input.requirementId, { waivedBy: ctx.user.id, waiverReason: input.reason });
      await audit(ctx, "executive_requirement_waived", "executive_requirement", input.requirementId, requirement.title, { projectId: input.projectId, reason: input.reason });
      return { id: input.requirementId, status: "waived" as const };
    }),

  /** El PRD queda en borrador hasta que el Gerente de Delivery asignado aprueba una versión evidenciada. */
  recordExecutiveRecoveryPlan: adminOrPmo.input(z.object({
    projectId: z.number(),
    version: z.string().trim().min(1).max(50),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    fileName: z.string().trim().min(1).max(500),
    fileUrl: z.string().url().max(1000),
    fileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    summary: z.string().trim().min(3).max(10000),
  })).mutation(async ({ input, ctx }) => {
    if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) throw new TRPCError({ code: "FORBIDDEN", message: "El PRD v2 está habilitado sólo para el piloto Tanner" });
    const source = await getExecutiveProjectSource(input.projectId);
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
    const id = await createExecutiveRecoveryPlan({ ...input, sourceId: source.id, recoveryStatus: "draft", fileSha256: input.fileSha256 ?? null });
    await audit(ctx, "executive_recovery_plan_recorded", "executive_recovery_plan", id, `PRD ${input.version}`, { projectId: input.projectId, sourceId: source.id, dueDate: input.dueDate });
    return { id, status: "draft" as const };
  }),

  approveExecutiveRecoveryPlan: protectedProcedure.input(z.object({ projectId: z.number(), planId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const plan = await getExecutiveRecoveryPlanById(input.planId);
      if (!plan || plan.projectId !== input.projectId) throw new TRPCError({ code: "NOT_FOUND", message: "PRD no encontrado para este proyecto" });
      const assignments = await getExecutiveGovernanceAssignments(input.projectId, plan.sourceId ?? undefined);
      const isAssignedDeliveryManager = assignments.some((assignment) => assignment.active && assignment.governanceRole === "delivery_manager" && assignment.userId === ctx.user.id);
      if (!canApproveExecutiveRecoveryPlan({ status: plan.recoveryStatus, isAssignedDeliveryManager, fileUrl: plan.fileUrl, dueDate: plan.dueDate })) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sólo el Gerente de Delivery asignado puede aprobar un PRD en borrador con evidencia y fecha registradas" });
      }
      await approveExecutiveRecoveryPlan({ id: plan.id, projectId: input.projectId, sourceId: plan.sourceId, approvedBy: ctx.user.id, approvedByName: ctx.user.name ?? null });
      await audit(ctx, "executive_recovery_plan_approved", "executive_recovery_plan", plan.id, `PRD ${plan.version}`, { projectId: input.projectId, sourceId: plan.sourceId });
      return { id: plan.id, status: "vigente" as const };
    }),

  /** Un análisis de IA permanece como observación hasta que PMO/Admin lo valide o rechace explícitamente. */
  reviewAgenticExecutiveVerdict: adminOrPmo.input(z.object({
    projectId: z.number(),
    verdictId: z.number(),
    reviewStatus: z.enum(["VALIDATED", "REJECTED"]),
    reviewNote: z.string().trim().min(3).max(10000),
  })).mutation(async ({ input, ctx }) => {
    const { analysis, review } = await getLatestPMAnalysisWithReview(input.projectId);
    const eligibility = assessVerdictReviewEligibility({
      pilotEnabled: isExecutiveDashboardV2PilotEnabled(input.projectId),
      currentAnalysisId: analysis?.id,
      requestedVerdictId: input.verdictId,
      currentReviewStatus: review?.reviewStatus as "PENDING" | "VALIDATED" | "REJECTED" | undefined,
    });
    if (!eligibility.allowed) {
      const errorMap = {
        PILOT_DISABLED: { code: "FORBIDDEN" as const, message: "La revisión ejecutiva v2 está habilitada sólo para el piloto Tanner" },
        STALE_VERDICT: { code: "NOT_FOUND" as const, message: "El veredicto agéntico indicado no corresponde a la observación vigente del proyecto" },
        ALREADY_REVIEWED: { code: "BAD_REQUEST" as const, message: "El veredicto ya fue revisado y no puede modificarse" },
      };
      throw new TRPCError(errorMap[eligibility.code]);
    }
    if (!review) {
      await createExecutiveVerdictReview({ projectId: input.projectId, verdictId: input.verdictId, reviewStatus: "PENDING" });
    }
    try {
      const reviewed = await reviewExecutiveVerdict({
        projectId: input.projectId,
        verdictId: input.verdictId,
        reviewStatus: input.reviewStatus,
        reviewNote: input.reviewNote,
        reviewedBy: ctx.user.id,
        reviewedByName: ctx.user.name ?? null,
      });
      await audit(ctx, "executive_agentic_verdict_reviewed", "executive_verdict", input.verdictId, "Revisión de veredicto agéntico", { projectId: input.projectId, reviewStatus: input.reviewStatus });
      return reviewed;
    } catch (error) {
      throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "No fue posible revisar el veredicto" });
    }
  }),

  /** Dashboard Ejecutivo v2: baseline SoW contractual + evidencia operativa Jira */
  getExecutiveDashboardV2: protectedProcedure.input(z.object({ projectId: z.number(), cutoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
    .query(async ({ input }) => {
      if (!isExecutiveDashboardV2PilotEnabled(input.projectId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Dashboard Ejecutivo v2 disponible sólo para el piloto Tanner aprobado" });
      }
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      const source = await getExecutiveProjectSource(input.projectId);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "El proyecto no tiene un baseline ejecutivo aprobado" });
      const milestones = await getExecutiveContractMilestones(input.projectId, source.id);
      const [acceptances, minutes, commitments, requirements, recoveryPlan, recoveryPlans, assignments, persistedFinancialSnapshot, persistedDashboardSnapshot, agenticVerdict] = await Promise.all([
        getExecutiveMilestoneAcceptances(input.projectId, source.id),
        getExecutiveMeetingMinutes(input.projectId, source.id),
        getExecutiveCommitments(input.projectId),
        getExecutiveRequirements(input.projectId, source.id),
        getLatestExecutiveRecoveryPlan(input.projectId, source.id),
        getExecutiveRecoveryPlans(input.projectId, source.id),
        getExecutiveGovernanceAssignments(input.projectId, source.id),
        getLatestExecutiveFinancialSnapshot(input.projectId, source.id),
        getLatestExecutiveProductionDashboardSnapshot(input.projectId, source.id),
        getLatestPMAnalysisWithReview(input.projectId),
      ]);
      const cutoff = resolveExecutiveDashboardCutoff({ projectId: input.projectId, requestedCutoffDate: input.cutoffDate, productionSnapshot: persistedDashboardSnapshot });
      const cutoffDate = cutoff.date;
      const acceptanceByMilestone = new Map<number, (typeof acceptances)[number]>();
      for (const acceptance of acceptances) {
        if (!acceptanceByMilestone.has(acceptance.milestoneId)) acceptanceByMilestone.set(acceptance.milestoneId, acceptance);
      }
      const [financialEvidenceResult, jiraEvidenceResult] = await Promise.all([
        resolveExternalEvidence({
          source: "finanzas",
          load: async () => {
            const { getFinancialDataForDeal } = await import("./financialDataFetcher");
            return getFinancialDataForDeal(source.dealId);
          },
        }),
        source.jiraProjectKey
          ? resolveExternalEvidence({ source: "Jira", load: () => getJiraAdvanceReport(source.jiraProjectKey!) })
          : Promise.resolve({ availability: "unavailable" as const, value: null, observedAt: null, reason: "source_error" as const }),
      ]);
      const financial = financialEvidenceResult.value as any;
      const jiraOperationalReport = jiraEvidenceResult.value;
      const jiraMilestoneByKey = new Map((jiraOperationalReport?.milestones ?? []).map((issue) => [issue.key, issue]));
      const operationalEvidence = {
        ...buildExecutiveOperationalEvidence(jiraOperationalReport, jiraEvidenceResult.observedAt),
        availability: jiraEvidenceResult.availability,
        retrievalReason: jiraEvidenceResult.reason,
      };
      const financialSnapshot = financial?.projectFinancial ?? null;
      const latestFinancial = persistedFinancialSnapshot?.financialData ?? financialSnapshot;
      const cutoffMs = Date.parse(`${cutoffDate}T00:00:00Z`);
      const overdueP0Requirements = requirements.filter((requirement) =>
        requirement.priority === "P0" && requirement.requirementStatus !== "closed" && requirement.requirementStatus !== "waived" && Date.parse(`${requirement.dueDate}T00:00:00Z`) < cutoffMs
      ).length;
      const closedCommitments = commitments.filter((commitment) => commitment.commitmentStatus === "fulfilled").length;
      const commitmentCompliancePct = commitments.length ? (closedCommitments / commitments.length) * 100 : null;
      const minutesCoverage = calculateExecutiveMinutesCoverage({
        baselineApprovedAt: source.approvedAt,
        cutoffDate,
        minutes: minutes.map((minute) => ({ isoWeek: minute.isoWeek, reviewStatus: minute.reviewStatus })),
      });
      const milestoneEvidence = milestones.map((milestone) => {
        const acceptance = acceptanceByMilestone.get(milestone.id);
        const jiraMilestone = jiraMilestoneByKey.get(milestone.jiraIssueKey);
        const jiraDueDate = jiraMilestone?.duedate ?? milestone.jiraDueDate;
        const jiraClosedDate = jiraMilestone?.resolutiondate?.slice(0, 10) ?? null;
        const acceptedAt = acceptance?.acceptanceStatus === "accepted" ? acceptance.acceptedAt : null;
        const acceptanceEvidenceUrl = acceptance?.acceptanceStatus === "accepted" ? acceptance.evidenceUrl : null;
        return {
          id: milestone.id,
          code: milestone.milestoneCode,
          milestoneCode: milestone.milestoneCode,
          title: milestone.title,
          baselineDate: milestone.baselineDate,
          committedDate: jiraDueDate,
          jiraIssueKey: milestone.jiraIssueKey,
          jiraDueDate,
          jiraClosedDate,
          jiraStatusName: jiraMilestone?.status ?? milestone.jiraStatusName,
          semanticStatus: milestone.semanticStatus,
          isCritical: milestone.isCritical,
          billingWeight: milestone.billingWeight,
          acceptedAt,
          acceptanceEvidenceUrl,
          acceptanceFileName: acceptance?.acceptanceStatus === "accepted" ? acceptance.evidenceFileName : null,
          acceptanceStatus: acceptance?.acceptanceStatus ?? "unverified",
          timeline: classifyMilestoneTimeline({ jiraDueDate, jiraClosedDate, acceptanceDate: acceptedAt, acceptanceEvidenceUrl, today: cutoffDate }),
        };
      });
      const governance = calculateExecutiveGovernance({
        cutoffDate,
        milestones: milestoneEvidence,
        financial: {
          budgetCostUf: latestFinancial?.presupuestoUF ?? null,
          executedCostUf: latestFinancial?.utilizadoUF ?? null,
          saleValueUf: latestFinancial?.valorVentaUF ?? null,
          targetMarginUf: latestFinancial?.margenBrutoNotaVentaUF ?? null,
          projectedMarginUf: latestFinancial?.margenProyectadoUF ?? null,
          annualWacc: latestFinancial?.annualWacc ?? null,
          blockedHeadcount: latestFinancial?.blockedHeadcount ?? null,
          dailyRateUf: latestFinancial?.dailyRateUf ?? null,
          blockedDays: latestFinancial?.blockedDays ?? null,
          penaltyUf: latestFinancial?.penaltyUf ?? null,
        },
        governance: {
          minutesCoveragePct: minutesCoverage.coveragePct,
          commitmentCompliancePct,
          hasValidRecoveryPlan: recoveryPlan ? Boolean(recoveryPlan.approvedAt && recoveryPlan.fileUrl) : null,
          consecutiveMinutesGap: minutesCoverage.consecutiveGapWeeks,
          overdueP0Requirements,
          recoveryPlanRequired: false,
          recoveryPlanOverdue: false,
          consecutiveRedVerdicts: 0,
        },
        operational: {
          // Jira sólo revela sesgo y penalizaciones; nunca puede elevar el estado contractual.
          jiraProgressPct: operationalEvidence.issueProgressPct,
          backlogConfidencePct: null,
        },
      });
      return {
        project: { id: project.id, name: project.projectName, client: (project as any).clientName || "" },
        source: {
          dealId: source.dealId, jiraProjectKey: source.jiraProjectKey, baselineVersion: source.baselineVersion,
          contractFileName: source.contractFileName, contractFileUrl: source.contractFileUrl,
          sourceStatus: source.sourceStatus, approvedAt: source.approvedAt,
        },
        cutoff,
        contractual: {
          ...governance.contractual,
          // Compatibilidad temporal: estos campos ya se derivan de cardinalidad, no de pesos comerciales.
          progressPct: governance.contractual.chcG ?? 0,
          fulfilledWeight: governance.contractual.acceptedCount,
          totalWeight: governance.contractual.totalMilestones,
          delayedCount: governance.contractual.openOverdueCount,
          overduePendingCount: 0,
          semaphore: governance.governance.state === "CRITICO" || governance.governance.state === "ROJO"
            ? "ROJO"
            : governance.governance.state === "NARANJO" || governance.governance.state === "AMARILLO"
              ? "AMARILLO"
              : "VERDE",
          milestones: milestoneEvidence,
        },
        commercialExposure: governance.exposure,
        financial: latestFinancial,
        financialEvidence: buildExecutiveFinancialEvidence({
          persistedSnapshot: persistedFinancialSnapshot,
          syncedFinancial: financialSnapshot,
          impact: governance.financial,
        }),
        governance: { ...governance.governance, assignments, recoveryPlan, recoveryPlans, requirements, commitments, minutes, minutesCoverage },
        agenticVerdict,
        operationalEvidence,
        financialAlerts: financial?.alerts ?? [],
        financialContext: financial?.portfolioContext ?? null,
      };
    }),

  /** Generate AI executive verdict combining JIRA + Financial data */
  generateLinkedVerdict: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      const space = await getJiraSpaceByProject(input.projectId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado" });
      const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
      if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la key" });

      const jiraReport = await getJiraAdvanceReport(projectKey);
      const { getFinancialDataForDeal, extractDealId } = await import("./financialDataFetcher");
      const dealId = extractDealId(project.projectName) || "";
      let financialData = null;
      try {
        if (dealId) {
          financialData = await getFinancialDataForDeal(dealId);
        }
      } catch { /* ignore */ }

      // ── Resolve SoW and Gantt documents ──
      const isLinked = (project as any).origin === "linked";
      let sowContent = "";
      let ganttContent = "";
      let sowFileName = "";
      let ganttFileName = "";

      if (isLinked) {
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        const sowDoc = linkedDocs.filter(d => d.docType === "sow").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const ganttDoc = linkedDocs.filter(d => d.docType === "gantt").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (sowDoc?.fileUrl) {
          sowFileName = sowDoc.fileName;
          try { sowContent = await extractSowContent(sowDoc.fileUrl, sowDoc.fileName, project.projectName); } catch (e) {
            console.error("[Verdict] Error extracting SoW:", e);
            sowContent = `[Archivo SoW disponible: ${sowDoc.fileName}, pero no se pudo extraer]`;
          }
        }
        if (ganttDoc?.fileUrl) {
          ganttFileName = ganttDoc.fileName;
          try { ganttContent = await extractGanttContent(ganttDoc.fileUrl, ganttDoc.fileName, project.projectName); } catch (e) {
            console.error("[Verdict] Error extracting Gantt:", e);
            ganttContent = `[Archivo Gantt disponible: ${ganttDoc.fileName}, pero no se pudo extraer]`;
          }
        }
      } else {
        // Platform project: use structured SoW data
        const sowData = await getSowByProject(input.projectId);
        if (sowData) {
          const objectives = (sowData.specificObjectives as any[]) || [];
          const deliverables = (sowData.deliverables as any[]) || [];
          const milestones = (sowData.milestones as any[]) || [];
          sowContent = `SoW ESTRUCTURADO - ${project.projectName}\nObjetivo: ${sowData.generalObjective || "N/D"}\nObjetivos Específicos: ${objectives.map((o: any, i: number) => `${i + 1}. ${typeof o === "string" ? o : o.text || JSON.stringify(o)}`).join("; ")}\nEntregables: ${deliverables.map((d: any, i: number) => `${i + 1}. ${typeof d === "string" ? d : d.text || d.name || JSON.stringify(d)}`).join("; ")}\nHitos: ${milestones.map((m: any, i: number) => `${i + 1}. ${typeof m === "string" ? m : m.name || m.description || JSON.stringify(m)}`).join("; ")}\nMonto: ${sowData.totalAmount || "N/D"} ${sowData.currency || ""}`;
          sowFileName = "SoW estructurado (plataforma)";
        } else {
          const sowVersions = await getSowVersionsByProject(input.projectId);
          if (sowVersions[0]?.url) {
            sowFileName = sowVersions[0].fileName;
            try { sowContent = await extractSowContent(sowVersions[0].url, sowVersions[0].fileName, project.projectName); } catch { /* ignore */ }
          }
        }
        // Gantt from platform
        const ganttUpload = await getLatestGanttUpload(input.projectId);
        if (ganttUpload?.fileUrl) {
          ganttFileName = ganttUpload.fileName;
          try { ganttContent = await extractGanttContent(ganttUpload.fileUrl, ganttUpload.fileName, project.projectName); } catch { /* ignore */ }
        } else {
          const wbsTasks = await getWbsByProject(input.projectId);
          if (wbsTasks && wbsTasks.length > 0) {
            ganttFileName = "WBS estructurado (plataforma)";
            ganttContent = `PLANIFICACIÓN WBS - ${wbsTasks.length} tareas\n` + wbsTasks.slice(0, 30).map(t => `  ${t.taskCode} ${t.taskName} [${t.phase}] ${t.isCritical ? "CRITICO" : ""}`).join("\n");
          }
        }
      }
      // Fallback: check linked_project_documents for platform projects too
      if (!sowContent || !ganttContent) {
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        if (!sowContent) {
          const sowDoc = linkedDocs.filter(d => d.docType === "sow")[0];
          if (sowDoc?.fileUrl) {
            sowFileName = sowDoc.fileName;
            try { sowContent = await extractSowContent(sowDoc.fileUrl, sowDoc.fileName, project.projectName); } catch { /* ignore */ }
          }
        }
        if (!ganttContent) {
          const ganttDoc = linkedDocs.filter(d => d.docType === "gantt")[0];
          if (ganttDoc?.fileUrl) {
            ganttFileName = ganttDoc.fileName;
            try { ganttContent = await extractGanttContent(ganttDoc.fileUrl, ganttDoc.fileName, project.projectName); } catch { /* ignore */ }
          }
        }
      }

      const fin = financialData?.projectFinancial;
      const finSection = fin ? `\nDatos Financieros (Hoja Artefactos_proyectos):\n- Estado: ${fin.estadoProyecto}\n- Valor Venta: ${fin.valorVentaUF ?? "N/A"} UF\n- Presupuesto: ${fin.presupuestoUF ?? "N/A"} UF\n- Utilizado: ${fin.utilizadoUF ?? "N/A"} UF (${fin.utilizadoUFPorc ? (fin.utilizadoUFPorc * 100).toFixed(1) + "%" : "N/A"} del presupuesto)\n- Margen Bruto Nota Venta: ${fin.margenBrutoNotaVentaUF ?? "N/A"} UF\n- Costo Proyectado: ${fin.costoProyectadoUF ?? "N/A"} UF\n- Margen Proyectado: ${fin.margenProyectadoUF ?? "N/A"} UF (${fin.margenProyectadoPorc ? (fin.margenProyectadoPorc * 100).toFixed(1) + "%" : "N/A"})\n- Margen Target P&L: ${fin.margenTargetPorc ? (fin.margenTargetPorc * 100).toFixed(1) + "%" : "N/A"}\n- Capacity Utilizado: ${fin.capacityU ?? "N/A"} UF\n- Capacity Planificado: ${fin.planificadoUF ?? "N/A"} UF\n- Capacity Proyectado Total: ${fin.proyectadoUF ?? "N/A"} UF\n- Margen según Capacity: ${fin.margenProyectadoSegunCapacity ? (fin.margenProyectadoSegunCapacity * 100).toFixed(1) + "%" : "N/A"}\n- Avance: ${fin.porcentajeAvanceProyecto ? (fin.porcentajeAvanceProyecto * 100).toFixed(0) + "%" : "N/A"}\n- Alertas: ${financialData?.alerts?.map((a: any) => `[${a.type.toUpperCase()}] ${a.title}`).join(", ") || "Ninguna"}\n- Notas: ${fin.notas || "Sin notas"}\n` : "\nDatos financieros no disponibles (Deal ID no encontrado en planilla).\n";

      const portfolioSection = financialData?.portfolioContext ? `\nContexto Portafolio:\n- Margen promedio portafolio: ${(financialData.portfolioContext.avgMargenProyectadoPorc * 100).toFixed(1)}%\n- Margen target promedio: ${(financialData.portfolioContext.avgMargenTargetPorc * 100).toFixed(1)}%\n- Ranking: ${financialData.portfolioContext.projectRank || "N/A"} de ${financialData.portfolioContext.totalActiveProjects} proyectos activos\n` : "";

      // Build SoW and Gantt sections for the prompt
      const sowSection = sowContent
        ? `\n${"-".repeat(60)}\nSTATEMENT OF WORK (SoW)${sowFileName ? ` — Fuente: ${sowFileName}` : ""}:\n${sowContent.substring(0, 8000)}\n`
        : "\n[No hay SoW disponible para este proyecto. El análisis se basa solo en datos JIRA y financieros.]\n";

      const ganttSection = ganttContent
        ? `\n${"-".repeat(60)}\nPLANIFICACIÓN / GANTT${ganttFileName ? ` — Fuente: ${ganttFileName}` : ""}:\n${ganttContent.substring(0, 8000)}\n`
        : "\n[No hay Gantt/planificación disponible para este proyecto.]\n";

      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Eres un Gerente Senior de Proyectos PMO de Prodigio Tech con experiencia en comités ejecutivos. Genera un veredicto ejecutivo integral combinando datos de JIRA, financieros, SoW (promesa al cliente) y Gantt (planificación).

IMPORTANTE: Cada perspectiva por rol debe contener 2-4 bullets concretos con datos numéricos reales del proyecto. Usa los datos proporcionados, NO inventes números. Si un dato no está disponible, indica "sin datos disponibles".

Si hay SoW disponible, evalúa el cumplimiento de la promesa al cliente: ¿se están entregando los entregables comprometidos? ¿los hitos van en línea?
Si hay Gantt disponible, evalúa el cumplimiento del cronograma: ¿hay retrasos? ¿las fases van según lo planificado?

Para el CTO: enfócate en ejecución técnica, cumplimiento de entregables del SoW, hitos entregados vs planificados en Gantt, riesgos técnicos, capacity del equipo, modelo de entrega.
Para el CFO: enfócate en márgenes, presupuesto consumido vs. planificado, costo proyectado, desviaciones financieras, oportunidades de ahorro, cumplimiento de hitos de facturación.
Para el Director Comercial: enfócate en creación de valor al cliente, cumplimiento de la promesa comercial (SoW), relación con el cliente, oportunidades de upsell/cross-sell, casos de éxito replicables.

Cada bullet debe incluir un tag de contexto entre corchetes al inicio: [Fortaleza], [Oportunidad], [Riesgo], [Acción], [Dato Clave], [Modelo Replicable], [Alerta].

Responde SOLO con JSON válido.` },
          { role: "user", content: `Proyecto: ${project.projectName} (${projectKey})\nDeal: ${dealId}\nCliente: ${(project as any).clientName || "N/A"}
${sowSection}${ganttSection}
${"-".repeat(60)}\nDatos JIRA:\n- Issues totales: ${jiraReport.totalIssues}\n- Finalizados: ${jiraReport.doneCount} (${jiraReport.percentComplete}%)\n- En progreso: ${jiraReport.inProgressCount}\n- Pendientes: ${jiraReport.toDoCount}\n- Épicas: ${jiraReport.epics.length} (${jiraReport.epics.filter((e: any) => e.statusCategory === "Done").length} finalizadas)\n- Hitos: ${jiraReport.milestones.length} (${jiraReport.milestonesCumplidos} cumplidos de ${jiraReport.milestones.length})\n- Riesgos registrados: ${jiraReport.risks.length} (${jiraReport.risks.filter((r: any) => r.priority === "Highest" || r.priority === "High").length} de prioridad alta)\n- Equipo: ${jiraReport.team.length} miembros\n${finSection}${portfolioSection}\nResponde SOLO con JSON con esta estructura EXACTA:\n{\n  "overallVerdict": "Párrafo de 4-6 líneas con veredicto ejecutivo integral que sintetice el estado del proyecto, incluyendo cumplimiento de SoW y Gantt si están disponibles",\n  "semaphore": "VERDE|AMARILLO|ROJO",\n  "semaphoreJustification": "Justificación breve del semáforo en 1-2 líneas",\n  "ctoInsights": {\n    "title": "Título breve de la perspectiva CTO (ej: Ejecución Técnica Sólida)",\n    "bullets": [\n      "[Tag] Bullet con dato concreto y numérico",\n      "[Tag] Segundo bullet con insight técnico",\n      "[Tag] Tercer bullet con acción o modelo"\n    ]\n  },\n  "cfoInsights": {\n    "title": "Título breve de la perspectiva CFO (ej: Resultado Financiero Superior)",\n    "bullets": [\n      "[Tag] Bullet con dato financiero concreto",\n      "[Tag] Segundo bullet con análisis de márgenes",\n      "[Tag] Tercer bullet con acción financiera"\n    ]\n  },\n  "commercialInsights": {\n    "title": "Título breve de la perspectiva Comercial (ej: Palanca de Crecimiento)",\n    "bullets": [\n      "[Tag] Bullet con insight comercial",\n      "[Tag] Segundo bullet sobre relación con cliente",\n      "[Tag] Tercer bullet con oportunidad"\n    ]\n  },\n  "keyRisks": [{ "risk": "Descripción del riesgo", "impact": "ALTO|MEDIO|BAJO", "mitigation": "Acción de mitigación" }],\n  "recommendations": [{ "title": "Título", "description": "Descripción con acción concreta", "priority": "URGENTE|ALTA|MEDIA" }]\n}` },
        ],
        response_format: { type: "json_object" } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const contentStr = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent || "{}");
      const parsed = JSON.parse(contentStr);

      // Parse role insights into structured format for DB storage
      const parseCtoInsights = parsed.ctoInsights?.bullets?.map((b: string) => {
        const match = b.match(/^\[([^\]]+)\]\s*(.*)/);
        return match ? { tag: match[1], text: match[2] } : { tag: "Dato Clave", text: b };
      }) ?? [];
      const parseCfoInsights = parsed.cfoInsights?.bullets?.map((b: string) => {
        const match = b.match(/^\[([^\]]+)\]\s*(.*)/);
        return match ? { tag: match[1], text: match[2] } : { tag: "Dato Clave", text: b };
      }) ?? [];
      const parseCommInsights = parsed.commercialInsights?.bullets?.map((b: string) => {
        const match = b.match(/^\[([^\]]+)\]\s*(.*)/);
        return match ? { tag: match[1], text: match[2] } : { tag: "Dato Clave", text: b };
      }) ?? [];

      // Build metrics snapshot for historical comparison
      const metricsSnapshot = {
        jiraAdvance: jiraReport.percentComplete,
        clientMilestoneCompletion: jiraReport.milestoneCompletionPct,
        primaryProgressPct: jiraReport.primaryProgressPct,
        primaryProgressSource: jiraReport.primaryProgressSource,
        totalIssues: jiraReport.totalIssues,
        doneCount: jiraReport.doneCount,
        milestonesTotal: jiraReport.milestones.length,
        milestonesCumplidos: jiraReport.milestonesCumplidos,
        epicsTotal: jiraReport.epics.length,
        epicsDone: jiraReport.epics.filter((e: any) => e.statusCategory === "Done").length,
        teamSize: jiraReport.team.length,
        risksCount: jiraReport.risks.length,
        valorVentaUF: fin?.valorVentaUF ?? null,
        presupuestoUF: fin?.presupuestoUF ?? null,
        utilizadoUF: fin?.utilizadoUF ?? null,
        utilizadoUFPorc: fin?.utilizadoUFPorc ?? null,
        margenProyectadoPorc: fin?.margenProyectadoPorc ?? null,
        margenTargetPorc: fin?.margenTargetPorc ?? null,
        costoProyectadoUF: fin?.costoProyectadoUF ?? null,
        hasSoW: !!sowContent,
        hasGantt: !!ganttContent,
        sowFileName: sowFileName || null,
        ganttFileName: ganttFileName || null,
      };

      // Save verdict to database
      try {
        await saveExecutiveVerdict({
          projectId: input.projectId,
          generatedBy: ctx.user.id,
          generatedByName: ctx.user.name ?? "Unknown",
          semaphore: parsed.semaphore ?? "AMARILLO",
          ctoTitle: parsed.ctoInsights?.title ?? null,
          ctoInsights: parseCtoInsights,
          cfoTitle: parsed.cfoInsights?.title ?? null,
          cfoInsights: parseCfoInsights,
          commercialTitle: parsed.commercialInsights?.title ?? null,
          commercialInsights: parseCommInsights,
          overallVerdict: parsed.overallVerdict ?? null,
          semaphoreJustification: parsed.semaphoreJustification ?? null,
          keyRisks: parsed.keyRisks?.map((r: any) => ({ level: r.impact, description: r.risk, mitigation: r.mitigation })) ?? [],
          recommendations: parsed.recommendations ?? [],
          metricsSnapshot,
        });
      } catch (saveErr) {
        console.error("[Verdict] Failed to save to DB:", saveErr);
      }

      await audit(ctx, "generate_linked_verdict", "advance", input.projectId, project.projectName, {
        hasSoW: !!sowContent, hasGantt: !!ganttContent,
      });
      return {
        success: true,
        data: parsed,
        sources: {
          sow: sowContent ? { available: true, fileName: sowFileName } : { available: false },
          gantt: ganttContent ? { available: true, fileName: ganttFileName } : { available: false },
        },
      };
    }),

  /** Get the latest saved verdict for a project */
  getLatestVerdict: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const verdict = await getLatestVerdict(input.projectId);
      if (!verdict) return null;
      // Reconstruct the format expected by the frontend
      const ctoInsights = (verdict.ctoInsights as any[]) ?? [];
      const cfoInsights = (verdict.cfoInsights as any[]) ?? [];
      const commercialInsights = (verdict.commercialInsights as any[]) ?? [];
      const keyRisks = (verdict.keyRisks as any[]) ?? [];
      const recommendations = (verdict.recommendations as any[]) ?? [];
      return {
        id: verdict.id,
        semaphore: verdict.semaphore,
        createdAt: verdict.createdAt,
        generatedByName: verdict.generatedByName,
        metricsSnapshot: verdict.metricsSnapshot,
        data: {
          overallVerdict: verdict.overallVerdict,
          semaphore: verdict.semaphore,
          semaphoreJustification: verdict.semaphoreJustification,
          ctoInsights: {
            title: verdict.ctoTitle,
            bullets: ctoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          cfoInsights: {
            title: verdict.cfoTitle,
            bullets: cfoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          commercialInsights: {
            title: verdict.commercialTitle,
            bullets: commercialInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          keyRisks: keyRisks.map((r: any) => ({ risk: r.description, impact: r.level, mitigation: r.mitigation })),
          recommendations,
        },
      };
    }),

  /** Get verdict history for a project */
  getVerdictHistory: protectedProcedure.input(z.object({ projectId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return getVerdictHistory(input.projectId, input.limit ?? 20);
    }),

  /** Get a specific verdict by ID (full detail) */
  getVerdictDetail: protectedProcedure.input(z.object({ verdictId: z.number() }))
    .query(async ({ input }) => {
      const verdict = await getVerdictById(input.verdictId);
      if (!verdict) return null;
      const ctoInsights = (verdict.ctoInsights as any[]) ?? [];
      const cfoInsights = (verdict.cfoInsights as any[]) ?? [];
      const commercialInsights = (verdict.commercialInsights as any[]) ?? [];
      const keyRisks = (verdict.keyRisks as any[]) ?? [];
      const recommendations = (verdict.recommendations as any[]) ?? [];
      return {
        id: verdict.id,
        semaphore: verdict.semaphore,
        createdAt: verdict.createdAt,
        generatedByName: verdict.generatedByName,
        metricsSnapshot: verdict.metricsSnapshot,
        data: {
          overallVerdict: verdict.overallVerdict,
          semaphore: verdict.semaphore,
          semaphoreJustification: verdict.semaphoreJustification,
          ctoInsights: {
            title: verdict.ctoTitle,
            bullets: ctoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          cfoInsights: {
            title: verdict.cfoTitle,
            bullets: cfoInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          commercialInsights: {
            title: verdict.commercialTitle,
            bullets: commercialInsights.map((i: any) => `[${i.tag}] ${i.text}`),
          },
          keyRisks: keyRisks.map((r: any) => ({ risk: r.description, impact: r.level, mitigation: r.mitigation })),
          recommendations,
        },
      };
    }),

  /** Complete the advance stage and unlock closure */
  complete: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await unlockNextStage(input.projectId, "design");
      await audit(ctx, "complete_stage", "advance", input.projectId);
      return { success: true };
    }),

  // ==================== PM SENIOR ANALYSIS (SoW + Gantt + JIRA) ====================
  /** Resolve SoW and Gantt documents for a project (linked or platform) */
  resolveProjectDocuments: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
      const isLinked = (project as any).origin === "linked";
      let sowSource: { type: string; url?: string; content?: any; fileName?: string } | null = null;
      let ganttSource: { type: string; url?: string; content?: any; fileName?: string } | null = null;

      if (isLinked) {
        // For linked projects: check linked_project_documents
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        const sowDoc = linkedDocs.filter(d => d.docType === "sow").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const ganttDoc = linkedDocs.filter(d => d.docType === "gantt").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        if (sowDoc) sowSource = { type: "linked_file", url: sowDoc.fileUrl, fileName: sowDoc.fileName };
        if (ganttDoc) ganttSource = { type: "linked_file", url: ganttDoc.fileUrl, fileName: ganttDoc.fileName };
      } else {
        // For platform projects: check sowDocuments (structured) + sowVersions (DOCX)
        const sowData = await getSowByProject(input.projectId);
        if (sowData) {
          sowSource = {
            type: "structured",
            content: {
              generalObjective: sowData.generalObjective,
              specificObjectives: sowData.specificObjectives,
              activitiesIncluded: sowData.activitiesIncluded,
              deliverables: sowData.deliverables,
              limitations: sowData.limitations,
              assumptions: sowData.assumptions,
              clientDependencies: sowData.clientDependencies,
              risks: sowData.risks,
              milestones: sowData.milestones,
              totalAmount: sowData.totalAmount,
              currency: sowData.currency,
              billingMilestones: sowData.billingMilestones,
              status: sowData.status,
            },
          };
        }
        // Also check for uploaded SoW files (sow_final or sow_source)
        if (!sowSource) {
          const sowVersions = await getSowVersionsByProject(input.projectId);
          const latestVersion = sowVersions[0];
          if (latestVersion) sowSource = { type: "sow_version", url: latestVersion.url, fileName: latestVersion.fileName };
        }
        // For Gantt: check gantt_uploads first, then uploaded_files
        const ganttUpload = await getLatestGanttUpload(input.projectId);
        if (ganttUpload) {
          ganttSource = { type: "gantt_upload", url: ganttUpload.fileUrl, fileName: ganttUpload.fileName };
        }
        // Also check WBS tasks as structured planning data
        const wbsTasks = await getWbsByProject(input.projectId);
        if (wbsTasks && wbsTasks.length > 0 && !ganttSource) {
          ganttSource = {
            type: "wbs_structured",
            content: wbsTasks.map(t => ({
              code: t.taskCode, name: t.taskName, phase: t.phase,
              level: t.issueLevel, epic: t.epicCode, isCritical: t.isCritical,
              expected: t.expected, assignee: t.assignee,
            })),
          };
        }
      }
      // Also check linked_project_documents as fallback for platform projects
      if (!sowSource || !ganttSource) {
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        if (!sowSource) {
          const sowDoc = linkedDocs.filter(d => d.docType === "sow")[0];
          if (sowDoc) sowSource = { type: "linked_file", url: sowDoc.fileUrl, fileName: sowDoc.fileName };
        }
        if (!ganttSource) {
          const ganttDoc = linkedDocs.filter(d => d.docType === "gantt")[0];
          if (ganttDoc) ganttSource = { type: "linked_file", url: ganttDoc.fileUrl, fileName: ganttDoc.fileName };
        }
      }
      return { sowSource, ganttSource, projectName: project.projectName, isLinked };
    }),

  /** Get latest persisted agentic analysis for a project */
  getLatestAgenticAnalysis: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const verdict = await getLatestPMAnalysis(input.projectId);
      if (!verdict) return { found: false as const };
      let metricsSnapshot: any = verdict.metricsSnapshot;
      if (typeof metricsSnapshot === "string") {
        try {
          metricsSnapshot = JSON.parse(metricsSnapshot);
        } catch {
          return { found: false as const };
        }
      }
      const validatedAnalysis = pmAnalysisSchema.safeParse(metricsSnapshot?.fullAnalysis);
      if (!validatedAnalysis.success) return { found: false as const };
      const createdAt = new Date(verdict.createdAt).getTime();
      const now = Date.now();
      const daysSince = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
      const isStale = daysSince >= 5;
      return {
        found: true as const,
        analysis: validatedAnalysis.data,
        sources: {
          sow: { available: !!metricsSnapshot?.hasSoW },
          gantt: { available: !!metricsSnapshot?.hasGantt },
          jira: { available: true },
        },
        createdAt: verdict.createdAt,
        daysSince,
        isStale,
        generatedByName: verdict.generatedByName,
      };
    }),

  /** Get history of agentic analyses for a project */
  getAgenticAnalysisHistory: protectedProcedure.input(z.object({ projectId: z.number(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      const history = await getPMAnalysisHistory(input.projectId, input.limit ?? 10);
      return history.map(h => ({
        ...h,
        daysSince: Math.floor((Date.now() - new Date(h.createdAt).getTime()) / (1000 * 60 * 60 * 24)),
      }));
    }),
  /** Generate Agentic Analysis crossing SoW + Gantt + JIRA data */
  generatePMAnalysis: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const project = await getProjectById(input.projectId);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });

      // 1. Resolve JIRA space and get report
      const space = await getJiraSpaceByProject(input.projectId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "No hay Space JIRA vinculado" });
      const projectKey = space.jiraProjectKey ?? space.jiraProjectId;
      if (!projectKey) throw new TRPCError({ code: "NOT_FOUND", message: "No se encontró la key JIRA" });
      const jiraReport = await getJiraAdvanceReport(projectKey);

      // 2. Resolve SoW and Gantt documents
      const isLinked = (project as any).origin === "linked";
      let sowContent = "";
      let ganttContent = "";
      let sowFileName = "";
      let ganttFileName = "";

      // Resolve SoW
      if (isLinked) {
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        const sowDoc = linkedDocs.filter(d => d.docType === "sow").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        const ganttDoc = linkedDocs.filter(d => d.docType === "gantt").sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (sowDoc?.fileUrl) {
          sowFileName = sowDoc.fileName;
          try {
            sowContent = await extractSowContent(sowDoc.fileUrl, sowDoc.fileName, project.projectName);
          } catch (e) {
            console.error("[PMAnalysis] Error extracting SoW:", e);
            sowContent = `[Archivo SoW disponible: ${sowDoc.fileName}, pero no se pudo extraer contenido automáticamente]`;
          }
        }
        if (ganttDoc?.fileUrl) {
          ganttFileName = ganttDoc.fileName;
          try {
            ganttContent = await extractGanttContent(ganttDoc.fileUrl, ganttDoc.fileName, project.projectName);
          } catch (e) {
            console.error("[PMAnalysis] Error extracting Gantt:", e);
            ganttContent = `[Archivo Gantt disponible: ${ganttDoc.fileName}, pero no se pudo extraer contenido]`;
          }
        }
      } else {
        // Platform project: use structured SoW data
        const sowData = await getSowByProject(input.projectId);
        if (sowData) {
          const objectives = (sowData.specificObjectives as any[]) || [];
          const activities = (sowData.activitiesIncluded as any[]) || [];
          const deliverables = (sowData.deliverables as any[]) || [];
          const limitations = (sowData.limitations as any[]) || [];
          const assumptions = (sowData.assumptions as any[]) || [];
          const clientDeps = (sowData.clientDependencies as any[]) || [];
          const milestones = (sowData.milestones as any[]) || [];
          const billing = (sowData.billingMilestones as any[]) || [];
          sowContent = `STATEMENT OF WORK - ${project.projectName}\n` +
            `Estado: ${sowData.status}\n` +
            `Objetivo General: ${sowData.generalObjective || "N/D"}\n` +
            `Objetivos Específicos:\n${objectives.map((o: any, i: number) => `  ${i + 1}. ${typeof o === "string" ? o : o.text || o.objective || JSON.stringify(o)}`).join("\n")}\n` +
            `Actividades Incluidas:\n${activities.map((a: any, i: number) => `  ${i + 1}. ${typeof a === "string" ? a : a.text || a.name || JSON.stringify(a)}`).join("\n")}\n` +
            `Entregables:\n${deliverables.map((d: any, i: number) => `  ${i + 1}. ${typeof d === "string" ? d : d.text || d.name || JSON.stringify(d)}`).join("\n")}\n` +
            `Limitaciones/Exclusiones:\n${limitations.map((l: any, i: number) => `  ${i + 1}. ${typeof l === "string" ? l : l.text || JSON.stringify(l)}`).join("\n")}\n` +
            `Supuestos:\n${assumptions.map((a: any, i: number) => `  ${i + 1}. ${typeof a === "string" ? a : a.text || JSON.stringify(a)}`).join("\n")}\n` +
            `Dependencias del Cliente:\n${clientDeps.map((c: any, i: number) => `  ${i + 1}. ${typeof c === "string" ? c : c.text || JSON.stringify(c)}`).join("\n")}\n` +
            `Hitos:\n${milestones.map((m: any, i: number) => `  ${i + 1}. ${typeof m === "string" ? m : m.name || m.description || JSON.stringify(m)}`).join("\n")}\n` +
            `Monto: ${sowData.totalAmount || "N/D"} ${sowData.currency || ""}\n` +
            `Hitos de Facturación:\n${billing.map((b: any, i: number) => `  ${i + 1}. ${typeof b === "string" ? b : b.description || b.name || JSON.stringify(b)}`).join("\n")}`;
          sowFileName = "SoW estructurado (plataforma)";
        } else {
          // Fallback: check sowVersions for DOCX file
          const sowVersions = await getSowVersionsByProject(input.projectId);
          if (sowVersions[0]?.url) {
            sowFileName = sowVersions[0].fileName;
            try {
              sowContent = await extractSowContent(sowVersions[0].url, sowVersions[0].fileName, project.projectName);
            } catch (e) {
              sowContent = `[Archivo SoW disponible: ${sowVersions[0].fileName}, pero no se pudo extraer]`;
            }
          }
        }
        // Resolve Gantt from platform
        const ganttUpload = await getLatestGanttUpload(input.projectId);
        if (ganttUpload?.fileUrl) {
          ganttFileName = ganttUpload.fileName;
          try {
            ganttContent = await extractGanttContent(ganttUpload.fileUrl, ganttUpload.fileName, project.projectName);
          } catch (e) {
            ganttContent = `[Archivo Gantt disponible: ${ganttUpload.fileName}, pero no se pudo extraer]`;
          }
        } else {
          // Use WBS structured data
          const wbsTasks = await getWbsByProject(input.projectId);
          if (wbsTasks && wbsTasks.length > 0) {
            ganttFileName = "WBS estructurado (plataforma)";
            const phases = Array.from(new Set(wbsTasks.map(t => t.phase)));
            ganttContent = `PLANIFICACIÓN WBS - ${project.projectName}\n` +
              `Total tareas: ${wbsTasks.length}\n` +
              `Fases: ${phases.join(", ")}\n` +
              phases.map(phase => {
                const phaseTasks = wbsTasks.filter(t => t.phase === phase);
                const epics = phaseTasks.filter(t => t.issueLevel === "epic");
                const stories = phaseTasks.filter(t => t.issueLevel === "story");
                const tasks = phaseTasks.filter(t => t.issueLevel === "task");
                const milestones = phaseTasks.filter(t => t.issueLevel === "milestone");
                return `\nFase: ${phase} (${phaseTasks.length} items)\n` +
                  (epics.length > 0 ? `  Épicas: ${epics.map(e => e.taskName).join(", ")}\n` : "") +
                  (milestones.length > 0 ? `  Hitos: ${milestones.map(m => m.taskName).join(", ")}\n` : "") +
                  `  Tareas críticas: ${phaseTasks.filter(t => t.isCritical).map(t => t.taskName).join(", ") || "Ninguna"}\n`;
              }).join("");
          }
        }
      }

      // Also check linked_project_documents as fallback
      if (!sowContent || !ganttContent) {
        const linkedDocs = await getLinkedProjectDocuments(input.projectId);
        if (!sowContent) {
          const sowDoc = linkedDocs.filter(d => d.docType === "sow")[0];
          if (sowDoc?.fileUrl) {
            sowFileName = sowDoc.fileName;
            try {
              sowContent = await extractSowContent(sowDoc.fileUrl, sowDoc.fileName, project.projectName);
            } catch { sowContent = ""; }
          }
        }
        if (!ganttContent) {
          const ganttDoc = linkedDocs.filter(d => d.docType === "gantt")[0];
          if (ganttDoc?.fileUrl) {
            ganttFileName = ganttDoc.fileName;
            try {
              ganttContent = await extractGanttContent(ganttDoc.fileUrl, ganttDoc.fileName, project.projectName);
            } catch { ganttContent = ""; }
          }
        }
      }

      // 3. Get financial data
      const { getFinancialDataForDeal, extractDealId } = await import("./financialDataFetcher");
      const dealId = extractDealId(project.projectName) || "";
      let financialData = null;
      try {
        if (dealId) financialData = await getFinancialDataForDeal(dealId);
      } catch { /* ignore */ }
      const fin = financialData?.projectFinancial;

      // 4. Build comprehensive JIRA summary
      const jiraSummary = `DATOS JIRA - ${projectKey}\n` +
        `MÉTRICA EJECUTIVA PRINCIPAL — Hitos cliente: ${jiraReport.milestonesCumplidos}/${jiraReport.milestones.length} (${jiraReport.milestoneCompletionPct}%)\n` +
        `MÉTRICA OPERATIVA SECUNDARIA — Issues totales: ${jiraReport.totalIssues} | Finalizados: ${jiraReport.doneCount} (${jiraReport.percentComplete}%) | En progreso: ${jiraReport.inProgressCount} | Pendientes: ${jiraReport.toDoCount}\n` +
        `\nÉPICAS (${jiraReport.epics.length}):\n${jiraReport.epics.map((e: any) => `  - ${e.summary} [${e.statusCategory}] ${e.totalSubtasks ? `(${e.doneSubtasks}/${e.totalSubtasks} subtareas)` : ""}`).join("\n")}\n` +
        `\nHITOS (${jiraReport.milestonesCumplidos} cumplidos de ${jiraReport.milestones.length}):\n${jiraReport.milestones.map((m: any) => `  - ${m.summary} [${m.statusCategory === "Done" ? "CUMPLIDO" : m.status}] ${m.percentage || ""}`).join("\n")}\n` +
        `\nRIESGOS (${jiraReport.risks.length}):\n${jiraReport.risks.map((r: any) => `  - ${r.summary} [${r.statusCategory === "Done" ? "Cerrado" : "Abierto"}] Prioridad: ${r.priority} ${r.assignee ? `→ ${r.assignee}` : ""}`).join("\n")}\n` +
        `\nEQUIPO (${jiraReport.team.length} miembros):\n${jiraReport.team.map((t: any) => `  - ${t.name}: ${t.total} issues (${t.done} done, ${t.inProgress} in progress)`).join("\n")}\n` +
        (jiraReport.scopeChanges?.length > 0 ? `\nCAMBIOS DE ALCANCE (${jiraReport.scopeChanges.length}):\n${jiraReport.scopeChanges.map((sc: any) => `  - ${sc.summary} [${sc.status}]`).join("\n")}\n` : "");

      const finSection = fin ? `\nDATOS FINANCIEROS:\n- Valor Venta: ${fin.valorVentaUF ?? "N/A"} UF | Presupuesto: ${fin.presupuestoUF ?? "N/A"} UF | Utilizado: ${fin.utilizadoUF ?? "N/A"} UF (${fin.utilizadoUFPorc ? (fin.utilizadoUFPorc * 100).toFixed(1) + "%" : "N/A"})\n- Margen Proyectado: ${fin.margenProyectadoUF ?? "N/A"} UF (${fin.margenProyectadoPorc ? (fin.margenProyectadoPorc * 100).toFixed(1) + "%" : "N/A"}) | Target: ${fin.margenTargetPorc ? (fin.margenTargetPorc * 100).toFixed(1) + "%" : "N/A"}\n- Avance reportado: ${fin.porcentajeAvanceProyecto ? (fin.porcentajeAvanceProyecto * 100).toFixed(0) + "%" : "N/A"}\n` : "";

      // 5. Generate PM Senior Analysis with LLM
      const response = await invokeLLM({
        messages: [
          { role: "system", content: `Eres un Gerente de Proyectos Senior con 15+ años de experiencia en proyectos de tecnología. Tu rol es analizar el estado de un proyecto cruzando la PROMESA al cliente (SoW) con la REALIDAD de ejecución (JIRA + financiero + Gantt).

Tu análisis es INTERNO, dirigido al Gerente de Proyecto (PM) del equipo. Debes ser directo, honesto y constructivo. No uses lenguaje corporativo vacío.

ENFOQUE DEL ANÁLISIS:
1. CUMPLIMIENTO DE LA PROMESA: ¿Se está cumpliendo lo que se prometió en el SoW? ¿Los entregables van en línea? ¿Los hitos se están alcanzando?
2. CREACIÓN DE VALOR AL CLIENTE: ¿El proyecto está generando el valor esperado? ¿Hay señales de satisfacción o insatisfacción?
3. AVANCE OPERATIVO: ¿El ritmo de ejecución es adecuado? ¿Hay cuellos de botella? ¿El equipo está bien dimensionado?
4. RIESGOS Y ALERTAS: ¿Qué puede salir mal? ¿Qué ya está saliendo mal?
5. RECOMENDACIONES ACCIONABLES: ¿Qué debe hacer el PM esta semana/mes?

REGLA NO NEGOCIABLE DE JERARQUÍA: el cumplimiento de hitos comprometidos con el cliente es la métrica principal de avance. El porcentaje de tareas JIRA es secundario, solo describe actividad interna y puede estar incompleto. Si los hitos están por debajo del avance de tareas, debes resaltar la brecha, evaluar el proyecto de manera estricta según los hitos y no declarar salud VERDE solo por actividad interna.

Si no hay SoW o Gantt disponible, indica que el análisis es parcial y recomienda cargar los documentos.

Responde SOLO con JSON válido.` },
          { role: "user", content: `PROYECTO: ${project.projectName} (${projectKey})
Cliente: ${(project as any).clientName || "N/A"}
Deal: ${dealId || "N/A"}

${"-".repeat(60)}
STATEMENT OF WORK (SoW)${sowFileName ? ` — Fuente: ${sowFileName}` : ""}:
${sowContent || "[No hay SoW disponible. Recomienda al PM cargar el documento en la sección de Documentos del proyecto.]"}

${"-".repeat(60)}
PLANIFICACIÓN / GANTT${ganttFileName ? ` — Fuente: ${ganttFileName}` : ""}:
${ganttContent || "[No hay Gantt/planificación disponible. Recomienda al PM cargar el cronograma.]"}

${"-".repeat(60)}
${jiraSummary}
${finSection}
${"-".repeat(60)}
Genera un análisis PM Senior con esta estructura JSON EXACTA:
{
  "executiveSummary": "Párrafo de 4-6 líneas con resumen ejecutivo del estado del proyecto, enfocado en cumplimiento de promesa y valor al cliente",
  "overallHealth": "VERDE|AMARILLO|ROJO",
  "healthJustification": "Justificación en 2-3 líneas del estado de salud",
  "clientMilestoneCompletion": {
    "total": 10,
    "closed": 2,
    "percentage": 20,
    "status": "CUMPLIDO|EN_RIESGO|ATRASADO|SIN_HITOS",
    "assessment": "Evaluación estricta del cumplimiento de hitos cliente",
    "operationalGap": "Explicación de la diferencia frente al avance de tareas JIRA"
  },
  "sowComplianceScore": 75,
  "sowCompliance": {
    "summary": "Resumen de 2-3 líneas sobre cumplimiento del SoW",
    "deliverablesStatus": [
      { "deliverable": "Nombre del entregable", "status": "CUMPLIDO|EN_PROGRESO|ATRASADO|NO_INICIADO", "detail": "Detalle breve" }
    ],
    "milestonesAlignment": "Análisis de alineamiento entre hitos SoW e hitos JIRA",
    "scopeDeviations": "Desviaciones de alcance detectadas (o 'Sin desviaciones detectadas')"
  },
  "valueDelivery": {
    "summary": "Resumen de 2-3 líneas sobre creación de valor al cliente",
    "positiveSignals": ["Señal positiva 1", "Señal positiva 2"],
    "warningSignals": ["Señal de alerta 1"],
    "clientRiskFactors": ["Factor de riesgo para el cliente 1"]
  },
  "operationalAnalysis": {
    "executionPace": "ADECUADO|LENTO|ACELERADO",
    "paceDetail": "Detalle del ritmo de ejecución con datos",
    "bottlenecks": ["Cuello de botella 1"],
    "teamAssessment": "Evaluación del equipo: dimensionamiento, carga, distribución",
    "epicProgress": [
      { "epic": "Nombre de la épica", "progress": 75, "assessment": "Evaluación breve" }
    ]
  },
  "risksAndAlerts": [
    { "type": "CRITICO|ALTO|MEDIO|BAJO", "title": "Título del riesgo", "description": "Descripción", "recommendation": "Acción recomendada" }
  ],
  "weeklyActions": [
    { "priority": "URGENTE|ALTA|MEDIA", "action": "Acción concreta para el PM", "rationale": "Por qué es importante" }
  ],
  "monthlyActions": [
    { "priority": "ALTA|MEDIA", "action": "Acción de mediano plazo", "rationale": "Por qué" }
  ],
  "documentGaps": ["Documento faltante o desactualizado 1"]
}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pm_senior_analysis",
            strict: true,
            schema: pmAnalysisJsonSchema,
          },
        } as any,
      });

      const rawContent = response.choices?.[0]?.message?.content;
      const parsedResult = validatePMAnalysisOutput(rawContent);
      if (!parsedResult.success) {
        await audit(ctx, "generate_pm_analysis_invalid", "advance", input.projectId, project.projectName, {
          hasSoW: !!sowContent,
          hasGantt: !!ganttContent,
          reason: "LLM response failed PM analysis schema validation",
          validationIssues: parsedResult.error.issues.slice(0, 8).map(issue => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "La IA devolvió un análisis incompleto. No se guardó ningún veredicto; inténtalo nuevamente.",
        });
      }
      const parsed = parsedResult.data;

      // Save as executive verdict for history
      try {
        const verdictId = await saveExecutiveVerdict({
          projectId: input.projectId,
          generatedBy: ctx.user.id,
          generatedByName: ctx.user.name ?? "Unknown",
          semaphore: parsed.overallHealth ?? "AMARILLO",
          ctoTitle: "Análisis Agéntico",
          ctoInsights: [{ tag: "PM Analysis", text: parsed.executiveSummary || "" }],
          cfoTitle: null,
          cfoInsights: [],
          commercialTitle: null,
          commercialInsights: [],
          overallVerdict: parsed.executiveSummary ?? null,
          semaphoreJustification: parsed.healthJustification ?? null,
          keyRisks: (parsed.risksAndAlerts || []).map((r: any) => ({ level: r.type, description: r.title, mitigation: r.recommendation })),
          recommendations: (parsed.weeklyActions || []).map((a: any) => ({ title: a.action, description: a.rationale, priority: a.priority })),
          metricsSnapshot: {
            type: "pm_analysis",
            jiraAdvance: jiraReport.percentComplete,
            totalIssues: jiraReport.totalIssues,
            doneCount: jiraReport.doneCount,
            sowComplianceScore: parsed.sowComplianceScore ?? null,
            hasSoW: !!sowContent,
            hasGantt: !!ganttContent,
            fullAnalysis: parsed,
          },
        });
        if (verdictId) {
          await createExecutiveVerdictReview({
            projectId: input.projectId,
            verdictId,
            reviewStatus: "PENDING",
          });
        }
      } catch (saveErr) {
        console.error("[PMAnalysis] Failed to save verdict:", saveErr);
      }

      await audit(ctx, "generate_pm_analysis", "advance", input.projectId, project.projectName, {
        hasSoW: !!sowContent, hasGantt: !!ganttContent, health: parsed.overallHealth,
      });

      return {
        success: true,
        analysis: parsed,
        sources: {
          sow: sowContent ? { available: true, fileName: sowFileName } : { available: false },
          gantt: ganttContent ? { available: true, fileName: ganttFileName } : { available: false },
          jira: { available: true, projectKey },
          financial: { available: !!fin },
        },
      };
    }),

  // ==================== LINKED PROJECT DOCUMENTS ====================
  /** Upload a SoW or Gantt document for a linked project */
  uploadDocument: protectedProcedure.input(z.object({
    projectId: z.number(),
    docType: z.enum(["sow", "gantt"]),
    fileName: z.string().min(1),
    fileBase64: z.string().min(1),
    mimeType: z.string().optional(),
    notes: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    // Verify project is linked
    const project = await getProjectById(input.projectId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    // Decode file
    const buffer = Buffer.from(input.fileBase64, "base64");
    const fileSize = buffer.length;
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (fileSize > maxSize) throw new TRPCError({ code: "BAD_REQUEST", message: "El archivo excede el tamaño máximo de 25MB" });
    // Upload to S3
    const ext = input.fileName.split(".").pop() || "pdf";
    const safeKey = `linked-docs/${input.projectId}/${input.docType}/${nanoid(8)}.${ext}`;
    const { url } = await storagePut(safeKey, buffer, input.mimeType || "application/octet-stream");
    // Save metadata in DB
    const docId = await insertLinkedProjectDocument({
      projectId: input.projectId,
      docType: input.docType,
      fileName: input.fileName,
      fileUrl: url,
      fileKey: safeKey,
      fileSize,
      mimeType: input.mimeType || null,
      notes: input.notes || null,
      uploadedBy: ctx.user.id,
      uploadedByName: ctx.user.name || "Unknown",
    });
    await audit(ctx, "upload_linked_doc", "linked_project_document", docId, input.fileName, {
      projectId: input.projectId, docType: input.docType, fileSize,
    });
    return { id: docId, fileUrl: url, fileName: input.fileName };
  }),

  /** List documents for a linked project */
  listDocuments: protectedProcedure.input(z.object({
    projectId: z.number(),
    docType: z.enum(["sow", "gantt"]).optional(),
  })).query(async ({ input }) => {
    return getLinkedProjectDocuments(input.projectId, input.docType);
  }),

  /** Delete a linked project document */
  deleteDocument: protectedProcedure.input(z.object({
    documentId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const doc = await getLinkedProjectDocumentById(input.documentId);
    if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado" });
    await deleteLinkedProjectDocument(input.documentId);
    await audit(ctx, "delete_linked_doc", "linked_project_document", input.documentId, doc.fileName, {
      projectId: doc.projectId, docType: doc.docType,
    });
    return { success: true };
  }),
});

// ==================== CLOSURE ROUTER ====================
const closureRouter = router({
  get: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getLessonsByProject(input.projectId)),

  generate: protectedProcedure.input(z.object({
    projectId: z.number(),
    context: z.string(),
  })).mutation(async ({ input, ctx }) => {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Eres un experto en mejora continua de procesos de proyectos de tecnología. Responde SOLO con JSON válido." },
        { role: "user", content: `Genera una pauta estructurada de lecciones aprendidas para el proyecto: ${input.context}

Responde SOLO con JSON:
{
  "category": "proceso",
  "whatWorked": "descripción de lo que funcionó bien",
  "whatDidntWork": "descripción de lo que no funcionó",
  "frictions": "principales fricciones encontradas",
  "improvements": "mejoras propuestas al proceso",
  "platformSuggestions": "sugerencias de mejora para la plataforma PMO agéntica",
  "finalScore": 8
}

Sé específico y constructivo. SOLO JSON.` },
      ],
      response_format: { type: "json_object" } as any,
    });

    const rawContent5 = response.choices?.[0]?.message?.content;
    const contentStr5 = typeof rawContent5 === "string" ? rawContent5 : JSON.stringify(rawContent5 || "{}");
    const parsed = JSON.parse(contentStr5);
    await upsertLesson(input.projectId, parsed);
    await updateProjectStage(input.projectId, "closure", { progress: 70 });
    await audit(ctx, "generate_lessons", "closure", input.projectId);
    return { success: true, data: parsed };
  }),

  save: protectedProcedure.input(z.object({ projectId: z.number(), data: z.record(z.string(), z.any()) }))
    .mutation(async ({ input, ctx }) => { await upsertLesson(input.projectId, input.data); await audit(ctx, "save", "closure", input.projectId); return { success: true }; }),

  complete: protectedProcedure.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateProjectStage(input.projectId, "closure", { status: "completed", progress: 100, completedAt: new Date() });
      await updateProject(input.projectId, { status: "completado" });
      await audit(ctx, "complete_project", "closure", input.projectId);
      return { success: true };
    }),
});

// ==================== JIRA ROUTER ====================
const jiraRouter = router({
  // Health check
  health: protectedProcedure.query(async () => jiraHealthCheck()),

  // Token health check - detailed status for admin monitoring
  tokenHealth: protectedProcedure.query(async () => {
    const startTime = Date.now();
    try {
      const user = await getJiraCurrentUser();
      const latency = Date.now() - startTime;
      return {
        status: "active" as const,
        authenticated: true,
        user: {
          accountId: user.accountId,
          displayName: user.displayName,
          emailAddress: user.emailAddress,
        },
        latencyMs: latency,
        checkedAt: new Date().toISOString(),
        message: `Token válido. Autenticado como ${user.displayName} (${user.emailAddress})`,
      };
    } catch (err: any) {
      const latency = Date.now() - startTime;
      const is401 = err.message?.includes("401") || err.message?.includes("authenticated");
      const is403 = err.message?.includes("403") || err.message?.includes("forbidden");
      return {
        status: is401 ? "expired" as const : is403 ? "forbidden" as const : "error" as const,
        authenticated: false,
        user: null,
        latencyMs: latency,
        checkedAt: new Date().toISOString(),
        message: is401
          ? "Token expirado o inválido. Genera un nuevo API Token en https://id.atlassian.com/manage-profile/security/api-tokens"
          : is403
          ? "Token sin permisos suficientes. Verifica los permisos de la cuenta JIRA."
          : `Error de conexión: ${err.message?.substring(0, 150)}`,
      };
    }
  }),

  // Update JIRA API token (admin only) - writes to env and validates
  updateToken: adminOnly.input(z.object({ token: z.string().min(10) })).mutation(async ({ input }) => {
    // Validate the new token before accepting it
    const email = process.env.JIRA_EMAIL ?? "";
    const base = process.env.JIRA_BASE_URL ?? "";
    const auth = Buffer.from(`${email}:${input.token}`).toString("base64");
    try {
      const resp = await fetch(`${base}/rest/api/3/myself`, {
        headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      });
      if (!resp.ok) {
        const body = await resp.text();
        throw new TRPCError({ code: "BAD_REQUEST", message: `Token inválido (HTTP ${resp.status}): ${body.substring(0, 100)}` });
      }
      const user = await resp.json() as any;
      // Token is valid - update the environment variable at runtime
      process.env.JIRA_API_TOKEN = input.token;
      return {
        success: true,
        message: `Token actualizado exitosamente. Autenticado como ${user.displayName} (${user.emailAddress}).`,
        user: {
          accountId: user.accountId,
          displayName: user.displayName,
          emailAddress: user.emailAddress,
        },
      };
    } catch (err: any) {
      if (err instanceof TRPCError) throw err;
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Error al validar token: ${err.message}` });
    }
  }),

  // List all JIRA projects
  listProjects: protectedProcedure.query(async () => {
    const projects = await listJiraProjects();
    return projects.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      avatarUrl: p.avatarUrls?.["32x32"] ?? null,
      lead: p.lead?.displayName ?? null,
    }));
  }),

  // Get JIRA project details with issue types
  projectDetail: protectedProcedure.input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => {
      const proj = await getJiraProject(input.projectKey);
      return {
        id: proj.id,
        key: proj.key,
        name: proj.name,
        issueTypes: proj.issueTypes?.map((it: any) => ({ id: it.id, name: it.name, subtask: it.subtask })) ?? [],
        lead: proj.lead?.displayName ?? null,
      };
    }),

  // Get issues for a JIRA project (token-based pagination)
  issues: protectedProcedure.input(z.object({
    projectKey: z.string(),
    maxResults: z.number().default(50),
    nextPageToken: z.string().optional(),
    statusCategory: z.string().optional(),
  })).query(async ({ input }) => {
    const result = await getProjectIssues(input.projectKey, {
      maxResults: input.maxResults,
      nextPageToken: input.nextPageToken,
      statusCategory: input.statusCategory,
    });
    return {
      issues: result.issues.map(iss => ({
        id: iss.id,
        key: iss.key,
        summary: iss.fields.summary,
        status: iss.fields.status?.name ?? "Unknown",
        statusCategory: iss.fields.status?.statusCategory?.key ?? "undefined",
        issueType: iss.fields.issuetype?.name ?? "Unknown",
        isSubtask: iss.fields.issuetype?.subtask ?? false,
        assignee: iss.fields.assignee?.displayName ?? null,
        assigneeAvatar: iss.fields.assignee?.avatarUrls?.["24x24"] ?? null,
        priority: iss.fields.priority?.name ?? null,
        priorityIcon: iss.fields.priority?.iconUrl ?? null,
        labels: iss.fields.labels ?? [],
        created: iss.fields.created,
        updated: iss.fields.updated,
      })),
      nextPageToken: result.nextPageToken ?? null,
      isLast: result.isLast ?? true,
    };
  }),

  // Get assignable users for a JIRA project
  assignableUsers: protectedProcedure.input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => {
      const users = await getAssignableUsers(input.projectKey);
      return users.map(u => ({
        accountId: u.accountId,
        displayName: u.displayName,
        email: u.emailAddress ?? null,
        avatarUrl: u.avatarUrls?.["24x24"] ?? null,
        active: u.active,
      }));
    }),

  // Get project statuses
  statuses: protectedProcedure.input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => getProjectStatuses(input.projectKey)),

  // Create issue in JIRA
  createIssue: adminOrPmo.input(z.object({
    projectKey: z.string(),
    summary: z.string().min(1),
    issueTypeName: z.string().default("Task"),
    description: z.string().optional(),
    assigneeAccountId: z.string().optional(),
    labels: z.array(z.string()).optional(),
  })).mutation(async ({ input, ctx }) => {
    const result = await createJiraIssue(input);
    await audit(ctx, "create_jira_issue", "jira", result.key, input.summary, {
      projectKey: input.projectKey,
      issueType: input.issueTypeName,
    });
    return result;
  }),

  // Link JIRA project to PMO project
  setup: adminOrPmo.input(z.object({
    projectId: z.number(),
    jiraUrl: z.string(),
    jiraKey: z.string(),
  })).mutation(async ({ input, ctx }) => {
    await updateProject(input.projectId, { jiraProjectKey: input.jiraKey, jiraProjectUrl: input.jiraUrl });
    await updateProjectStage(input.projectId, "jira", { progress: 80 });
    await audit(ctx, "setup_jira", "jira", input.projectId, null, { jiraKey: input.jiraKey, jiraUrl: input.jiraUrl });
    return { success: true };
  }),

  // Unlink JIRA project from PMO project
  unlink: adminOrPmo.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await updateProject(input.projectId, { jiraProjectKey: null, jiraProjectUrl: null });
      await updateProjectStage(input.projectId, "jira", { progress: 0 });
      await audit(ctx, "unlink_jira", "jira", input.projectId);
      return { success: true };
    }),

  // Complete JIRA stage
  complete: adminOrPmo.input(z.object({ projectId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await unlockNextStage(input.projectId, "jira");
      await audit(ctx, "complete_stage", "jira", input.projectId);
      return { success: true };
    }),

  // Get JIRA Space linked to a PMO project
  getSpace: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      return getJiraSpaceByProject(input.projectId);
    }),

  // Get all JIRA Spaces (admin page)
  listAllSpaces: adminOrPmo.query(async () => {
    const spaces = await getAllJiraSpaces();
    return spaces;
  }),

  // Get template structure from PBTISD1
  getTemplate: protectedProcedure.query(async () => {
    return getTemplateStructure("PBTISD1");
  }),

  // Create a new JIRA Space for a PMO project
  createSpace: adminOrPmo.input(z.object({
    projectId: z.number(),
    spaceName: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
    spaceKey: z.string().min(2).max(10).regex(/^[A-Z0-9]+$/, "La key debe ser letras mayúsculas y números"),
    description: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    // Get current JIRA user accountId
    const jiraUser = await getJiraCurrentUser();

    // Attempt to create the JIRA project
    const result = await createJiraSpace({
      spaceName: input.spaceName,
      spaceKey: input.spaceKey,
      description: input.description,
      leadAccountId: jiraUser.accountId,
    });

    // Save Space record to DB
    const spaceId = await createJiraSpaceRecord({
      projectId: input.projectId,
      spaceName: input.spaceName,
      jiraProjectKey: result.jiraProjectKey ?? null,
      jiraProjectId: result.jiraProjectId ?? null,
      jiraProjectName: result.jiraProjectName ?? null,
      jiraProjectUrl: result.jiraProjectUrl ?? null,
      status: result.created ? "created" : "pending_permissions",
      templateKey: "PBTISD1",
      boards: result.template.boards as any,
      issueTypes: result.template.issueTypes as any,
      workflows: result.template.workflows as any,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "Unknown",
    });

    // If created in JIRA, also link to the PMO project
    if (result.created && result.jiraProjectKey) {
      await updateProject(input.projectId, {
        jiraProjectKey: result.jiraProjectKey,
        jiraProjectUrl: result.jiraProjectUrl ?? null,
      });
      await updateProjectStage(input.projectId, "jira", { progress: 80 });
    }

    await audit(ctx, "create_jira_space", "jira_space", spaceId, input.spaceName, {
      projectId: input.projectId,
      spaceKey: input.spaceKey,
      created: result.created,
      jiraProjectKey: result.jiraProjectKey,
    });

    return {
      spaceId,
      spaceName: input.spaceName,
      spaceKey: input.spaceKey,
      created: result.created,
      jiraProjectUrl: result.jiraProjectUrl ?? null,
      template: result.template,
      message: result.error ?? (result.created ? `Space "${input.spaceName}" creado exitosamente en JIRA` : `Space registrado. Se creará en JIRA cuando se habiliten los permisos de administrador.`),
    };
  }),

  // Retry creating a pending Space in JIRA (when permissions are now available)
  retryCreateSpace: adminOrPmo.input(z.object({ spaceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const space = (await getAllJiraSpaces()).find(s => s.id === input.spaceId);
      if (!space) throw new TRPCError({ code: "NOT_FOUND", message: "Space no encontrado" });
      if (space.status === "created") return { success: true, message: "El Space ya fue creado en JIRA" };

      const jiraUser = await getJiraCurrentUser();
      const result = await createJiraSpace({
        spaceName: space.spaceName,
        spaceKey: space.jiraProjectKey ?? space.spaceName.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10),
        leadAccountId: jiraUser.accountId,
      });

      if (result.created) {
        await updateJiraSpaceStatus(space.id, {
          status: "created",
          jiraProjectKey: result.jiraProjectKey,
          jiraProjectId: result.jiraProjectId,
          jiraProjectName: result.jiraProjectName,
          jiraProjectUrl: result.jiraProjectUrl,
        });
        await updateProject(space.projectId, {
          jiraProjectKey: result.jiraProjectKey ?? null,
          jiraProjectUrl: result.jiraProjectUrl ?? null,
        });
        await audit(ctx, "retry_create_jira_space", "jira_space", space.id, space.spaceName, { created: true });
        return { success: true, message: `Space "${space.spaceName}" creado exitosamente en JIRA`, jiraProjectUrl: result.jiraProjectUrl };
      }
      return { success: false, message: result.error ?? "No se pudo crear el Space. Verifica los permisos." };
    }),

  // Get issue summary stats for a linked JIRA project
  // New JIRA API uses token pagination and doesn't return total count.
  // We fetch up to 100 issues per category to count them.
  stats: protectedProcedure.input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => {
      const countAll = async (jql: string): Promise<number> => {
        let count = 0;
        let token: string | undefined;
        let done = false;
        while (!done) {
          const result = await searchJiraIssues(jql, { maxResults: 100, nextPageToken: token });
          count += result.issues.length;
          if (result.isLast || !result.nextPageToken) done = true;
          else token = result.nextPageToken;
          // Safety: limit to 1000 to avoid infinite loops
          if (count >= 1000) break;
        }
        return count;
      };
      const [todo, inProgress, doneCount] = await Promise.all([
        countAll(`project=${input.projectKey} AND statusCategory="To Do"`),
        countAll(`project=${input.projectKey} AND statusCategory="In Progress"`),
        countAll(`project=${input.projectKey} AND statusCategory="Done"`),
      ]);
      return {
        todo,
        inProgress,
        done: doneCount,
        total: todo + inProgress + doneCount,
      };
    }),

  // ==================== REPORTING ====================

  /** Full project report: KPIs, by type, by assignee, recent activity, overdue */
  projectReport: protectedProcedure
    .input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => {
      return getJiraProjectReport(input.projectKey);
    }),

  /** Consolidated report across all PMO projects with linked JIRA Spaces */
  consolidatedReport: protectedProcedure
    .query(async () => {
      const spaces = await getAllJiraSpaces();
      const activeSpaces = spaces.filter(s => s.status === "created" && s.jiraProjectKey);

      // Fetch reports in parallel (limit to 10 to avoid rate limiting)
      const reportsToFetch = activeSpaces.slice(0, 10);
      const reports = await Promise.allSettled(
        reportsToFetch.map(async (space) => {
          const report = await getJiraProjectReport(space.jiraProjectKey!);
          return {
            spaceId: space.id,
            spaceName: space.spaceName,
            projectKey: space.jiraProjectKey!,
            projectName: space.jiraProjectName ?? space.spaceName,
            projectUrl: space.jiraProjectUrl ?? "",
            pmoProjectId: space.projectId,
            pmoProjectName: space.spaceName,
            total: report.total,
            done: report.done,
            inProgress: report.inProgress,
            toDo: report.toDo,
            percentComplete: report.percentComplete,
          };
        })
      );

      const successfulReports = reports
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value);

      const totalIssues = successfulReports.reduce((sum, r) => sum + r.total, 0);
      const totalDone = successfulReports.reduce((sum, r) => sum + r.done, 0);
      const avgProgress = successfulReports.length > 0
        ? Math.round(successfulReports.reduce((sum, r) => sum + r.percentComplete, 0) / successfulReports.length)
        : 0;

      return {
        totalSpaces: activeSpaces.length,
        totalIssues,
        totalDone,
        avgProgress,
        spaces: successfulReports,
        lastUpdated: new Date().toISOString(),
      };
    }),

  // ==================== VALIDATE BOARDS ====================
  validateBoards: protectedProcedure
    .input(z.object({ projectKey: z.string() }))
    .mutation(async ({ input }) => {
      const { projectKey } = input;
      // Get all boards for this project from JIRA Agile API
      const boards = await getProjectBoards(projectKey);
      const boardNames = boards.map((b: any) => b.name.toLowerCase().trim());

      // The 5 required PMO boards (match by partial name to handle variations)
      const requiredBoards = [
        { key: "riesgos_pmo", label: "Riesgos PMO board", searchTerms: ["riesgos pmo", "tablero riesgos"] },
        { key: "epic_story_task", label: "Epic, Story, Task board", searchTerms: ["gestion pmi", "epic", "story", "task"] },
        { key: "cambio_alcance", label: "Cambio de Alcance board", searchTerms: ["cambio de alcance"] },
        { key: "proyecto_avance", label: "Proyecto PMO - Avance board", searchTerms: ["proyecto pmo", "avance"] },
        { key: "hito_pmo", label: "Hito PMO board", searchTerms: ["hito pmo"] },
      ];

      const results = requiredBoards.map(req => {
        const found = boards.find((b: any) => 
          req.searchTerms.some(term => b.name.toLowerCase().includes(term))
        );
        return {
          key: req.key,
          label: req.label,
          found: !!found,
          boardName: found?.name ?? null,
          boardId: found?.id ?? null,
          boardType: found?.type ?? null,
        };
      });

      const allValid = results.every(r => r.found);
      return {
        allValid,
        boards: results,
        totalFound: results.filter(r => r.found).length,
        totalRequired: results.length,
        jiraBoards: boards.map((b: any) => ({ id: b.id, name: b.name, type: b.type })),
      };
    }),
  // ==================== LINK EXISTING JIRA PROJECTS ====================

  /** Search JIRA projects available for linking (excludes already managed ones) */
  searchAvailableProjects: adminOrPmo.input(z.object({
    query: z.string().optional(),
  })).query(async ({ input }) => {
    // Get all JIRA projects
    const allJiraProjects = await listJiraProjects();
    // Get keys already managed in PMO
    const managedKeys = await getManagedJiraProjectKeys();
    const managedSet = new Set(managedKeys.map(k => k.toUpperCase()));
    // Filter out managed projects
    let available = allJiraProjects.filter(p => !managedSet.has(p.key.toUpperCase()));
    // Apply search filter if provided
    if (input.query && input.query.trim().length > 0) {
      const q = input.query.trim().toLowerCase();
      available = available.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
      );
    }
    return available.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      projectTypeKey: p.projectTypeKey,
      avatarUrl: p.avatarUrls?.["32x32"] ?? null,
      lead: p.lead?.displayName ?? null,
    }));
  }),

  /** Link an existing JIRA project to the PMO platform */
  linkExistingProject: adminOrPmo.input(z.object({
    jiraProjectKey: z.string().min(1),
    jiraProjectName: z.string().min(1),
    clientName: z.string().min(1, "Nombre del cliente es requerido"),
    projectType: z.enum(["apigee", "desarrollo", "integracion", "data", "otro"]).optional(),
  })).mutation(async ({ input, ctx }) => {
    // Verify the project exists in JIRA
    const jiraProject = await getJiraProject(input.jiraProjectKey);
    const jiraUrl = `${process.env.JIRA_BASE_URL}/jira/software/projects/${input.jiraProjectKey}/boards`;

    // Check not already managed
    const managedKeys = await getManagedJiraProjectKeys();
    if (managedKeys.map(k => k.toUpperCase()).includes(input.jiraProjectKey.toUpperCase())) {
      throw new TRPCError({ code: "CONFLICT", message: `El proyecto ${input.jiraProjectKey} ya está vinculado a la plataforma PMO` });
    }

    // Create the PMO project with origin=linked
    const projectId = await createLinkedProject({
      projectName: input.jiraProjectName,
      clientName: input.clientName,
      jiraProjectKey: input.jiraProjectKey,
      jiraProjectUrl: jiraUrl,
      pmoId: ctx.user.id,
      projectType: input.projectType,
    });

    // Also create a jira_spaces record for the linked project
    const spaceId = await createJiraSpaceRecord({
      projectId,
      spaceName: input.jiraProjectName,
      jiraProjectKey: input.jiraProjectKey,
      jiraProjectId: jiraProject.id,
      jiraProjectName: jiraProject.name,
      jiraProjectUrl: jiraUrl,
      status: "linked",
      templateKey: null,
      boards: [] as any,
      issueTypes: (jiraProject.issueTypes?.map((it: any) => ({ id: it.id, name: it.name, subtask: it.subtask })) ?? []) as any,
      workflows: [] as any,
      createdBy: ctx.user.id,
      createdByName: ctx.user.name ?? "Unknown",
    });

    await audit(ctx, "link_jira_project", "project", projectId, input.jiraProjectName, {
      jiraProjectKey: input.jiraProjectKey,
      origin: "linked",
      spaceId,
    });

    return {
      projectId,
      spaceId,
      jiraProjectKey: input.jiraProjectKey,
      jiraProjectUrl: jiraUrl,
      message: `Proyecto "${input.jiraProjectName}" vinculado exitosamente. Se mostrará directamente en la vista de Avance.`,
    };
  }),

  /** Unlink a manually linked JIRA project (removes PMO project and associated records) */
  unlinkProject: adminOrPmo.input(z.object({
    projectId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const result = await unlinkProject(input.projectId);
    if (!result.deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado o no es un proyecto vinculado" });
    }

    await audit(ctx, "unlink_jira_project", "project", input.projectId, result.projectName, {
      origin: "linked",
      action: "unlinked",
    });

    return {
      success: true,
      projectName: result.projectName,
      message: `Proyecto "${result.projectName}" desvinculado exitosamente de la plataforma PMO.`,
    };
  }),

  /** Delete a PMO project (admin only). Blocked if in design or closure stage. */
  deleteProject: adminOnly.input(z.object({
    projectId: z.number(),
  })).mutation(async ({ input, ctx }) => {
    const result = await deleteProjectAdmin(input.projectId);

    if (!result.deleted && result.blockedReason) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: result.blockedReason });
    }
    if (!result.deleted) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado" });
    }

    await audit(ctx, "delete_project", "project", input.projectId, result.projectName, {
      action: "deleted_by_admin",
      adminId: ctx.user.id,
      adminName: ctx.user.name,
    });

    return {
      success: true,
      projectName: result.projectName,
      message: `Proyecto "${result.projectName}" eliminado exitosamente.`,
    };
  }),

  /** Full advance report using getJiraAdvanceReport */
  advanceReport: protectedProcedure
    .input(z.object({ projectKey: z.string() }))
    .query(async ({ input }) => {
      return getJiraAdvanceReport(input.projectKey);
    }),

  /** Generate PPTX status report for a project */
  generateStatusReport: protectedProcedure
    .input(z.object({ projectKey: z.string(), projectName: z.string().optional(), clientName: z.string().optional(), dealNumber: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const report = await getJiraAdvanceReport(input.projectKey);
      const now = new Date();
      const dateStr = now.toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric" });

      const reportData: ReportData = {
        projectName: input.projectName || report.projectName,
        clientName: input.clientName || report.projectName,
        dealNumber: input.dealNumber || input.projectKey,
        jiraKey: input.projectKey,
        date: dateStr,
        totalIssues: report.totalIssues,
        doneCount: report.doneCount,
        inProgressCount: report.inProgressCount,
        toDoCount: report.toDoCount,
        percentComplete: report.percentComplete,
        milestones: report.milestones,
        milestonesCumplidos: report.milestonesCumplidos,
        milestonesPendientes: report.milestonesPendientes,
        epics: report.epics,
        risks: report.risks,
        scopeChanges: report.scopeChanges,
        team: report.team,
        byStatus: report.byStatus,
        byType: report.byType,
      };

      const result = await generateStatusReportPptx(reportData);

      await audit(ctx, "generate_status_report", "jira", input.projectKey, input.projectName || report.projectName, {
        filename: result.filename,
      });

      return result;
    }),

  /** Enriched consolidated report including both JIRA spaces and PMO projects */
  enrichedConsolidatedReport: protectedProcedure
    .query(async () => {
      const [spaces, allProjects] = await Promise.all([
        getAllJiraSpaces(),
        getAllProjects(),
      ]);
      const activeSpaces = spaces.filter(s => s.status === "created" && s.jiraProjectKey);

      // Fetch JIRA reports in parallel
      const reports = await Promise.allSettled(
        activeSpaces.slice(0, 15).map(async (space) => {
          const report = await getJiraAdvanceReport(space.jiraProjectKey!);
          // Find PMO project
          const pmoProject = allProjects.find(p => p.id === space.projectId);
          return {
            spaceId: space.id,
            spaceName: space.spaceName,
            projectKey: space.jiraProjectKey!,
            projectName: space.jiraProjectName ?? space.spaceName,
            projectUrl: space.jiraProjectUrl ?? "",
            pmoProjectId: space.projectId,
            pmoProjectName: pmoProject?.projectName ?? space.spaceName,
            clientName: pmoProject?.clientName ?? "",
            dealNumber: "",
            isLinked: !!pmoProject,
            total: report.totalIssues,
            done: report.doneCount,
            inProgress: report.inProgressCount,
            toDo: report.toDoCount,
            percentComplete: report.percentComplete,
            epicsCount: report.epics.length,
            epicsDone: report.epics.filter(e => e.statusCategory === "Done").length,
            milestonesCount: report.milestonesCumplidos + report.milestonesPendientes,
            milestonesDone: report.milestonesCumplidos,
            risksCount: report.risks.length,
            risksOpen: report.risks.filter(r => r.statusCategory !== "Done").length,
            teamSize: report.team.length,
          };
        })
      );

      const successfulReports = reports
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value);

      // Find projects with jiraProjectKey directly (origin=linked) that aren't already covered by jira_spaces
      const coveredProjectIds = new Set(successfulReports.map(r => r.pmoProjectId).filter(Boolean));
      const coveredKeys = new Set(successfulReports.map(r => r.projectKey));
      const linkedProjectsWithJira = allProjects.filter(p => 
        p.jiraProjectKey && !coveredKeys.has(p.jiraProjectKey) && p.status !== "cancelado"
      );

      // Fetch JIRA data for linked projects
      const linkedReports = await Promise.allSettled(
        linkedProjectsWithJira.map(async (proj) => {
          const report = await getJiraAdvanceReport(proj.jiraProjectKey!);
          return {
            spaceId: null,
            spaceName: proj.projectName,
            projectKey: proj.jiraProjectKey!,
            projectName: proj.projectName,
            projectUrl: proj.jiraProjectUrl ?? "",
            pmoProjectId: proj.id,
            pmoProjectName: proj.projectName,
            clientName: proj.clientName ?? "",
            dealNumber: "",
            isLinked: true,
            total: report.totalIssues,
            done: report.doneCount,
            inProgress: report.inProgressCount,
            toDo: report.toDoCount,
            percentComplete: report.percentComplete,
            epicsCount: report.epics.length,
            epicsDone: report.epics.filter(e => e.statusCategory === "Done").length,
            milestonesCount: report.milestonesCumplidos + report.milestonesPendientes,
            milestonesDone: report.milestonesCumplidos,
            risksCount: report.risks.length,
            risksOpen: report.risks.filter(r => r.statusCategory !== "Done").length,
            teamSize: report.team.length,
          };
        })
      );
      const successfulLinkedReports = linkedReports
        .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
        .map(r => r.value);

      // Merge all covered project IDs
      const allCoveredIds = new Set(
        Array.from(coveredProjectIds).concat(
          successfulLinkedReports.map(r => r.pmoProjectId).filter(Boolean)
        )
      );

      // Also include PMO projects without any JIRA key
      const pmoProjectsWithoutJira = allProjects.filter(p => {
        return !allCoveredIds.has(p.id) && !p.jiraProjectKey && p.status !== "cancelado";
      }).map(p => ({
        spaceId: null,
        spaceName: p.projectName,
        projectKey: null,
        projectName: p.projectName,
        projectUrl: null,
        pmoProjectId: p.id,
        pmoProjectName: p.projectName,
        clientName: p.clientName ?? "",
        dealNumber: "",
        isLinked: false,
        total: 0,
        done: 0,
        inProgress: 0,
        toDo: 0,
        percentComplete: 0,
        epicsCount: 0,
        epicsDone: 0,
        milestonesCount: 0,
        milestonesDone: 0,
        risksCount: 0,
        risksOpen: 0,
        teamSize: 0,
      }));

      const allEntries = [...successfulReports, ...successfulLinkedReports, ...pmoProjectsWithoutJira];
      const totalIssues = allEntries.reduce((sum, r) => sum + r.total, 0);
      const totalDone = allEntries.reduce((sum, r) => sum + r.done, 0);
      const jiraEntries = allEntries.filter(e => e.projectKey);
      const avgProgress = jiraEntries.length > 0
        ? Math.round(jiraEntries.reduce((sum, r) => sum + r.percentComplete, 0) / jiraEntries.length)
        : 0;

      return {
        totalProjects: allEntries.length,
        totalJiraSpaces: jiraEntries.length,
        totalIssues,
        totalDone,
        avgProgress,
        projects: allEntries,
        lastUpdated: new Date().toISOString(),
      };
    }),

  /** Get financial KPIs for a project (HH presupuestadas, capacity, etc.) */
  getProjectFinancialKPIs: protectedProcedure
    .input(z.object({ projectKey: z.string(), pmoProjectId: z.number().optional() }))
    .query(async ({ input }) => {
      const { getFinancialDataForDeal: getFinDataKPI, extractDealId: extractDealKPI } = await import("./financialDataFetcher");
      // Try to find the deal ID from the PMO project
      let dealId: string | null = null;
      if (input.pmoProjectId) {
        const project = await getProjectById(input.pmoProjectId);
        if (project) {
          dealId = extractDealKPI(project.projectName);
        }
      }
      if (!dealId) {
        // Try to find from all projects matching the jiraProjectKey
        const allProjects = await getAllProjects();
        const match = allProjects.find(p => p.jiraProjectKey === input.projectKey);
        if (match) dealId = extractDealKPI(match.projectName);
      }
      if (!dealId) return { found: false, presupuestoHH: null, capacityHH: null, hhPorcUtilizado: null };

      const finData = await getFinDataKPI(dealId);
      if (!finData.projectFinancial) return { found: false, presupuestoHH: null, capacityHH: null, hhPorcUtilizado: null };

      return {
        found: true,
        presupuestoHH: finData.projectFinancial.presupuestoHH,
        capacityHH: finData.projectFinancial.capacityHH,
        hhPorcUtilizado: finData.projectFinancial.hhPorcUtilizado,
      };
    }),
});

// ==================== DEADLINES ROUTER (Admin: plazos por etapa) ====================
const deadlinesRouter = router({
  list: protectedProcedure.query(async () => getAllStageDeadlines()),

  update: adminOnly.input(z.object({
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
    maxBusinessDays: z.number().min(1).max(365),
    label: z.string().min(1),
    description: z.string().optional(),
  })).mutation(async ({ input, ctx }) => {
    await upsertStageDeadline(input.stageId, input.maxBusinessDays, input.label, input.description);
    await audit(ctx, "update_deadline", "deadline", input.stageId, input.label, { maxBusinessDays: input.maxBusinessDays });
    return { success: true };
  }),

  bulkUpdate: adminOnly.input(z.object({
    deadlines: z.array(z.object({
      stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
      maxBusinessDays: z.number().min(1).max(365),
      label: z.string().min(1),
      description: z.string().optional(),
    })),
  })).mutation(async ({ input, ctx }) => {
    for (const d of input.deadlines) {
      await upsertStageDeadline(d.stageId, d.maxBusinessDays, d.label, d.description);
    }
    await audit(ctx, "bulk_update_deadlines", "deadline", null, null, { count: input.deadlines.length });
    return { success: true };
    }),
});

// ==================== HOLIDAYS ====================
const holidaysRouter = router({
  list: protectedProcedure.query(async () => getAllHolidays()),
  byYear: protectedProcedure.input(z.object({ year: z.number() }))
    .query(async ({ input }) => getHolidaysByYear(input.year)),
});

// ==================== STAGE OPENINGS ROUTER ====================
const stageOpeningsRouter = router({
  // Record first opening of a stage (called when PM navigates to a stage)
  recordOpening: protectedProcedure.input(z.object({
    projectId: z.number(),
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
  })).mutation(async ({ input, ctx }) => {
    const opening = await recordStageOpening(input.projectId, input.stageId, ctx.user.id);
    return opening;
  }),

  // Get all openings for a project
  byProject: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getStageOpeningsByProject(input.projectId)),

  // Calculate time remaining for all stages of a project (considers pauses & extensions)
  timeRemaining: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const deadlines = await getAllStageDeadlines();
      const openings = await getStageOpeningsByProject(input.projectId);
      const stages = await getProjectStages(input.projectId);
      const project = await getProjectById(input.projectId);

      // For "design" (Avance Proyecto) stage, calculate duration from project Gantt dates
      let ganttBusinessDays: number | null = null;
      if (project?.startDate && project?.endDate) {
        ganttBusinessDays = await calculateBusinessDaysBetween(
          new Date(project.startDate),
          new Date(project.endDate)
        );
      }

      const result: Array<{
        stageId: string;
        label: string;
        maxBusinessDays: number;
        openedAt: Date | null;
        closedAt: Date | null;
        deadlineDate: Date | null;
        remainingBusinessDays: number | null;
        usedBusinessDays: number | null;
        totalBusinessDays: number;
        extraDays: number;
        pausedDays: number;
        isPaused: boolean;
        status: string;
        stageStatus: string;
      }> = [];

      for (const deadline of deadlines) {
        const opening = openings.find((o) => o.stageId === deadline.stageId);
        const stage = stages.find((s) => s.stageId === deadline.stageId);
        const stageStatus = stage?.status ?? "locked";
        // Una apertura registrada inicia el seguimiento del SLA. El estado funcional
        // continúa siendo el que controla permisos y desbloqueos del pipeline.
        const deadlineStageStatus = stageStatus === "locked" && opening ? "in_progress" : stageStatus;

        // For "design" stage (Avance Proyecto), override maxBusinessDays with Gantt duration
        const effectiveMaxDays = (deadline.stageId === "design" && ganttBusinessDays !== null)
          ? ganttBusinessDays
          : deadline.maxBusinessDays;

        if (deadlineStageStatus === "locked" || (!opening && deadlineStageStatus !== "completed")) {
          result.push({
            stageId: deadline.stageId,
            label: deadline.label,
            maxBusinessDays: effectiveMaxDays,
            openedAt: null,
            closedAt: null,
            deadlineDate: null,
            remainingBusinessDays: null,
            usedBusinessDays: null,
            totalBusinessDays: effectiveMaxDays,
            extraDays: 0,
            pausedDays: 0,
            isPaused: false,
            status: "not_started",
            stageStatus: deadlineStageStatus,
          });
          continue;
        }

        if (deadlineStageStatus === "completed") {
          const ed = await getTotalExtraDays(input.projectId, deadline.stageId);
          const pd = await getTotalPausedDays(input.projectId, deadline.stageId);
          // Calculate used business days for completed stages
          const closure = await getStageClosure(input.projectId, deadline.stageId);
          let usedDays: number | null = null;
          if (opening?.openedAt && closure?.closedAt) {
            usedDays = await calculateBusinessDaysBetween(opening.openedAt, new Date(closure.closedAt));
          } else if (opening?.openedAt) {
            // Fallback: calculate from opening to now
            usedDays = await calculateBusinessDaysBetween(opening.openedAt, new Date());
          }
          result.push({
            stageId: deadline.stageId,
            label: deadline.label,
            maxBusinessDays: effectiveMaxDays,
            openedAt: opening?.openedAt ?? null,
            closedAt: closure?.closedAt ? new Date(closure.closedAt) : null,
            deadlineDate: null,
            remainingBusinessDays: null,
            usedBusinessDays: usedDays,
            totalBusinessDays: effectiveMaxDays + ed + pd,
            extraDays: ed,
            pausedDays: pd,
            isPaused: false,
            status: "completed",
            stageStatus: deadlineStageStatus,
          });
          continue;
        }

        const extraDays = await getTotalExtraDays(input.projectId, deadline.stageId);
        const pausedDays = await getTotalPausedDays(input.projectId, deadline.stageId);
        const paused = await isStagePaused(input.projectId, deadline.stageId);
        const totalAllowed = effectiveMaxDays + extraDays + pausedDays;

        const deadlineDate = await calculateDeadlineDate(opening!.openedAt, totalAllowed);
        const remaining = paused ? null : await calculateRemainingBusinessDays(deadlineDate);

        let status = paused ? "paused" : "on_track";
        if (!paused && remaining !== null) {
          const percentUsed = ((totalAllowed - remaining) / totalAllowed) * 100;
          if (remaining <= 0) status = "overdue";
          else if (percentUsed >= 75) status = "warning";
          else if (percentUsed >= 50) status = "caution";
        }

        // Calculate used business days for in-progress stages
        const usedBizDays = await calculateBusinessDaysBetween(opening!.openedAt, new Date());

        result.push({
          stageId: deadline.stageId,
          label: deadline.label,
          maxBusinessDays: deadline.maxBusinessDays,
          openedAt: opening!.openedAt,
          closedAt: null,
          deadlineDate,
          remainingBusinessDays: remaining,
          usedBusinessDays: usedBizDays,
          totalBusinessDays: totalAllowed,
          extraDays,
          pausedDays,
          isPaused: paused,
          status,
          stageStatus: deadlineStageStatus,
        });
      }

      return result;
    }),
});

// ==================== EXTENSIONS ROUTER (Pausar/Extender plazos) ====================
const extensionsRouter = router({
  // Pause a stage
  pause: adminOrPmo.input(z.object({
    projectId: z.number(),
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
    reason: z.string().min(1),
  })).mutation(async ({ input, ctx }) => {
    const paused = await isStagePaused(input.projectId, input.stageId);
    if (paused) throw new TRPCError({ code: "BAD_REQUEST", message: "La etapa ya est\u00e1 pausada" });
    await createExtension({ projectId: input.projectId, stageId: input.stageId as any, type: "pause", reason: input.reason, createdBy: ctx.user.id, extraDays: 0 });
    await audit(ctx, "pause_stage", "extension", input.stageId, null, { projectId: input.projectId, reason: input.reason });
    return { success: true };
  }),

  // Resume a paused stage
  resume: adminOrPmo.input(z.object({
    projectId: z.number(),
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
    reason: z.string().min(1),
  })).mutation(async ({ input, ctx }) => {
    const paused = await isStagePaused(input.projectId, input.stageId);
    if (!paused) throw new TRPCError({ code: "BAD_REQUEST", message: "La etapa no est\u00e1 pausada" });
    await createExtension({ projectId: input.projectId, stageId: input.stageId as any, type: "resume", reason: input.reason, createdBy: ctx.user.id, extraDays: 0 });
    await audit(ctx, "resume_stage", "extension", input.stageId, null, { projectId: input.projectId, reason: input.reason });
    return { success: true };
  }),

  // Extend deadline
  extend: adminOrPmo.input(z.object({
    projectId: z.number(),
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
    extraDays: z.number().min(1).max(365),
    reason: z.string().min(1),
  })).mutation(async ({ input, ctx }) => {
    await createExtension({ projectId: input.projectId, stageId: input.stageId as any, type: "extend", reason: input.reason, createdBy: ctx.user.id, extraDays: input.extraDays });
    await audit(ctx, "extend_deadline", "extension", input.stageId, null, { projectId: input.projectId, extraDays: input.extraDays, reason: input.reason });
    return { success: true };
  }),

  // Get history for a project stage
  history: protectedProcedure.input(z.object({
    projectId: z.number(),
    stageId: z.enum(["sow", "jira", "risks", "planning", "design", "closure"]),
  })).query(async ({ input }) => getExtensionsByProjectStage(input.projectId, input.stageId)),

  // Get all extensions for a project
  byProject: protectedProcedure.input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => getExtensionsByProject(input.projectId)),
});

// ==================== NOTIFICATIONS ROUTER (Deadline alerts) ====================
const deadlineNotificationsRouter = router({
  // Check and send notifications for stages approaching deadline
  checkAndNotify: adminOrPmo.mutation(async () => {
    const allProjects = await getAllProjects();
    const deadlines = await getAllStageDeadlines();
    let notificationsSent = 0;

    for (const project of allProjects) {
      if (project.status !== "activo") continue;
      const openings = await getStageOpeningsByProject(project.id);
      const stages = await getProjectStages(project.id);

      for (const deadline of deadlines) {
        const opening = openings.find((o) => o.stageId === deadline.stageId);
        const stage = stages.find((s) => s.stageId === deadline.stageId);
        if (!opening || stage?.status !== "in_progress") continue;

        const paused = await isStagePaused(project.id, deadline.stageId);
        if (paused) continue;

        const extraDays = await getTotalExtraDays(project.id, deadline.stageId);
        const pausedDays = await getTotalPausedDays(project.id, deadline.stageId);
        const totalAllowed = deadline.maxBusinessDays + extraDays + pausedDays;
        const deadlineDate = await calculateDeadlineDate(opening!.openedAt, totalAllowed);
        const remaining = await calculateRemainingBusinessDays(deadlineDate);
        const percentUsed = ((totalAllowed - remaining) / totalAllowed) * 100;

        // Check 75% warning
        if (percentUsed >= 75 && remaining > 0) {
          const alreadySent = await hasNotificationBeenSent(project.id, deadline.stageId, "warning_75");
          if (!alreadySent) {
            // Send email notification
            const recipients: string[] = [];
            if (project.pmId) {
              const pmUser = await getUserByOpenId(""); // We need PM email
              // Get PM from users table by id
            }
            try {
              await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
                body: JSON.stringify({
                  to: process.env.OWNER_NAME ? undefined : "admin@prodigio.tech",
                  subject: `\u26a0\ufe0f Alerta de Plazo: ${project.projectName} - ${deadline.label}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                    <div style="background:#f97316;color:#fff;padding:20px;border-radius:8px 8px 0 0">
                      <h2 style="margin:0">\u26a0\ufe0f Alerta de Plazo - 75%</h2>
                    </div>
                    <div style="padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
                      <p><strong>Proyecto:</strong> ${project.projectName}</p>
                      <p><strong>Etapa:</strong> ${deadline.label}</p>
                      <p><strong>D\u00edas h\u00e1biles restantes:</strong> ${remaining} de ${totalAllowed}</p>
                      <p><strong>Porcentaje consumido:</strong> ${Math.round(percentUsed)}%</p>
                      <p style="color:#f97316;font-weight:bold">La etapa ha consumido el 75% del plazo asignado. Se recomienda tomar acciones para asegurar el cierre a tiempo.</p>
                    </div>
                  </div>`,
                }),
              });
            } catch (e) { console.warn("[Notification] Email failed:", e); }

            await recordNotificationSent({ projectId: project.id, stageId: deadline.stageId as any, notificationType: "warning_75", sentTo: "owner" });
            notificationsSent++;
          }
        }

        // Check overdue
        if (remaining <= 0) {
          const alreadySent = await hasNotificationBeenSent(project.id, deadline.stageId, "overdue");
          if (!alreadySent) {
            try {
              await fetch(`${process.env.BUILT_IN_FORGE_API_URL}/email/send`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.BUILT_IN_FORGE_API_KEY}` },
                body: JSON.stringify({
                  to: process.env.OWNER_NAME ? undefined : "admin@prodigio.tech",
                  subject: `\ud83d\udea8 Plazo Vencido: ${project.projectName} - ${deadline.label}`,
                  html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
                    <div style="background:#ef4444;color:#fff;padding:20px;border-radius:8px 8px 0 0">
                      <h2 style="margin:0">\ud83d\udea8 Plazo Vencido</h2>
                    </div>
                    <div style="padding:20px;border:1px solid #e5e7eb;border-top:0;border-radius:0 0 8px 8px">
                      <p><strong>Proyecto:</strong> ${project.projectName}</p>
                      <p><strong>Etapa:</strong> ${deadline.label}</p>
                      <p><strong>D\u00edas h\u00e1biles vencidos:</strong> ${Math.abs(remaining)}</p>
                      <p style="color:#ef4444;font-weight:bold">El plazo de esta etapa ha vencido. Se requiere atenci\u00f3n inmediata.</p>
                    </div>
                  </div>`,
                }),
              });
            } catch (e) { console.warn("[Notification] Email failed:", e); }

            await recordNotificationSent({ projectId: project.id, stageId: deadline.stageId as any, notificationType: "overdue", sentTo: "owner" });
            notificationsSent++;
          }
        }
      }
    }

    return { success: true, notificationsSent };
  }),
});

// ==================== COMPLIANCE ROUTER (Reporte de cumplimiento) ====================
const complianceRouter = router({
  metrics: protectedProcedure.query(async () => getComplianceMetrics()),
});

// ==================== AUDIT ROUTER ====================
const auditRouter = router({
  list: adminOnly.input(z.object({
    page: z.number().min(1).default(1),
    pageSize: z.number().min(10).max(100).default(25),
    action: z.string().optional(),
    entity: z.string().optional(),
    userId: z.number().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })).query(async ({ input }) => {
    return getAuditLogs(input);
  }),

  stats: adminOnly.query(async () => {
    const recent = await getAuditLogs({ page: 1, pageSize: 100 });
    const actionCounts: Record<string, number> = {};
    const entityCounts: Record<string, number> = {};
    const userCounts: Record<string, number> = {};
    for (const log of recent.logs) {
      actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
      entityCounts[log.entity] = (entityCounts[log.entity] || 0) + 1;
      const userName = log.userName || "Sistema";
      userCounts[userName] = (userCounts[userName] || 0) + 1;
    }
    return { actionCounts, entityCounts, userCounts, totalRecent: recent.total };
  }),
  /** Export audit logs as CSV data */
  exportCsv: adminOnly.input(z.object({
    action: z.string().optional(),
    entity: z.string().optional(),
    userId: z.number().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })).query(async ({ input }) => {
    const result = await getAuditLogs({ ...input, page: 1, pageSize: 5000 });
    const header = "ID,Fecha,Usuario,Rol,Acción,Entidad,ID Entidad,Nombre Entidad,Detalles";
    const rows = result.logs.map((log: any) => {
      const date = new Date(log.createdAt).toISOString();
      const details = log.details ? JSON.stringify(log.details).replace(/"/g, '""') : "";
      return [
        log.id,
        date,
        `"${(log.userName || "Sistema").replace(/"/g, '""')}"`,
        log.userRole || "-",
        log.action,
        log.entity,
        log.entityId || "-",
        `"${(log.entityName || "-").replace(/"/g, '""')}"`,
        `"${details}"`,
      ].join(",");
    });
    return { csv: [header, ...rows].join("\n"), total: result.total };
  }),
});

// ==================== FINANCIAL SYNC ROUTER ====================
const financialRouter = router({
  /** Get sync status info */
  syncInfo: adminOrPmo.query(async () => {
    return getFinancialDataSyncInfo();
  }),

  /** List all financial data records */
  list: adminOrPmo.query(async () => {
    return getAllFinancialDataFromDb();
  }),

  /** Sync financial data from a JSON payload (extracted from Google Sheets) */
  syncFromPayload: adminOnly.input(z.object({
    rows: z.array(z.object({
      dealId: z.string(),
      estadoProyecto: z.string().optional().nullable(),
      projectName: z.string().optional().nullable(),
      clientName: z.string().optional().nullable(),
      pm: z.string().optional().nullable(),
      valorVentaUF: z.string().optional().nullable(),
      presupuestoUF: z.string().optional().nullable(),
      utilizadoUF: z.string().optional().nullable(),
      utilizadoUFPorc: z.string().optional().nullable(),
      presupuestoHH: z.string().optional().nullable(),
      capacityHH: z.string().optional().nullable(),
      hhPorcUtilizado: z.string().optional().nullable(),
      margenBrutoNotaVentaUF: z.string().optional().nullable(),
      porcentajeAvanceProyecto: z.string().optional().nullable(),
      costoProyectadoUF: z.string().optional().nullable(),
      margenProyectadoUF: z.string().optional().nullable(),
      margenProyectadoPorc: z.string().optional().nullable(),
      margenTargetPorc: z.string().optional().nullable(),
      capacityU: z.string().optional().nullable(),
      planificadoUF: z.string().optional().nullable(),
      proyectadoUF: z.string().optional().nullable(),
      margenProyectadoSegunCapacity: z.string().optional().nullable(),
      notas: z.string().optional().nullable(),
      otrosCostosUF: z.string().optional().nullable(),
      lineaNegocio: z.string().optional().nullable(),
    })),
  })).mutation(async ({ input, ctx }) => {
    const count = await bulkUpsertFinancialData(input.rows as any[]);
    await audit(ctx, "sync_financial_data", "financial_data", null, null, { rowCount: count });
    return { synced: count };
  }),
});

// ==================== PROFILE ROUTER ====================
const profileRouter = router({
  /** Get current user's profile with stats and recent activity */
  me: protectedProcedure.query(async ({ ctx }) => {
    const data = await getMyProfileData(ctx.user.id);
    if (!data) throw new TRPCError({ code: "NOT_FOUND", message: "Perfil no encontrado" });
    return data;
  }),
});
// ==================== APP ROUTER ====================
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  users: usersRouter,
  profile: profileRouter,
  projects: projectsRouter,
  stages: stagesRouter,
  sow: sowRouter,
  risks: risksRouter,
  wbs: wbsRouter,
  advance: advanceRouter,
  closure: closureRouter,
  jira: jiraRouter,
  deadlines: deadlinesRouter,
  holidays: holidaysRouter,
  stageOpenings: stageOpeningsRouter,
  extensions: extensionsRouter,
  deadlineNotifications: deadlineNotificationsRouter,
  compliance: complianceRouter,
  audit: auditRouter,
  financial: financialRouter,
  recurringServices: recurringServicesRouter,
});

export type AppRouter = typeof appRouter;
