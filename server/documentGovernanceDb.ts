import { and, desc, eq, inArray } from "drizzle-orm";
import {
  documentArtifacts,
  documentAssociations,
  documentRequirementCatalog,
  documentRequirementResolutions,
  documentValidationDecisions,
  documentWorkPlanSnapshots,
} from "../drizzle/schema";
import {
  DOCUMENT_GOVERNANCE_POLICY_VERSION,
  type DocumentGovernanceEntityType,
  type DocumentRequirementCode,
} from "../shared/documentGovernance";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

export async function listDocumentRequirementCatalog(
  entityType: DocumentGovernanceEntityType,
  policyVersion = DOCUMENT_GOVERNANCE_POLICY_VERSION,
) {
  const db = await requireDb();
  return db
    .select()
    .from(documentRequirementCatalog)
    .where(
      and(
        eq(documentRequirementCatalog.entityType, entityType),
        eq(documentRequirementCatalog.policyVersion, policyVersion),
      ),
    );
}

export async function listDocumentArtifactsForEntity(
  entityType: DocumentGovernanceEntityType,
  entityId: number,
  requirementCodes?: readonly DocumentRequirementCode[],
) {
  const db = await requireDb();
  const conditions = [eq(documentArtifacts.entityType, entityType), eq(documentArtifacts.entityId, entityId)];
  if (requirementCodes?.length) {
    conditions.push(inArray(documentArtifacts.requirementCode, [...requirementCodes]));
  }
  return db
    .select()
    .from(documentArtifacts)
    .where(and(...conditions))
    .orderBy(documentArtifacts.requirementCode, desc(documentArtifacts.version), desc(documentArtifacts.createdAt));
}

export async function listDocumentValidationDecisionsForArtifacts(artifactIds: number[]) {
  if (artifactIds.length === 0) return [];
  const db = await requireDb();
  return db
    .select()
    .from(documentValidationDecisions)
    .where(inArray(documentValidationDecisions.artifactId, artifactIds))
    .orderBy(documentValidationDecisions.artifactId, desc(documentValidationDecisions.decidedAt));
}

export async function listDocumentGovernanceContext(
  entityType: DocumentGovernanceEntityType,
  entityId: number,
  policyVersion = DOCUMENT_GOVERNANCE_POLICY_VERSION,
) {
  const db = await requireDb();
  const [catalog, artifacts, resolutions] = await Promise.all([
    listDocumentRequirementCatalog(entityType, policyVersion),
    listDocumentArtifactsForEntity(entityType, entityId),
    db
      .select()
      .from(documentRequirementResolutions)
      .where(
        and(
          eq(documentRequirementResolutions.entityType, entityType),
          eq(documentRequirementResolutions.entityId, entityId),
          eq(documentRequirementResolutions.policyVersion, policyVersion),
          eq(documentRequirementResolutions.active, true),
        ),
      )
      .orderBy(desc(documentRequirementResolutions.decidedAt)),
  ]);
  const artifactIds = artifacts.map(artifact => artifact.id);
  const [decisions, associations, workPlanSnapshots] = await Promise.all([
    listDocumentValidationDecisionsForArtifacts(artifactIds),
    artifactIds.length
      ? db.select().from(documentAssociations).where(inArray(documentAssociations.artifactId, artifactIds))
      : Promise.resolve([]),
    artifactIds.length
      ? db.select().from(documentWorkPlanSnapshots).where(inArray(documentWorkPlanSnapshots.artifactId, artifactIds))
      : Promise.resolve([]),
  ]);
  return { policyVersion, entityType, entityId, catalog, artifacts, decisions, resolutions, associations, workPlanSnapshots };
}
