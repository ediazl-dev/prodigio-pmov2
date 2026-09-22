import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { executiveEvidenceUploads, executiveProjectSources, projects } from "../drizzle/schema";
import { getDb } from "./db";
import {
  discardExecutiveEvidenceReceipt,
  getExecutiveEvidenceAdminSummary,
  listExecutiveEvidenceAdmin,
} from "./executiveEvidenceAdmin";
import { createExecutiveEvidenceUploadReceipt } from "./executiveEvidenceRepository";
import { assessExecutiveEvidenceReceipt } from "./executiveEvidenceReceipt";

const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

describeDb("executive evidence admin — historial y descarte", () => {
  let projectId: number | null = null;

  afterEach(async () => {
    if (!projectId) return;
    const db = await getDb();
    if (!db) return;
    await db.delete(executiveEvidenceUploads).where(eq(executiveEvidenceUploads.projectId, projectId));
    await db.delete(executiveProjectSources).where(eq(executiveProjectSources.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    projectId = null;
  });

  it("lista un pendiente, lo descarta una sola vez y lo invalida para adjuntar", async () => {
    const db = await getDb();
    if (!db) throw new Error("DATABASE_URL no disponible");
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const [projectResult] = await db.insert(projects).values({
      projectName: `[TEST] Historial evidencia ${suffix}`,
      clientName: "Fixture aislado",
      status: "activo",
      currentStage: "design",
    });
    projectId = Number(projectResult.insertId);
    const [sourceResult] = await db.insert(executiveProjectSources).values({
      projectId,
      dealId: `TEST-${suffix}`,
      jiraProjectKey: `TEH${String(projectId).slice(-5)}`,
      baselineVersion: "test-v1",
      contractFileName: "baseline-test.pdf",
      contractFileUrl: "https://storage.example.test/baseline-test.pdf",
      sourceStatus: "approved",
      approvedAt: new Date(),
      approvedBy: 1,
      approvedByName: "Vitest",
    });
    const sourceId = Number(sourceResult.insertId);
    const receiptToken = `admin-${suffix}`;
    const receipt = await createExecutiveEvidenceUploadReceipt({
      receiptToken,
      projectId,
      sourceId,
      documentType: "minute",
      fileName: "minuta-pendiente.pdf",
      fileKey: `tests/executive-evidence/${receiptToken}.pdf`,
      fileUrl: `https://storage.example.test/${receiptToken}.pdf`,
      fileSha256: "b".repeat(64),
      mimeType: "application/pdf",
      sizeBytes: 256,
      uploadStatus: "pending",
      uploadedBy: 1,
      uploadedByName: "Vitest",
    });

    const before = await listExecutiveEvidenceAdmin({ page: 1, pageSize: 20, status: "pending", projectId });
    expect(before.total).toBe(1);
    expect(before.items[0]).toMatchObject({ id: receipt.id, status: "pending", canDiscard: true });

    const summary = await getExecutiveEvidenceAdminSummary();
    expect(summary.pending).toBeGreaterThanOrEqual(1);

    const discarded = await discardExecutiveEvidenceReceipt({ id: receipt.id, actorId: 99, actorName: "Admin Test", reason: "Archivo duplicado" });
    expect(discarded.outcome).toBe("discarded");
    const secondAttempt = await discardExecutiveEvidenceReceipt({ id: receipt.id, actorId: 99, actorName: "Admin Test", reason: "Reintento" });
    expect(secondAttempt.outcome).toBe("not_pending");

    const [stored] = await db.select().from(executiveEvidenceUploads).where(eq(executiveEvidenceUploads.id, receipt.id));
    expect(stored).toMatchObject({ discardedBy: 99, discardedByName: "Admin Test", discardReason: "Archivo duplicado" });
    expect((await listExecutiveEvidenceAdmin({ page: 1, pageSize: 20, status: "pending", projectId })).total).toBe(0);
    expect((await listExecutiveEvidenceAdmin({ page: 1, pageSize: 20, status: "discarded", projectId })).total).toBe(1);
    expect((await getExecutiveEvidenceAdminSummary()).discarded).toBeGreaterThanOrEqual(1);
    expect(assessExecutiveEvidenceReceipt({
      receipt: stored,
      projectId,
      sourceId,
      documentType: "minute",
      actorId: 1,
    })).toMatchObject({ allowed: false, code: "RECEIPT_DISCARDED" });
  });
});
