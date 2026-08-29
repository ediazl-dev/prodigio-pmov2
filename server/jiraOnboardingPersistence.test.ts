import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  jiraProjectOnboardings,
  jiraSpaces,
  projectStages,
  projects,
  stageClosures,
} from "../drizzle/schema";
import {
  bindJiraOnboardingToProject,
  createHomologatedStageClosure,
  createJiraSpaceRecord,
  createLinkedProject,
  getDb,
  getProjectById,
  getProjectStages,
  getStageClosure,
  reconcileHistoricalStageClosure,
  updateProjectStage,
} from "./db";
import { CANONICAL_PROJECT_STAGE_IDS } from "./jiraHomologation";

const shouldRun = Boolean(process.env.DATABASE_URL) && process.env.RUN_PERSISTENT_H4_TEST === "true";
const testKey = `H4T${Date.now().toString().slice(-7)}`;
let projectId: number | null = null;
let onboardingId: number | null = null;

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  if (projectId) {
    await db.delete(stageClosures).where(eq(stageClosures.projectId, projectId));
    await db.delete(jiraSpaces).where(eq(jiraSpaces.projectId, projectId));
    await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
    await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.projectId, projectId));
    await db.delete(projects).where(eq(projects.id, projectId));
  }
  if (onboardingId) {
    await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.id, onboardingId));
  }
  projectId = null;
  onboardingId = null;
}

describe.runIf(shouldRun)("persistencia H4 aislada", () => {
  afterEach(cleanup);

  it("materializa seis etapas, desbloquea en secuencia y completa el proyecto sin dejar datos", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    const [onboardingInsert] = await db.insert(jiraProjectOnboardings).values({
      jiraProjectKey: testKey,
      jiraProjectId: `test-${testKey}`,
      jiraProjectName: "Prueba aislada H4",
      status: "reconciliation",
      currentStep: 4,
      sourceSnapshot: { testOnly: true },
      sourceFingerprint: `test-${testKey}`,
      identitySnapshot: { testOnly: true },
      mappingVersion: 1,
      initiatedBy: 0,
      initiatedByName: "Vitest H4",
    });
    onboardingId = Number((onboardingInsert as any).insertId);

    projectId = await createLinkedProject({
      projectName: "[TEST H4] Materialización aislada",
      clientName: "[TEST]",
      jiraProjectKey: testKey,
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      projectType: "otro",
    });
    const spaceId = await createJiraSpaceRecord({
      projectId,
      spaceName: "Prueba aislada H4",
      jiraProjectKey: testKey,
      jiraProjectId: `test-${testKey}`,
      jiraProjectName: "Prueba aislada H4",
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      status: "linked",
      templateKey: null,
      boards: [],
      issueTypes: [],
      workflows: [],
      createdBy: 0,
      createdByName: "Vitest H4",
    });
    await bindJiraOnboardingToProject({ onboardingId, projectId, jiraSpaceId: spaceId });

    const initialStages = await getProjectStages(projectId);
    expect(initialStages).toHaveLength(6);
    expect(initialStages.map(stage => [stage.stageId, stage.status])).toEqual([
      ["sow", "in_progress"],
      ["jira", "locked"],
      ["risks", "locked"],
      ["planning", "locked"],
      ["design", "locked"],
      ["closure", "locked"],
    ]);

    for (const [index, stageId] of CANONICAL_PROJECT_STAGE_IDS.entries()) {
      const result = await createHomologatedStageClosure({
        projectId,
        onboardingId,
        stageId,
        closedBy: 0,
        closedByName: "Vitest H4",
        actorConfirmed: true,
        confirmationText: "Confirmación aislada de persistencia H4 con evidencia verificable.",
        evidenceSource: "test_fixture",
        evidenceReference: `${testKey}-${stageId}`,
        evidenceDate: "2026-08-29",
      });
      expect(result.created).toBe(true);
      const stages = await getProjectStages(projectId);
      expect(stages.find(stage => stage.stageId === stageId)?.status).toBe("completed");
      const nextStageId = CANONICAL_PROJECT_STAGE_IDS[index + 1];
      if (nextStageId) expect(stages.find(stage => stage.stageId === nextStageId)?.status).toBe("in_progress");
    }

    const finalProject = await getProjectById(projectId);
    expect(finalProject).toMatchObject({ status: "completado", currentStage: "closure" });
    for (const stageId of CANONICAL_PROJECT_STAGE_IDS) {
      expect(await getStageClosure(projectId, stageId)).toMatchObject({
        closureMode: "homologated",
        evidenceReference: `${testKey}-${stageId}`,
      });
    }

    await cleanup();
    const remaining = await db.select({ id: projects.id }).from(projects).where(eq(projects.jiraProjectKey, testKey));
    expect(remaining).toHaveLength(0);
  });

  it("concilia evidencia histórica sin modificar ni desbloquear el pipeline", async () => {
    projectId = await createLinkedProject({
      projectName: "[TEST H4] Reconciliación aislada",
      clientName: "[TEST]",
      jiraProjectKey: testKey,
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      projectType: "otro",
    });
    await updateProjectStage(projectId, "sow", { status: "completed", progress: 100, completedAt: new Date() });

    const result = await reconcileHistoricalStageClosure({
      projectId,
      stageId: "sow",
      closedBy: 0,
      closedByName: "Vitest H4",
      actorConfirmed: true,
      confirmationText: "Confirmación aislada de reconciliación histórica con evidencia verificable.",
      evidenceSource: "test_fixture",
      evidenceReference: `${testKey}-historical-sow`,
      evidenceDate: "2026-08-29",
    });
    expect(result).toMatchObject({ created: true, stageStatusPreserved: true });
    expect(result.closure).toMatchObject({
      closureMode: "homologated",
      evidenceReference: `${testKey}-historical-sow`,
    });
    const stages = await getProjectStages(projectId);
    expect(stages.find(stage => stage.stageId === "sow")?.status).toBe("completed");
    expect(stages.find(stage => stage.stageId === "jira")?.status).toBe("locked");
  });
});
