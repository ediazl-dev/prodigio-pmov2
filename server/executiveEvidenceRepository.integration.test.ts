import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  executiveCommitments,
  executiveContractMilestones,
  executiveEvidenceUploads,
  executiveMeetingMinutes,
  executiveMilestoneAcceptances,
  executiveProjectSources,
  executiveRecoveryPlans,
  projects,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  attachExecutiveMilestoneAcceptanceWithReceipt,
  attachExecutiveMinuteWithReceipt,
  attachExecutiveRecoveryPlanWithReceipt,
  createExecutiveEvidenceUploadReceipt,
} from "./executiveEvidenceRepository";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("executive evidence repository — integración transaccional", () => {
  let projectId: number | null = null;

  afterEach(async () => {
    if (!projectId) return;
    const db = await getDb();
    if (!db) return;
    await db.delete(executiveCommitments).where(eq(executiveCommitments.projectId, projectId));
    await db.delete(executiveMilestoneAcceptances).where(eq(executiveMilestoneAcceptances.projectId, projectId));
    await db.delete(executiveMeetingMinutes).where(eq(executiveMeetingMinutes.projectId, projectId));
    await db.delete(executiveRecoveryPlans).where(eq(executiveRecoveryPlans.projectId, projectId));
    await db.delete(executiveEvidenceUploads).where(eq(executiveEvidenceUploads.projectId, projectId));
    await db.delete(executiveContractMilestones).where(eq(executiveContractMilestones.projectId, projectId));
    await db.delete(executiveProjectSources).where(eq(executiveProjectSources.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    projectId = null;
  });

  it("adjunta minuta, acta y PRD al mismo proyecto y evita reutilizar un recibo", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL no disponible");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [projectResult] = await db.insert(projects).values({
      projectName: `[TEST] Evidencia ejecutiva ${suffix}`,
      clientName: "Fixture aislado",
      status: "activo",
      currentStage: "design",
    });
    projectId = Number(projectResult.insertId);
    const [sourceResult] = await db.insert(executiveProjectSources).values({
      projectId,
      dealId: `TEST-${suffix}`,
      jiraProjectKey: `TST${String(projectId).slice(-5)}`,
      baselineVersion: "test-v1",
      contractFileName: "baseline-test.pdf",
      contractFileUrl: "https://storage.example.test/baseline-test.pdf",
      sourceStatus: "approved",
      approvedAt: new Date(),
      approvedBy: 1,
      approvedByName: "Vitest",
    });
    const sourceId = Number(sourceResult.insertId);
    const [milestoneResult] = await db.insert(executiveContractMilestones).values({
      projectId,
      sourceId,
      milestoneCode: "M-TEST",
      title: "Hito aislado",
      billingWeight: "100.00",
      jiraIssueKey: `TST-${String(projectId).slice(-5)}`,
      semanticStatus: "fulfilled",
    });
    const milestoneId = Number(milestoneResult.insertId);

    const makeReceipt = async (documentType: "minute" | "acceptance" | "recovery_plan") => {
      const token = `${documentType}-${suffix}`;
      await createExecutiveEvidenceUploadReceipt({
        receiptToken: token,
        projectId: projectId!,
        sourceId,
        documentType,
        fileName: `${documentType}.pdf`,
        fileKey: `tests/executive-evidence/${token}.pdf`,
        fileUrl: `https://storage.example.test/${token}.pdf`,
        fileSha256: "a".repeat(64),
        mimeType: "application/pdf",
        sizeBytes: 128,
        uploadStatus: "pending",
        uploadedBy: 1,
        uploadedByName: "Vitest",
      });
      return token;
    };

    const minuteToken = await makeReceipt("minute");
    const minute = await attachExecutiveMinuteWithReceipt({
      receiptToken: minuteToken,
      projectId,
      sourceId,
      meetingDate: "2026-09-22",
      isoWeek: "2026-W39",
      title: "Comité aislado",
      commitments: [{ title: "Compromiso verificable", ownerName: "PM" }],
      actorId: 1,
      actorName: "Vitest",
    });
    expect(minute.commitmentIds).toHaveLength(1);
    await expect(attachExecutiveMinuteWithReceipt({
      receiptToken: minuteToken,
      projectId,
      sourceId,
      meetingDate: "2026-09-22",
      isoWeek: "2026-W39",
      title: "Reintento inválido",
      commitments: [],
      actorId: 1,
      actorName: "Vitest",
    })).rejects.toMatchObject({ code: "RECEIPT_ALREADY_ATTACHED" });

    const acceptanceToken = await makeReceipt("acceptance");
    const acceptance = await attachExecutiveMilestoneAcceptanceWithReceipt({
      receiptToken: acceptanceToken,
      projectId,
      sourceId,
      milestoneId,
      acceptedAt: "2026-09-22",
      actorId: 1,
      actorName: "Vitest",
    });
    expect(acceptance.id).toBeGreaterThan(0);

    const recoveryToken = await makeReceipt("recovery_plan");
    const recovery = await attachExecutiveRecoveryPlanWithReceipt({
      receiptToken: recoveryToken,
      projectId,
      sourceId,
      version: "v-test",
      dueDate: "2026-10-01",
      summary: "Plan aislado de recuperación",
      actorId: 1,
      actorName: "Vitest",
    });
    expect(recovery.id).toBeGreaterThan(0);

    const receipts = await db.select().from(executiveEvidenceUploads).where(eq(executiveEvidenceUploads.projectId, projectId));
    expect(receipts).toHaveLength(3);
    expect(receipts.every(receipt => receipt.uploadStatus === "attached" && receipt.attachedEntityId != null)).toBe(true);
  });
});
