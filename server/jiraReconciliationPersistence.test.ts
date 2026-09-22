import { afterEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  executiveContractMilestones,
  executiveMilestoneAcceptances,
  executiveProjectSources,
  jiraEntityMappings,
  jiraImportExceptions,
  jiraProjectOnboardings,
  jiraSyncLogs,
  projectStages,
  projects,
  risks,
  wbsTasks,
} from "../drizzle/schema";
import {
  createLinkedProject,
  getDb,
  getJiraHomologationImportStatus,
  reconcileExecutiveMilestoneJiraObservations,
  resolveOpenJiraImportExceptions,
  updateReadyJiraOnboardingSnapshot,
  upsertJiraImportedRisks,
  upsertJiraImportedWbs,
} from "./db";
import { loadProductionJiraBaselineImportContext } from "./jiraBaselineImportRunner";
import { createProductionJiraOnboardingService } from "./jiraOnboardingRepository";
import { runJiraReconciliation, type JiraReconciliationContext } from "./jiraReconciliationRunner";
import { JiraHomologationStatusCardBody } from "../client/src/components/JiraHomologationStatusCard";

const shouldRun = Boolean(process.env.DATABASE_URL) && process.env.RUN_PERSISTENT_H7_TEST === "true";
const testKey = `H7T${Date.now().toString().slice(-7)}`;
let projectId: number | null = null;
let onboardingId: number | null = null;
let sourceId: number | null = null;

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  if (projectId) {
    await db.delete(executiveMilestoneAcceptances).where(eq(executiveMilestoneAcceptances.projectId, projectId));
    await db.delete(executiveContractMilestones).where(eq(executiveContractMilestones.projectId, projectId));
    await db.delete(executiveProjectSources).where(eq(executiveProjectSources.projectId, projectId));
    await db.delete(jiraSyncLogs).where(eq(jiraSyncLogs.projectId, projectId));
    await db.delete(jiraImportExceptions).where(eq(jiraImportExceptions.projectId, projectId));
    await db.delete(jiraEntityMappings).where(eq(jiraEntityMappings.projectId, projectId));
    await db.delete(risks).where(eq(risks.projectId, projectId));
    await db.delete(wbsTasks).where(eq(wbsTasks.projectId, projectId));
  }
  if (onboardingId) {
    await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.id, onboardingId));
    onboardingId = null;
  }
  if (projectId) {
    await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
    projectId = null;
  }
  sourceId = null;
}

