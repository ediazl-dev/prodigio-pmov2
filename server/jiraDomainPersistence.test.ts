import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { financialData, linkedProjectDocuments, projectStages, projects, risks, wbsTasks } from "../drizzle/schema";
import {
  createLinkedProject,
  getDb,
  getJiraHomologationImportStatus,
  linkProjectToConfirmedFinancialDeal,
  upsertLinkedProjectDocument,
  upsertJiraImportedRisks,
  upsertJiraImportedWbs,
} from "./db";

const shouldRun = Boolean(process.env.DATABASE_URL) && process.env.RUN_PERSISTENT_H6_TEST === "true";
const testKey = `H6T${Date.now().toString().slice(-7)}`;
const testDealId = `TEST-${testKey}`;
let projectId: number | null = null;

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  if (projectId) {
    await db.delete(linkedProjectDocuments).where(eq(linkedProjectDocuments.projectId, projectId));
    await db.delete(risks).where(eq(risks.projectId, projectId));
    await db.delete(wbsTasks).where(eq(wbsTasks.projectId, projectId));
    await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    projectId = null;
  }
  await db.delete(financialData).where(eq(financialData.dealId, testDealId));
}

describe.runIf(shouldRun)("persistencia H6 aislada", () => {
  afterEach(cleanup);

  it("hace UPSERT por issue Jira, preserva campos PMO y vincula solo un Deal existente", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    projectId = await createLinkedProject({
      projectName: "[TEST H6] Dominios Jira aislados",
      clientName: "[TEST]",
      jiraProjectKey: testKey,
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      projectType: "otro",
    });
    await db.insert(financialData).values({
      dealId: testDealId,
      projectName: "[TEST H6] Dominios Jira aislados",
      clientName: "[TEST]",
    });

    const firstRisks = await upsertJiraImportedRisks(projectId, [{
      riskCode: "R-01",
      description: "Riesgo inicial observado",
      category: "por_confirmar",
      type: "riesgo",
      probability: "por_confirmar",
      impact: "por_confirmar",
      mitigation: null,
      owner: "Responsable Jira",
      contingency: null,
      dueDate: null,
      estimatedCost: null,
      confirmed: false,
      jiraTaskId: `${testKey}-1`,
      jiraIssueKey: `${testKey}-1`,
      jiraStatusName: "Open",
      jiraStatusCategory: "To Do",
      jiraAssigneeId: "jira-user-test",
    }]);
    const firstWbs = await upsertJiraImportedWbs(projectId, [{
      taskCode: "T-01",
      taskName: "Tarea inicial observada",
      phase: "por_confirmar",
      optimistic: null,
      pessimistic: null,
      probable: null,
      expected: null,
      isCritical: false,
      dependencies: null,
      assignee: "Responsable Jira",
      jiraTaskId: `${testKey}-2`,
      issueLevel: "task",
      epicCode: null,
      storyCode: null,
      jiraIssueKey: `${testKey}-2`,
      jiraParentKey: null,
      jiraStatusName: "Open",
      jiraStatusCategory: "To Do",
      jiraAssigneeId: "jira-user-test",
      acceptanceCriteria: null,
      storyPoints: null,
    }]);
    expect(firstRisks).toEqual({ createdCount: 1, updatedCount: 0 });
    expect(firstWbs).toEqual({ createdCount: 1, updatedCount: 0 });

    const riskRows = await db.select().from(risks).where(eq(risks.projectId, projectId));
    const wbsRows = await db.select().from(wbsTasks).where(eq(wbsTasks.projectId, projectId));
    await db.update(risks).set({ category: "tecnico", probability: "alta", impact: "alto", confirmed: true })
      .where(eq(risks.id, riskRows[0].id));
    await db.update(wbsTasks).set({ phase: "construccion", storyPoints: 5 })
      .where(eq(wbsTasks.id, wbsRows[0].id));

    const secondRisks = await upsertJiraImportedRisks(projectId, [{
      ...riskRows[0],
      description: "Riesgo actualizado desde Jira",
      owner: "Nuevo responsable Jira",
      jiraStatusName: "In Progress",
      jiraStatusCategory: "In Progress",
    }]);
    const secondWbs = await upsertJiraImportedWbs(projectId, [{
      ...wbsRows[0],
      taskName: "Tarea actualizada desde Jira",
      assignee: "Nuevo responsable Jira",
      jiraStatusName: "Done",
      jiraStatusCategory: "Done",
    }]);
    expect(secondRisks).toEqual({ createdCount: 0, updatedCount: 1 });
    expect(secondWbs).toEqual({ createdCount: 0, updatedCount: 1 });

    expect(await db.select().from(risks).where(eq(risks.projectId, projectId))).toEqual([
      expect.objectContaining({
        description: "Riesgo actualizado desde Jira",
        owner: "Nuevo responsable Jira",
        category: "tecnico",
        probability: "alta",
        impact: "alto",
        confirmed: true,
        jiraStatusName: "In Progress",
      }),
    ]);
    expect(await db.select().from(wbsTasks).where(eq(wbsTasks.projectId, projectId))).toEqual([
      expect.objectContaining({
        taskName: "Tarea actualizada desde Jira",
        assignee: "Nuevo responsable Jira",
        phase: "construccion",
        storyPoints: 5,
        jiraStatusName: "Done",
      }),
    ]);

    expect(await linkProjectToConfirmedFinancialDeal(projectId, "NO-EXISTE")).toMatchObject({
      linked: false,
      reason: expect.stringContaining("[POR CONFIRMAR]"),
    });
    expect(await linkProjectToConfirmedFinancialDeal(projectId, testDealId)).toMatchObject({ linked: true, reused: false });
    expect(await linkProjectToConfirmedFinancialDeal(projectId, testDealId)).toMatchObject({ linked: true, reused: true });
    expect(await db.select({ dealId: projects.dealId }).from(projects).where(eq(projects.id, projectId))).toEqual([{ dealId: testDealId }]);

    const documentInput = {
      projectId,
      docType: "sow" as const,
      fileName: "SoW contractual.pdf",
      fileUrl: "https://example.invalid/sow-contractual.pdf",
      fileKey: `linked-docs/${projectId}/sow/sha256-test.pdf`,
      fileSize: 128,
      mimeType: "application/pdf",
      notes: "Primera carga",
      uploadedBy: 1,
      uploadedByName: "Prueba H6",
    };
    expect(await upsertLinkedProjectDocument(documentInput)).toMatchObject({ created: true });
    expect(await upsertLinkedProjectDocument({ ...documentInput, notes: "Reintento idempotente" })).toMatchObject({ created: false });
    expect(await db.select().from(linkedProjectDocuments).where(eq(linkedProjectDocuments.projectId, projectId))).toEqual([
      expect.objectContaining({ fileKey: documentInput.fileKey, notes: "Reintento idempotente" }),
    ]);

    expect(await getJiraHomologationImportStatus(projectId)).toMatchObject({
      project: { dealId: testDealId },
      counts: {
        risks: { imported: 1, mapped: 0 },
        wbs: { imported: 1, mapped: 0 },
        documents: { sow: 1, gantt: 0, milestoneAcceptances: 0 },
      },
      pending: expect.arrayContaining(["Completar onboarding Jira", "Cargar Gantt contractual"]),
    });

    await cleanup();
    expect(await db.select({ id: projects.id }).from(projects).where(eq(projects.jiraProjectKey, testKey))).toHaveLength(0);
    expect(await db.select({ id: financialData.id }).from(financialData).where(eq(financialData.dealId, testDealId))).toHaveLength(0);
  });
});
