import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  recurringServiceBillingMonths,
  recurringServiceJsmIssueTypeMappings,
  recurringServiceJsmLinkRuns,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  createOrReuseJsmLinkRun,
  linkExistingJsmSpaceLocal,
  RecurringServiceJsmDbError,
  unlinkExistingJsmSpaceLocal,
} from "./recurringServicesDb";

const shouldRunPersistent =
  Boolean(process.env.DATABASE_URL) &&
  process.env.RUN_PERSISTENT_JSM_LINK_J3_TEST === "true";

const serviceNames = ["__TEST_JSM_LINK_J3_A__", "__TEST_JSM_LINK_J3_B__"];

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  const services = await db
    .select({ id: recurringServices.id })
    .from(recurringServices)
    .where(inArray(recurringServices.serviceName, serviceNames));
  const serviceIds = services.map(service => service.id);
  if (serviceIds.length === 0) return;
  await db
    .delete(recurringServiceJsmIssueTypeMappings)
    .where(inArray(recurringServiceJsmIssueTypeMappings.serviceId, serviceIds));
  await db
    .delete(recurringServiceJsmLinkRuns)
    .where(inArray(recurringServiceJsmLinkRuns.serviceId, serviceIds));
  await db
    .delete(recurringServiceWorkPlan)
    .where(inArray(recurringServiceWorkPlan.serviceId, serviceIds));
  await db
    .delete(recurringServiceBillingMonths)
    .where(inArray(recurringServiceBillingMonths.serviceId, serviceIds));
  await db
    .delete(recurringServices)
    .where(inArray(recurringServices.id, serviceIds));
}