describe.runIf(shouldRun)("conciliación H7 persistente aislada", () => {
  afterEach(cleanup);

  it("actualiza observaciones Jira una sola vez y preserva el baseline contractual", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;
    projectId = await createLinkedProject({
      projectName: "[TEST H7] Conciliación Jira aislada",
      clientName: "[TEST]",
      jiraProjectKey: testKey,
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      projectType: "otro",
    });
    const [source] = await db.insert(executiveProjectSources).values({
      projectId,
      dealId: `TEST-${testKey}`,
      jiraProjectKey: testKey,
      baselineVersion: "TEST-H7-V1",
      contractFileName: "[TEST] baseline H7",
      contractFileUrl: "https://example.invalid/test-h7-baseline",
      sourceStatus: "approved",
      approvedAt: new Date("2026-08-29T12:00:00.000Z"),
      approvedBy: 1,
      approvedByName: "Prueba H7",
    }).$returningId();
    sourceId = source.id;
    const [milestone] = await db.insert(executiveContractMilestones).values({
      projectId,
      sourceId,
      milestoneCode: "M01",
      title: "Hito contractual de prueba",
      billingWeight: "10.00",
      baselineDate: "2026-08-20",
      jiraIssueKey: `${testKey}-3`,
      jiraStatusName: "To Do",
      jiraDueDate: "2026-08-20",
      jiraClosedDate: null,
      semanticStatus: "pending",
    }).$returningId();
    const [onboarding] = await db.insert(jiraProjectOnboardings).values({
      projectId,
      jiraProjectKey: testKey,
      jiraProjectName: "[TEST H7] Conciliación Jira aislada",
      status: "ready",
      currentStep: 7,
      sourceSnapshot: { issues: [] },
      sourceFingerprint: "old",
      identitySnapshot: { projectName: "[TEST H7]", clientName: "[TEST]" },
      mappingVersion: 1,
      initiatedBy: 1,
      initiatedByName: "Prueba H7",
      activatedAt: new Date("2026-08-29T12:00:00.000Z"),
    }).$returningId();
    onboardingId = onboarding.id;
    await db.insert(jiraEntityMappings).values([
      {
        onboardingId,
        projectId,
        mappingKey: `${onboardingId}:v1:${testKey}-1:risk`,
        mappingVersion: 1,
        sourceKey: `${testKey}-1`,
        targetEntityType: "risk",
        syncDirection: "jira_to_pmo",
        status: "approved",
      },
      {
        onboardingId,
        projectId,
        mappingKey: `${onboardingId}:v1:${testKey}-2:epic`,
        mappingVersion: 1,
        sourceKey: `${testKey}-2`,
        targetEntityType: "epic",
        syncDirection: "jira_to_pmo",
        status: "approved",
      },
      {
        onboardingId,
        projectId,
        mappingKey: `${onboardingId}:v1:${testKey}-3:milestone`,
        mappingVersion: 1,
        sourceKey: `${testKey}-3`,
        targetEntityType: "milestone",
        targetEntityId: String(milestone.id),
        syncDirection: "jira_to_pmo",
        status: "approved",
      },
    ]);

    const service = createProductionJiraOnboardingService();
    const fetchIssues = vi.fn().mockResolvedValue([
      { key: `${testKey}-1`, fields: { summary: "Riesgo observado H7", issuetype: { name: "Risk" }, status: { name: "Open", statusCategory: { key: "new" } } } },
      { key: `${testKey}-2`, fields: { summary: "Épica observada H7", issuetype: { name: "Epic" }, status: { name: "In Progress", statusCategory: { key: "indeterminate" } } } },
      { key: `${testKey}-3`, fields: { summary: "Hito observado H7", issuetype: { name: "Milestone" }, status: { name: "Done", statusCategory: { key: "done" } }, duedate: "2026-08-22", resolutiondate: "2026-08-25T15:00:00.000Z" } },
    ]);
    const dependencies = {
      loadContext: async (id: number) => loadProductionJiraBaselineImportContext(id) as Promise<JiraReconciliationContext | null>,
      startSyncRun: service.startSyncRun,
      completeSyncRun: service.completeSyncRun,
      upsertException: service.upsertException,
      fetchIssues,
      persistSnapshot: updateReadyJiraOnboardingSnapshot,
      persistRisks: upsertJiraImportedRisks,
      persistWbs: upsertJiraImportedWbs,
      persistMilestones: reconcileExecutiveMilestoneJiraObservations,
      resolveExceptions: resolveOpenJiraImportExceptions,
      now: () => new Date("2026-08-29T12:05:00.000Z"),
    };
    const scheduledOperationId = `daily:${testKey}`;
    const first = await runJiraReconciliation({
      projectId,
      source: "scheduled",
      operationId: scheduledOperationId,
      actorId: null,
      actorName: "Conciliación Jira diaria",
    }, dependencies);
    const second = await runJiraReconciliation({
      projectId,
      source: "scheduled",
      operationId: scheduledOperationId,
      actorId: null,
      actorName: "Conciliación Jira diaria",
    }, dependencies);

    expect(first).toMatchObject({ status: "applied", reused: false, exceptions: 0 });
    expect(second).toMatchObject({ status: "applied", reused: true });
    expect(fetchIssues).toHaveBeenCalledOnce();
    expect(await db.select().from(risks).where(eq(risks.projectId, projectId))).toHaveLength(1);
    expect(await db.select().from(wbsTasks).where(eq(wbsTasks.projectId, projectId))).toHaveLength(1);
    const syncLogs = await db.select().from(jiraSyncLogs).where(eq(jiraSyncLogs.projectId, projectId));
    expect(syncLogs).toHaveLength(1);
    expect(syncLogs[0]).toMatchObject({
      source: "scheduled",
      status: "applied",
      inputCount: 3,
      createdCount: 2,
      updatedCount: 1,
      errorCount: 0,
      details: expect.objectContaining({ operationId: scheduledOperationId }),
    });
    expect(await db.select().from(jiraImportExceptions).where(eq(jiraImportExceptions.projectId, projectId))).toHaveLength(0);
    expect(await db.select().from(executiveMilestoneAcceptances).where(eq(executiveMilestoneAcceptances.projectId, projectId))).toHaveLength(0);
    expect(await db.select().from(executiveContractMilestones).where(eq(executiveContractMilestones.id, milestone.id))).toEqual([
      expect.objectContaining({
        baselineDate: "2026-08-20",
        billingWeight: "10.00",
        jiraDueDate: "2026-08-22",
        jiraClosedDate: "2026-08-25",
        jiraStatusName: "Done",
        semanticStatus: "fulfilled",
      }),
    ]);
    expect(await db.select({ status: jiraProjectOnboardings.status }).from(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.id, onboardingId)))
      .toEqual([{ status: "ready" }]);

    const integrationStatus = await getJiraHomologationImportStatus(projectId);
    expect(integrationStatus).toMatchObject({
      onboarding: { status: "ready", jiraProjectKey: testKey },
      latestReconciliation: { source: "scheduled", status: "applied" },
      counts: {
        risks: { imported: 1, mapped: 1 },
        wbs: { imported: 1, mapped: 1 },
      },
    });
    expect(integrationStatus?.reconciliationHistory).toHaveLength(1);
    const integratedHtml = renderToStaticMarkup(createElement(JiraHomologationStatusCardBody, {
      status: integrationStatus!,
      canImport: true,
    }));
    expect(integratedHtml).toContain("Sincronizar ahora");
    expect(integratedHtml).toContain("Historial de sincronización");
    expect(integratedHtml).toContain("Aplicada");
    expect(integratedHtml).toContain("Diaria");
    expect(integratedHtml).toContain("1/1");
    expect(integratedHtml).toContain("Cargar SoW contractual");

    if (process.env.HOLD_H7_VISUAL_FIXTURE === "true") {
      console.log(`[H7_VISUAL_FIXTURE] projectId=${projectId}`);
      await new Promise(resolve => setTimeout(resolve, 45_000));
    }

    await cleanup();
    expect(await db.select({ id: projects.id }).from(projects).where(eq(projects.jiraProjectKey, testKey))).toHaveLength(0);
  });
});
