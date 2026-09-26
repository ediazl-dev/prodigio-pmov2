import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { DOCUMENT_ENTITY_TYPES, DOCUMENT_GOVERNANCE_POLICY_VERSION, DOCUMENT_REQUIREMENT_CODES } from "../shared/documentGovernance";
import { protectedProcedure, router } from "./_core/trpc";
import { createAuditLog, getProjectById } from "./db";
import { assessDocumentArtifactAccess, validateDocumentArtifactUpload, validateDocumentDecision } from "./documentArtifactPolicy";
import { listDocumentGovernanceContext, listDocumentRequirementCatalog } from "./documentGovernanceDb";
import {
  appendDocumentValidationDecision,
  archiveDocumentArtifact,
  createDocumentArtifact,
  findDocumentArtifactBySha,
  getDocumentArtifactById,
  replaceDocumentRequirementResolution,
  saveDocumentWorkPlanSnapshot,
} from "./documentGovernanceRepository";
import { getRecurringServiceById } from "./recurringServicesDb";
import { storageGet, storagePut } from "./storage";

const entityTypeSchema = z.enum(DOCUMENT_ENTITY_TYPES);
const requirementCodeSchema = z.enum(DOCUMENT_REQUIREMENT_CODES);

async function loadEntity(entityType: z.infer<typeof entityTypeSchema>, entityId: number) {
  if (entityType === "project") {
    const project = await getProjectById(entityId);
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Proyecto no encontrado." });
    return { name: project.projectName, assignedPmId: project.pmId ?? null };
  }
  const service = await getRecurringServiceById(entityId);
  if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "Servicio recurrente no encontrado." });
  return { name: service.serviceName, assignedPmId: service.pmId ?? null };
}

function assertAccess(input: {
  action: "read" | "upload" | "validate" | "not_applicable";
  user: { id: number; role: string };
  assignedPmId?: number | null;
}) {
  const result = assessDocumentArtifactAccess({ action: input.action, actor: input.user, assignedPmId: input.assignedPmId });
  if (!result.allowed) throw new TRPCError({ code: "FORBIDDEN", message: result.reason ?? "Acceso denegado." });
}

function audit(
  user: { id: number; name: string | null; role: string },
  action: string,
  entityType: string,
  entityId: number,
  entityName: string,
  details: Record<string, unknown>,
) {
  return createAuditLog({
    action,
    entity: entityType,
    entityId,
    entityName,
    userId: user.id,
    userName: user.name ?? "Unknown",
    userRole: user.role,
    details,
  });
}

function asBadRequest(error: unknown): never {
  if (error instanceof TRPCError) throw error;
  throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Operación documental inválida." });
}

