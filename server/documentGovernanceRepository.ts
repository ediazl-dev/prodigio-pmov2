import { and, desc, eq, max } from "drizzle-orm";
import {
  documentArtifacts,
  documentRequirementResolutions,
  documentValidationDecisions,
  documentWorkPlanSnapshots,
  type InsertDocumentArtifact,
  type InsertDocumentValidationDecision,
} from "../drizzle/schema";
import type { DocumentGovernanceEntityType, DocumentRequirementCode } from "../shared/documentGovernance";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export async function getDocumentArtifactById(id: number) {
  const db = await requireDb();
  const [artifact] = await db.select().from(documentArtifacts).where(eq(documentArtifacts.id, id)).limit(1);
  return artifact ?? null;
}

export async function findDocumentArtifactBySha(input: {
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  requirementCode: DocumentRequirementCode;
  sha256: string;
}) {
  const db = await requireDb();
  const [artifact] = await db
    .select()
    .from(documentArtifacts)
    .where(and(
      eq(documentArtifacts.entityType, input.entityType),
      eq(documentArtifacts.entityId, input.entityId),
      eq(documentArtifacts.requirementCode, input.requirementCode),
      eq(documentArtifacts.sha256, input.sha256),
      eq(documentArtifacts.artifactStatus, "active"),
    ))
    .orderBy(desc(documentArtifacts.version))
    .limit(1);
  return artifact ?? null;
}

export async function createDocumentArtifact(input: Omit<InsertDocumentArtifact, "version" | "artifactStatus" | "supersedesArtifactId">) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [versionRow] = await tx
      .select({ maxVersion: max(documentArtifacts.version) })
      .from(documentArtifacts)
      .where(and(
        eq(documentArtifacts.entityType, input.entityType),
        eq(documentArtifacts.entityId, input.entityId),
        eq(documentArtifacts.requirementCode, input.requirementCode),
      ));
    const version = Number(versionRow?.maxVersion ?? 0) + 1;
    const [previous] = await tx
      .select({ id: documentArtifacts.id })
      .from(documentArtifacts)
      .where(and(
        eq(documentArtifacts.entityType, input.entityType),
        eq(documentArtifacts.entityId, input.entityId),
        eq(documentArtifacts.requirementCode, input.requirementCode),
        eq(documentArtifacts.artifactStatus, "active"),
      ))
      .orderBy(desc(documentArtifacts.version))
      .limit(1);
    if (previous) {
      await tx.update(documentArtifacts)
        .set({ artifactStatus: "superseded" })
        .where(eq(documentArtifacts.id, previous.id));
    }
    const [result] = await tx.insert(documentArtifacts).values({
      ...input,
      version,
      artifactStatus: "active",
      supersedesArtifactId: previous?.id ?? null,
    });
    const artifactId = Number(result.insertId);
    await tx.insert(documentValidationDecisions).values({
      artifactId,
      entityType: input.entityType,
      entityId: input.entityId,
      requirementCode: input.requirementCode,
      policyVersion: "2026-09-26.v1",
      decision: "pending",
      costingStatus: input.requirementCode === "costed_pnl" ? "pending" : "not_applicable",
      reason: "Documento cargado; pendiente de revisión.",
      decidedBy: input.uploadedBy ?? null,
      decidedByName: input.uploadedByName ?? null,
    });
    return { artifactId, version, supersedesArtifactId: previous?.id ?? null };
  });
}

export async function appendDocumentValidationDecision(
  artifactId: number,
  decision: Omit<InsertDocumentValidationDecision, "artifactId" | "entityType" | "entityId" | "requirementCode">,
) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [artifact] = await tx.select().from(documentArtifacts).where(eq(documentArtifacts.id, artifactId)).limit(1);
    if (!artifact) throw new Error("Documento no encontrado.");
    if (artifact.artifactStatus !== "active") throw new Error("Sólo la versión activa puede recibir una decisión.");
    const [result] = await tx.insert(documentValidationDecisions).values({
      ...decision,
      artifactId,
      entityType: artifact.entityType,
      entityId: artifact.entityId,
      requirementCode: artifact.requirementCode,
    });
    return { decisionId: Number(result.insertId), artifact };
  });
}

export async function archiveDocumentArtifact(input: {
  artifactId: number;
  policyVersion: string;
  reason: string;
  decidedBy: number;
  decidedByName: string;
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [artifact] = await tx.select().from(documentArtifacts).where(eq(documentArtifacts.id, input.artifactId)).limit(1);
    if (!artifact) throw new Error("Documento no encontrado.");
    if (artifact.artifactStatus === "archived") return artifact;
    await tx.update(documentArtifacts).set({ artifactStatus: "archived" }).where(eq(documentArtifacts.id, input.artifactId));
    await tx.insert(documentValidationDecisions).values({
      artifactId: artifact.id,
      entityType: artifact.entityType,
      entityId: artifact.entityId,
      requirementCode: artifact.requirementCode,
      policyVersion: input.policyVersion,
      decision: "revoked",
      costingStatus: artifact.requirementCode === "costed_pnl" ? "rejected" : "not_applicable",
      reason: input.reason,
      decidedBy: input.decidedBy,
      decidedByName: input.decidedByName,
    });
    return { ...artifact, artifactStatus: "archived" as const };
  });
}

export async function replaceDocumentRequirementResolution(input: {
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  requirementCode: DocumentRequirementCode;
  policyVersion: string;
  applicability: "required" | "not_applicable" | "unconfirmed";
  reason: string;
  evidenceArtifactId: number | null;
  decidedBy: number;
  decidedByName: string;
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.update(documentRequirementResolutions)
      .set({ active: false })
      .where(and(
        eq(documentRequirementResolutions.entityType, input.entityType),
        eq(documentRequirementResolutions.entityId, input.entityId),
        eq(documentRequirementResolutions.requirementCode, input.requirementCode),
        eq(documentRequirementResolutions.policyVersion, input.policyVersion),
        eq(documentRequirementResolutions.active, true),
      ));
    const [result] = await tx.insert(documentRequirementResolutions).values({ ...input, active: true });
    return Number(result.insertId);
  });
}

export async function saveDocumentWorkPlanSnapshot(input: {
  artifactId: number;
  entityType: DocumentGovernanceEntityType;
  entityId: number;
  sourceType: "gantt" | "wbs" | "jira" | "combined" | "manual";
  sourceReference?: string | null;
  milestoneCount: number;
  milestones: unknown;
  createdBy: number;
  createdByName: string;
}) {
  const db = await requireDb();
  const [artifact] = await db.select().from(documentArtifacts).where(eq(documentArtifacts.id, input.artifactId)).limit(1);
  if (!artifact) throw new Error("Documento no encontrado.");
  if (artifact.entityType !== input.entityType || artifact.entityId !== input.entityId || artifact.requirementCode !== "work_plan_milestones") {
    throw new Error("El snapshot no corresponde al expediente o requisito indicado.");
  }
  const [result] = await db.insert(documentWorkPlanSnapshots).values({ ...input, milestones: input.milestones as any });
  return Number(result.insertId);
}