describe.runIf(shouldRunPersistent)(
  "J3 persistencia de vínculo JSM existente",
  () => {
    beforeEach(cleanup);
    afterEach(cleanup);

    it("vincula atómicamente, protege identidad, reutiliza corridas y controla la desvinculación", async () => {
      const db = await getDb();
      expect(db).toBeTruthy();
      if (!db) throw new Error("Database not available");

      const [serviceAResult] = await db.insert(recurringServices).values({
        clientName: "Cliente J3 A",
        serviceName: serviceNames[0],
        serviceType: "staffing",
        durationMonths: 1,
        billingType: "cuota_fija",
        jsmPlatform: "prodigio",
        createdBy: 1,
      });
      const serviceAId = Number(serviceAResult.insertId);
      const [serviceBResult] = await db.insert(recurringServices).values({
        clientName: "Cliente J3 B",
        serviceName: serviceNames[1],
        serviceType: "staffing",
        durationMonths: 1,
        billingType: "cuota_fija",
        jsmPlatform: "prodigio",
        createdBy: 1,
      });
      const serviceBId = Number(serviceBResult.insertId);

      const uniqueSuffix = String(serviceAId);
      const snapshot = {
        serviceDeskId: `88${uniqueSuffix}`,
        projectId: `99${uniqueSuffix}`,
        projectKey: `J3T${uniqueSuffix}`,
        projectName: "Mesa JSM J3 Test",
        projectTypeKey: "service_desk",
        archived: false,
        canBrowseProject: true,
        canCreateIssues: true,
        issueTypes: [{ id: "10001", name: "Solicitud", subtask: false }],
        agentUrl: `https://example.atlassian.net/jira/servicedesk/projects/J3T${uniqueSuffix}/boards`,
        portalUrl: `https://example.atlassian.net/servicedesk/customer/portal/88${uniqueSuffix}`,
        inspectedAt: "2026-09-16T12:00:00.000Z",
      };

      const linked = await linkExistingJsmSpaceLocal({
        serviceId: serviceAId,
        snapshot,
        linkedBy: 1,
        health: "healthy",
      });
      expect(linked.reused).toBe(false);

      const [stored] = await db
        .select()
        .from(recurringServices)
        .where(eq(recurringServices.id, serviceAId));
      expect(stored).toMatchObject({
        jsmLinkSource: "linked",
        jsmProjectId: snapshot.projectId,
        jsmProjectKey: snapshot.projectKey,
        jsmProjectName: snapshot.projectName,
        jsmServiceDeskId: snapshot.serviceDeskId,
        jsmAgentUrl: snapshot.agentUrl,
        jsmPortalUrl: snapshot.portalUrl,
        jsmLinkHealth: "healthy",
        jsmLinkedBy: 1,
      });

      const repeatedLink = await linkExistingJsmSpaceLocal({
        serviceId: serviceAId,
        snapshot,
        linkedBy: 1,
        health: "healthy",
      });
      expect(repeatedLink.reused).toBe(true);

      await expect(
        linkExistingJsmSpaceLocal({
          serviceId: serviceBId,
          snapshot,
          linkedBy: 1,
          health: "healthy",
        })
      ).rejects.toMatchObject({ code: "JSM_IDENTITY_CONFLICT" });

      const runData = {
        runId: `preflight:j3:${serviceAId}`,
        serviceId: serviceAId,
        source: "preflight" as const,
        status: "running" as const,
        candidateProjectId: snapshot.projectId,
        candidateProjectKey: snapshot.projectKey,
        candidateProjectName: snapshot.projectName,
        candidateServiceDeskId: snapshot.serviceDeskId,
        fingerprint: "b".repeat(64),
        triggeredBy: 1,
        triggeredByName: "Vitest J3",
      };
      const firstRun = await createOrReuseJsmLinkRun(runData);
      const repeatedRun = await createOrReuseJsmLinkRun({
        ...runData,
        runId: `${runData.runId}:retry`,
      });
      expect(firstRun.reused).toBe(false);
      expect(repeatedRun.reused).toBe(true);
      expect(repeatedRun.run.id).toBe(firstRun.run.id);
      await expect(
        createOrReuseJsmLinkRun({
          ...runData,
          fingerprint: "c".repeat(64),
          candidateProjectId: `OTHER-${serviceAId}`,
        })
      ).rejects.toMatchObject({ code: "RUN_ID_CONFLICT" });

      await db.insert(recurringServiceJsmIssueTypeMappings).values({
        serviceId: serviceAId,
        category: "work_plan",
        issueTypeId: "10001",
        issueTypeName: "Solicitud",
        configuredBy: 1,
        configuredByName: "Vitest J3",
      });
      await db.insert(recurringServiceWorkPlan).values({
        serviceId: serviceAId,
        itemType: "tarea_programada",
        title: "Actividad sincronizada",
        jiraIssueKey: `${snapshot.projectKey}-1`,
      });
      await expect(
        unlinkExistingJsmSpaceLocal(serviceAId)
      ).rejects.toBeInstanceOf(RecurringServiceJsmDbError);

      await db
        .delete(recurringServiceWorkPlan)
        .where(eq(recurringServiceWorkPlan.serviceId, serviceAId));
      await db.insert(recurringServiceBillingMonths).values({
        serviceId: serviceAId,
        monthNumber: 1,
        amount: "100.00",
        jiraIssueKey: `${snapshot.projectKey}-2`,
      });
      await expect(
        unlinkExistingJsmSpaceLocal(serviceAId)
      ).rejects.toMatchObject({
        code: "SYNCED_ISSUES_BLOCK_UNLINK",
      });

      await db
        .delete(recurringServiceBillingMonths)
        .where(eq(recurringServiceBillingMonths.serviceId, serviceAId));
      const unlinked = await unlinkExistingJsmSpaceLocal(serviceAId);
      expect(unlinked.reused).toBe(false);
      expect(unlinked.priorIdentity).toMatchObject({
        projectId: snapshot.projectId,
        serviceDeskId: snapshot.serviceDeskId,
      });

      const [cleared] = await db
        .select()
        .from(recurringServices)
        .where(eq(recurringServices.id, serviceAId));
      expect(cleared.jsmProjectId).toBeNull();
      expect(cleared.jsmProjectKey).toBeNull();
      expect(cleared.jsmServiceDeskId).toBeNull();
      expect(cleared.jsmLinkSource).toBeNull();
      const [mapping] = await db
        .select()
        .from(recurringServiceJsmIssueTypeMappings)
        .where(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceAId));
      expect(mapping.status).toBe("superseded");
    });
  }
);