export const documentGovernanceRouter = router({
  catalog: protectedProcedure
    .input(z.object({ entityType: entityTypeSchema }))
    .query(({ input }) => listDocumentRequirementCatalog(input.entityType)),

  dossier: protectedProcedure
    .input(z.object({ entityType: entityTypeSchema, entityId: z.number().int().positive() }))
    .query(async ({ input }) => {
      await loadEntity(input.entityType, input.entityId);
      return listDocumentGovernanceContext(input.entityType, input.entityId);
    }),

  upload: protectedProcedure
    .input(z.object({
      entityType: entityTypeSchema,
      entityId: z.number().int().positive(),
      requirementCode: requirementCodeSchema,
      fileName: z.string().trim().min(1).max(500),
      mimeType: z.string().trim().min(1).max(150),
      fileBase64: z.string().min(4).max(36_000_000),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await loadEntity(input.entityType, input.entityId);
      assertAccess({ action: "upload", user: ctx.user, assignedPmId: entity.assignedPmId });
      try {
        const validated = validateDocumentArtifactUpload(input);
        const duplicate = await findDocumentArtifactBySha({
          entityType: input.entityType,
          entityId: input.entityId,
          requirementCode: input.requirementCode,
          sha256: validated.sha256,
        });
        if (duplicate) return { artifactId: duplicate.id, version: duplicate.version, duplicate: true };
        await storagePut(validated.storageKey, validated.buffer, validated.mimeType);
        const created = await createDocumentArtifact({
          entityType: input.entityType,
          entityId: input.entityId,
          requirementCode: input.requirementCode,
          sourceKind: "platform_upload",
          fileName: validated.fileName,
          fileUrl: null,
          fileKey: validated.storageKey,
          mimeType: validated.mimeType,
          sizeBytes: validated.fileSize,
          sha256: validated.sha256,
          uploadedBy: ctx.user.id,
          uploadedByName: ctx.user.name ?? "Unknown",
        });
        await audit(ctx.user, "document_artifact_upload", input.entityType, input.entityId, entity.name, {
          artifactId: created.artifactId,
          requirementCode: input.requirementCode,
          version: created.version,
          fileName: validated.fileName,
          sizeBytes: validated.fileSize,
          sha256: validated.sha256,
        });
        return { ...created, duplicate: false };
      } catch (error) {
        asBadRequest(error);
      }
    }),

  decide: protectedProcedure
    .input(z.object({
      artifactId: z.number().int().positive(),
      decision: z.enum(["valid", "rejected", "revoked"]),
      validFrom: z.string().date().nullable().optional(),
      validUntil: z.string().date().nullable().optional(),
      openEndedValidity: z.boolean().default(false),
      reason: z.string().trim().max(5000).nullable().optional(),
      costingChecklist: z.record(z.string(), z.boolean()).nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const artifact = await getDocumentArtifactById(input.artifactId);
      if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado." });
      const entity = await loadEntity(artifact.entityType, artifact.entityId);
      assertAccess({ action: "validate", user: ctx.user, assignedPmId: entity.assignedPmId });
      try {
        const policyResult = validateDocumentDecision({
          requirementCode: artifact.requirementCode,
          decision: input.decision,
          reason: input.reason,
          validFrom: input.validFrom,
          validUntil: input.validUntil,
          openEndedValidity: input.openEndedValidity,
          costingChecklist: input.costingChecklist,
        });
        const result = await appendDocumentValidationDecision(artifact.id, {
          policyVersion: DOCUMENT_GOVERNANCE_POLICY_VERSION,
          decision: input.decision,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
          openEndedValidity: input.openEndedValidity,
          costingStatus: policyResult.costingStatus,
          checklist: input.costingChecklist ?? null,
          reason: input.reason ?? null,
          decidedBy: ctx.user.id,
          decidedByName: ctx.user.name ?? "Unknown",
        });
        await audit(ctx.user, "document_validation_decision", artifact.entityType, artifact.entityId, entity.name, {
          artifactId: artifact.id,
          requirementCode: artifact.requirementCode,
          decision: input.decision,
          validFrom: input.validFrom ?? null,
          validUntil: input.validUntil ?? null,
          openEndedValidity: input.openEndedValidity,
          costingStatus: policyResult.costingStatus,
        });
        return { decisionId: result.decisionId };
      } catch (error) {
        asBadRequest(error);
      }
    }),

  archive: protectedProcedure
    .input(z.object({ artifactId: z.number().int().positive(), reason: z.string().trim().min(5).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const artifact = await getDocumentArtifactById(input.artifactId);
      if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado." });
      const entity = await loadEntity(artifact.entityType, artifact.entityId);
      assertAccess({ action: "validate", user: ctx.user, assignedPmId: entity.assignedPmId });
      const archived = await archiveDocumentArtifact({
        artifactId: artifact.id,
        policyVersion: DOCUMENT_GOVERNANCE_POLICY_VERSION,
        reason: input.reason,
        decidedBy: ctx.user.id,
        decidedByName: ctx.user.name ?? "Unknown",
      });
      await audit(ctx.user, "document_artifact_archive", artifact.entityType, artifact.entityId, entity.name, {
        artifactId: artifact.id,
        requirementCode: artifact.requirementCode,
        reason: input.reason,
      });
      return { artifactId: archived.id, status: archived.artifactStatus };
    }),

  setApplicability: protectedProcedure
    .input(z.object({
      entityType: entityTypeSchema,
      entityId: z.number().int().positive(),
      requirementCode: requirementCodeSchema,
      applicability: z.enum(["required", "not_applicable", "unconfirmed"]),
      reason: z.string().trim().min(10).max(5000),
      evidenceArtifactId: z.number().int().positive().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await loadEntity(input.entityType, input.entityId);
      assertAccess({ action: input.applicability === "not_applicable" ? "not_applicable" : "validate", user: ctx.user, assignedPmId: entity.assignedPmId });
      if (input.applicability === "not_applicable" && !input.evidenceArtifactId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "La excepción requiere un documento de evidencia." });
      }
      if (input.evidenceArtifactId) {
        const evidence = await getDocumentArtifactById(input.evidenceArtifactId);
        if (!evidence || evidence.entityType !== input.entityType || evidence.entityId !== input.entityId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "La evidencia no pertenece al expediente indicado." });
        }
      }
      const resolutionId = await replaceDocumentRequirementResolution({
        ...input,
        evidenceArtifactId: input.evidenceArtifactId ?? null,
        policyVersion: DOCUMENT_GOVERNANCE_POLICY_VERSION,
        decidedBy: ctx.user.id,
        decidedByName: ctx.user.name ?? "Unknown",
      });
      await audit(ctx.user, "document_requirement_resolution", input.entityType, input.entityId, entity.name, {
        resolutionId,
        requirementCode: input.requirementCode,
        applicability: input.applicability,
        evidenceArtifactId: input.evidenceArtifactId ?? null,
      });
      return { resolutionId };
    }),

  attachWorkPlanSnapshot: protectedProcedure
    .input(z.object({
      artifactId: z.number().int().positive(),
      entityType: entityTypeSchema,
      entityId: z.number().int().positive(),
      sourceType: z.enum(["gantt", "wbs", "jira", "combined", "manual"]),
      sourceReference: z.string().trim().max(2000).nullable().optional(),
      milestones: z.array(z.object({
        key: z.string().trim().min(1).max(100),
        title: z.string().trim().min(1).max(500),
        baselineDate: z.string().date().nullable().optional(),
        plannedDate: z.string().date().nullable().optional(),
        source: z.string().trim().min(1).max(100),
      })).min(1).max(500),
    }))
    .mutation(async ({ ctx, input }) => {
      const entity = await loadEntity(input.entityType, input.entityId);
      assertAccess({ action: "upload", user: ctx.user, assignedPmId: entity.assignedPmId });
      try {
        const snapshotId = await saveDocumentWorkPlanSnapshot({
          ...input,
          milestoneCount: input.milestones.length,
          createdBy: ctx.user.id,
          createdByName: ctx.user.name ?? "Unknown",
        });
        await audit(ctx.user, "document_work_plan_snapshot", input.entityType, input.entityId, entity.name, {
          artifactId: input.artifactId,
          snapshotId,
          sourceType: input.sourceType,
          milestoneCount: input.milestones.length,
        });
        return { snapshotId };
      } catch (error) {
        asBadRequest(error);
      }
    }),

  download: protectedProcedure
    .input(z.object({ artifactId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const artifact = await getDocumentArtifactById(input.artifactId);
      if (!artifact) throw new TRPCError({ code: "NOT_FOUND", message: "Documento no encontrado." });
      const entity = await loadEntity(artifact.entityType, artifact.entityId);
      assertAccess({ action: "read", user: ctx.user, assignedPmId: entity.assignedPmId });
      if (!artifact.fileKey) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "El archivo físico no está disponible; sólo existe una referencia legacy." });
      const signed = await storageGet(artifact.fileKey);
      await audit(ctx.user, "document_artifact_download", artifact.entityType, artifact.entityId, entity.name, {
        artifactId: artifact.id,
        requirementCode: artifact.requirementCode,
        fileName: artifact.fileName,
      });
      return { artifactId: artifact.id, fileName: artifact.fileName, url: signed.url };
    }),
});
