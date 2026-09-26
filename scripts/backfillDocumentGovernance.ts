import { createHash } from "node:crypto";
import {
  documentArtifacts,
  executiveContractMilestones,
  executiveProjectSources,
  ganttUploads,
  linkedProjectDocuments,
  projects,
  recurringServiceDocuments,
  sowDocuments,
  wbsTasks,
} from "../drizzle/schema";
import type { DocumentRequirementCode } from "../shared/documentGovernance";
import { getDb } from "../server/db";
import { createDocumentArtifact, saveDocumentWorkPlanSnapshot } from "../server/documentGovernanceRepository";

const APPLY = process.argv.includes("--apply");

type Candidate = {
  entityType: "project" | "recurring_service";
  entityId: number;
  requirementCode: DocumentRequirementCode;
  sourceKind: "linked_upload" | "generated" | "jira_snapshot" | "legacy_reference";
  legacySourceTable: string;
  legacySourceId: string;
  sourceReference: string;
  fileName: string;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  observedAt: Date;
  needsHumanClassification: boolean;
};

function date(value: Date | string | null | undefined) {
  const parsed = value instanceof Date ? value : value ? new Date(value) : new Date(0);
  return Number.isFinite(parsed.getTime()) ? parsed : new Date(0);
}

function extension(name: string) {
  return name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
}

function mimeFromName(name: string) {
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[extension(name)] ?? "application/octet-stream";
}

function requirementFromRecurring(docType: string): { code: DocumentRequirementCode | null; needsHumanClassification: boolean } {
  if (docType === "contrato") return { code: "contract", needsHumanClassification: false };
  if (docType === "sow") return { code: "sow", needsHumanClassification: false };
  if (docType === "propuesta_tecnica") return { code: "technical_economic_proposal", needsHumanClassification: true };
  if (docType === "pl") return { code: "costed_pnl", needsHumanClassification: true };
  return { code: null, needsHumanClassification: true };
}

function reference(candidate: Omit<Candidate, "sourceReference">) {
  return JSON.stringify({
    source: candidate.legacySourceTable,
    sourceId: candidate.legacySourceId,
    importedAsCandidate: true,
    needsHumanClassification: candidate.needsHumanClassification,
    note: "Backfill no destructivo: la referencia no acredita cumplimiento hasta validación humana.",
  });
}

