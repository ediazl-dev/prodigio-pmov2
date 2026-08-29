import { and, eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import {
  executiveContractMilestones,
  executiveProjectSources,
  jiraProjectOnboardings,
  projectStages,
  projects,
} from "../drizzle/schema";
import {
  approveJiraBaselineProposal,
  createLinkedProject,
  createOrReplaceJiraBaselineProposal,
  getDb,
  getExecutiveContractMilestones,
  getExecutiveProjectSource,
  getExecutiveProjectSourceProposal,
  updateDraftExecutiveMilestoneBaseline,
} from "./db";
import { markProductionJiraOnboardingReady } from "./jiraBaselineImportRunner";

const shouldRun = Boolean(process.env.DATABASE_URL) && process.env.RUN_PERSISTENT_H5_TEST === "true";
const testKey = `H5T${Date.now().toString().slice(-7)}`;
let projectId: number | null = null;

async function cleanup() {
  const db = await getDb();
  if (!db || !projectId) return;
  await db.delete(executiveContractMilestones).where(eq(executiveContractMilestones.projectId, projectId));
  await db.delete(executiveProjectSources).where(eq(executiveProjectSources.projectId, projectId));
  await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.projectId, projectId));
  await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
  projectId = null;
}

describe.runIf(shouldRun)("persistencia H5 aislada", () => {
  afterEach(cleanup);

  it("mantiene la propuesta draft hasta completar fechas y recibir aprobación humana", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) return;

    projectId = await createLinkedProject({
      projectName: "[TEST H5] Baseline provisional aislado",
      clientName: "[TEST]",
      jiraProjectKey: testKey,
      jiraProjectUrl: `https://example.invalid/${testKey}`,
      projectType: "otro",
    });
    await db.insert(jiraProjectOnboardings).values({
      projectId,
      jiraProjectKey: testKey,
      jiraProjectName: "[TEST H5] Baseline provisional aislado",
      status: "reconciliation",
      currentStep: 6,
      sourceSnapshot: { issues: [] },
      sourceFingerprint: `fixture-${testKey}`,
      identitySnapshot: { dealId: `TEST-${testKey}`, pmUserId: 0, pmUserName: "Vitest H5", deliveryUserId: 0, deliveryUserName: "Vitest H5" },
      mappingVersion: 1,
      initiatedBy: 0,
      initiatedByName: "Vitest H5",
    });

    const first = await createOrReplaceJiraBaselineProposal({
      projectId,
      dealId: `TEST-${testKey}`,
      jiraProjectKey: testKey,
      baselineVersion: "jira-onboarding-v1",
      createdBy: 0,
      createdByName: "Vitest H5",
      milestones: [
        {
          milestoneCode: "M01",
          title: "Hito con fecha Jira observada",
          billingWeight: "0.00",
          baselineDate: "2026-08-15",
          jiraIssueKey: `${testKey}-1`,
          jiraDueDate: "2026-08-20",
          jiraClosedDate: "2026-08-25",
          jiraStatusName: "Done",
          semanticStatus: "fulfilled",
        },
        {
          milestoneCode: "M02",
          title: "Hito sin fecha Jira",
          billingWeight: "0.00",
          baselineDate: null,
          jiraIssueKey: `${testKey}-2`,
          jiraDueDate: null,
          jiraClosedDate: null,
          jiraStatusName: "To Do",
          semanticStatus: "pending",
        },
      ],
    });
    expect(first).toMatchObject({ sourceStatus: "draft", reused: false });
    expect(await getExecutiveProjectSource(projectId)).toBeUndefined();
    expect(await getExecutiveProjectSourceProposal(projectId)).toMatchObject({ id: first.sourceId, sourceStatus: "draft" });

    const milestones = await getExecutiveContractMilestones(projectId, first.sourceId);
    expect(milestones).toHaveLength(2);
    expect(milestones[0]).toMatchObject({
      billingWeight: "0.00",
      baselineDate: "2026-08-15",
      jiraDueDate: "2026-08-20",
      jiraClosedDate: "2026-08-25",
    });
    await expect(approveJiraBaselineProposal({
      projectId,
      sourceId: first.sourceId,
      approvedBy: 0,
      approvedByName: "Vitest H5",
      approvalNotes: "Aprobación humana aislada de prueba H5.",
    })).rejects.toThrow(`${testKey}-2`);

    const pendingMilestone = milestones.find(milestone => milestone.milestoneCode === "M02");
    expect(pendingMilestone).toBeTruthy();
    await updateDraftExecutiveMilestoneBaseline({
      projectId,
      milestoneId: pendingMilestone!.id,
      baselineDate: "2026-08-29",
    });
    const approval = await approveJiraBaselineProposal({
      projectId,
      sourceId: first.sourceId,
      approvedBy: 0,
      approvedByName: "Vitest H5",
      approvalNotes: "Aprobación humana aislada de prueba H5.",
    });
    expect(approval).toMatchObject({ sourceId: first.sourceId, reused: false });
    expect(await markProductionJiraOnboardingReady({ projectId, actorId: 0, actorName: "Vitest H5" })).toMatchObject({
      status: "ready",
      reused: false,
    });
    expect(await markProductionJiraOnboardingReady({ projectId, actorId: 0, actorName: "Vitest H5" })).toMatchObject({
      status: "ready",
      reused: true,
    });
    expect(await getExecutiveProjectSource(projectId)).toMatchObject({ id: first.sourceId, sourceStatus: "approved" });
    expect(await getExecutiveProjectSourceProposal(projectId)).toBeUndefined();
    await expect(updateDraftExecutiveMilestoneBaseline({
      projectId,
      milestoneId: pendingMilestone!.id,
      baselineDate: "2026-09-01",
    })).rejects.toThrow("draft");

    const retry = await createOrReplaceJiraBaselineProposal({
      projectId,
      dealId: `TEST-${testKey}`,
      jiraProjectKey: testKey,
      baselineVersion: "jira-onboarding-v1",
      createdBy: 0,
      createdByName: "Vitest H5",
      milestones: [],
    });
    expect(retry).toMatchObject({ sourceId: first.sourceId, sourceStatus: "approved", reused: true });
    const duplicates = await db.select({ id: executiveProjectSources.id }).from(executiveProjectSources).where(and(
      eq(executiveProjectSources.projectId, projectId),
      eq(executiveProjectSources.baselineVersion, "jira-onboarding-v1"),
    ));
    expect(duplicates).toHaveLength(1);

    await cleanup();
    expect(await db.select({ id: projects.id }).from(projects).where(eq(projects.jiraProjectKey, testKey))).toHaveLength(0);
    expect(await db.select({ id: executiveProjectSources.id }).from(executiveProjectSources).where(eq(executiveProjectSources.jiraProjectKey, testKey))).toHaveLength(0);
    expect(await db.select({ id: jiraProjectOnboardings.id }).from(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.jiraProjectKey, testKey))).toHaveLength(0);
  });
});