function fingerprint(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [serviceDocs, linkedDocs, sowRows, ganttRows, baselineRows, projectRows, milestoneRows, wbsRows, existingArtifacts] = await Promise.all([
    db.select().from(recurringServiceDocuments),
    db.select().from(linkedProjectDocuments),
    db.select().from(sowDocuments),
    db.select().from(ganttUploads),
    db.select().from(executiveProjectSources),
    db.select().from(projects),
    db.select().from(executiveContractMilestones),
    db.select().from(wbsTasks),
    db.select().from(documentArtifacts),
  ]);

  const candidates: Candidate[] = [];
  const skipped: Array<{ source: string; id: string; reason: string }> = [];

  for (const doc of serviceDocs) {
    const mapping = requirementFromRecurring(doc.docType);
    if (!mapping.code) {
      skipped.push({ source: "recurring_service_documents", id: String(doc.id), reason: "tipo otro sin clasificación inequívoca" });
      continue;
    }
    const base = {
      entityType: "recurring_service" as const,
      entityId: doc.serviceId,
      requirementCode: mapping.code,
      sourceKind: "legacy_reference" as const,
      legacySourceTable: "recurring_service_documents",
      legacySourceId: String(doc.id),
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileKey: doc.fileKey ?? null,
      mimeType: mimeFromName(doc.fileName),
      sizeBytes: null,
      sha256: null,
      observedAt: date(doc.uploadedAt),
      needsHumanClassification: mapping.needsHumanClassification,
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  for (const doc of linkedDocs) {
    const requirementCode: DocumentRequirementCode = doc.docType === "sow" ? "sow" : "work_plan_milestones";
    const base = {
      entityType: "project" as const,
      entityId: doc.projectId,
      requirementCode,
      sourceKind: "linked_upload" as const,
      legacySourceTable: "linked_project_documents",
      legacySourceId: String(doc.id),
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      fileKey: doc.fileKey,
      mimeType: doc.mimeType ?? mimeFromName(doc.fileName),
      sizeBytes: doc.fileSize ?? null,
      sha256: doc.fileKey.match(/[a-f0-9]{64}/i)?.[0]?.toLowerCase() ?? null,
      observedAt: date(doc.createdAt),
      needsHumanClassification: false,
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  for (const sow of sowRows) {
    const url = sow.finalDocUrl ?? sow.sourcePdfUrl;
    if (!url) {
      skipped.push({ source: "sow_documents", id: String(sow.id), reason: "registro sin archivo" });
      continue;
    }
    const fileName = `SoW v${sow.version} · proyecto ${sow.projectId}.${url.toLowerCase().includes(".docx") ? "docx" : "pdf"}`;
    const base = {
      entityType: "project" as const,
      entityId: sow.projectId,
      requirementCode: "sow" as const,
      sourceKind: "generated" as const,
      legacySourceTable: "sow_documents",
      legacySourceId: String(sow.id),
      fileName,
      fileUrl: url,
      fileKey: null,
      mimeType: mimeFromName(fileName),
      sizeBytes: null,
      sha256: null,
      observedAt: date(sow.approvedAt ?? sow.updatedAt ?? sow.createdAt),
      needsHumanClassification: sow.status !== "approved",
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  for (const gantt of ganttRows) {
    const base = {
      entityType: "project" as const,
      entityId: gantt.projectId,
      requirementCode: "work_plan_milestones" as const,
      sourceKind: "generated" as const,
      legacySourceTable: "gantt_uploads",
      legacySourceId: String(gantt.id),
      fileName: gantt.fileName,
      fileUrl: gantt.fileUrl,
      fileKey: null,
      mimeType: mimeFromName(gantt.fileName),
      sizeBytes: null,
      sha256: null,
      observedAt: date(gantt.createdAt),
      needsHumanClassification: false,
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  for (const baseline of baselineRows) {
    const base = {
      entityType: "project" as const,
      entityId: baseline.projectId,
      requirementCode: "work_plan_milestones" as const,
      sourceKind: "generated" as const,
      legacySourceTable: "executive_project_sources",
      legacySourceId: String(baseline.id),
      fileName: baseline.contractFileName,
      fileUrl: baseline.contractFileUrl,
      fileKey: null,
      mimeType: mimeFromName(baseline.contractFileName),
      sizeBytes: null,
      sha256: baseline.contractSha256 ?? null,
      observedAt: date(baseline.approvedAt ?? baseline.createdAt),
      needsHumanClassification: baseline.sourceStatus !== "approved",
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  const projectMilestones = new Map<number, Array<{ key: string; title: string; baselineDate: string | null; plannedDate: string | null; source: string }>>();
  for (const row of milestoneRows) {
    const list = projectMilestones.get(row.projectId) ?? [];
    list.push({ key: row.milestoneCode, title: row.title, baselineDate: row.baselineDate ?? null, plannedDate: row.jiraDueDate ?? null, source: `executive_contract_milestones:${row.id}` });
    projectMilestones.set(row.projectId, list);
  }
  for (const row of wbsRows.filter(item => item.issueLevel === "milestone")) {
    const list = projectMilestones.get(row.projectId) ?? [];
    if (!list.some(item => item.key === (row.jiraIssueKey ?? row.taskCode ?? String(row.id)))) {
      list.push({ key: row.jiraIssueKey ?? row.taskCode ?? String(row.id), title: row.taskName, baselineDate: null, plannedDate: null, source: `wbs_tasks:${row.id}` });
    }
    projectMilestones.set(row.projectId, list);
  }

  for (const project of projectRows) {
    const milestones = projectMilestones.get(project.id) ?? [];
    if (!project.jiraProjectKey || milestones.length === 0) continue;
    const sha256 = fingerprint({ projectId: project.id, jiraProjectKey: project.jiraProjectKey, milestones });
    const base = {
      entityType: "project" as const,
      entityId: project.id,
      requirementCode: "work_plan_milestones" as const,
      sourceKind: "jira_snapshot" as const,
      legacySourceTable: "jira_work_plan_snapshot",
      legacySourceId: `${project.id}:${sha256}`,
      fileName: `Plan de trabajo · snapshot Jira ${project.jiraProjectKey}`,
      fileUrl: null,
      fileKey: null,
      mimeType: "application/json",
      sizeBytes: Buffer.byteLength(JSON.stringify(milestones)),
      sha256,
      observedAt: new Date("2026-09-26T00:00:00.000Z"),
      needsHumanClassification: false,
    };
    candidates.push({ ...base, sourceReference: reference(base) });
  }

  const existingLegacy = new Set(existingArtifacts.filter(row => row.legacySourceTable && row.legacySourceId).map(row => `${row.legacySourceTable}:${row.legacySourceId}`));
  const seenReferences = new Set<string>();
  const pending = candidates
    .sort((left, right) => left.observedAt.getTime() - right.observedAt.getTime() || left.legacySourceTable.localeCompare(right.legacySourceTable) || left.legacySourceId.localeCompare(right.legacySourceId))
    .filter(candidate => {
      const legacyKey = `${candidate.legacySourceTable}:${candidate.legacySourceId}`;
      if (existingLegacy.has(legacyKey)) {
        skipped.push({ source: candidate.legacySourceTable, id: candidate.legacySourceId, reason: "ya importado" });
        return false;
      }
      const referenceKey = `${candidate.entityType}:${candidate.entityId}:${candidate.requirementCode}:${candidate.fileKey ?? candidate.fileUrl ?? candidate.sha256 ?? legacyKey}`;
      if (seenReferences.has(referenceKey)) {
        skipped.push({ source: candidate.legacySourceTable, id: candidate.legacySourceId, reason: "referencia duplicada dentro del mismo requisito" });
        return false;
      }
      seenReferences.add(referenceKey);
      return true;
    });

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    candidates: candidates.length,
    pending: pending.length,
    skipped: skipped.length,
    byEntity: Object.fromEntries(["project", "recurring_service"].map(entity => [entity, pending.filter(item => item.entityType === entity).length])),
    byRequirement: Object.fromEntries(["contract", "sow", "technical_economic_proposal", "costed_pnl", "work_plan_milestones"].map(code => [code, pending.filter(item => item.requirementCode === code).length])),
    needsHumanClassification: pending.filter(item => item.needsHumanClassification).length,
  };

  if (!APPLY) {
    console.log(JSON.stringify({ ...summary, skippedByReason: Object.fromEntries([...new Set(skipped.map(item => item.reason))].map(reason => [reason, skipped.filter(item => item.reason === reason).length])) }, null, 2));
    return;
  }

  const created: Array<{ artifactId: number; entityType: string; entityId: number; requirementCode: string; legacySource: string; snapshotId: number | null }> = [];
  for (const candidate of pending) {
    const result = await createDocumentArtifact({
      entityType: candidate.entityType,
      entityId: candidate.entityId,
      requirementCode: candidate.requirementCode,
      sourceKind: candidate.sourceKind,
      legacySourceTable: candidate.legacySourceTable,
      legacySourceId: candidate.legacySourceId,
      sourceReference: candidate.sourceReference,
      fileName: candidate.fileName,
      fileUrl: candidate.fileUrl,
      fileKey: candidate.fileKey,
      mimeType: candidate.mimeType,
      sizeBytes: candidate.sizeBytes,
      sha256: candidate.sha256,
      observedAt: candidate.observedAt,
      uploadedBy: null,
      uploadedByName: "Backfill documental v1",
    });
    let snapshotId: number | null = null;
    if (candidate.requirementCode === "work_plan_milestones") {
      const milestones = projectMilestones.get(candidate.entityId) ?? [];
      if (milestones.length) {
        snapshotId = await saveDocumentWorkPlanSnapshot({
          artifactId: result.artifactId,
          entityType: "project",
          entityId: candidate.entityId,
          sourceType: candidate.sourceKind === "jira_snapshot" ? "jira" : "combined",
          sourceReference: candidate.sourceReference,
          milestoneCount: milestones.length,
          milestones,
          createdBy: 0,
          createdByName: "Backfill documental v1",
        });
      }
    }
    created.push({ artifactId: result.artifactId, entityType: candidate.entityType, entityId: candidate.entityId, requirementCode: candidate.requirementCode, legacySource: `${candidate.legacySourceTable}:${candidate.legacySourceId}`, snapshotId });
  }

  const countsAfter = await db.select().from(documentArtifacts);
  console.log(JSON.stringify({ ...summary, created: created.length, snapshotsCreated: created.filter(item => item.snapshotId != null).length, totalArtifactsAfter: countsAfter.length }, null, 2));
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
