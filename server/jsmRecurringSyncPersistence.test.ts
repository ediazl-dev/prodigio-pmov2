import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  recurringServiceBillingMonths,
  recurringServiceJsmIssueTypeMappings,
  recurringServiceJsmSyncRuns,
  recurringServices,
  recurringServiceWorkPlan,
} from "../drizzle/schema";
import { getDb } from "./db";
import {
  claimJsmSyncRun,
  createOrReuseJsmSyncRun,
  linkRecurringItemToExistingJiraIssue,
  listActiveJsmIssueTypeMappings,
  RecurringServiceJsmDbError,
  saveActiveJsmIssueTypeMappings,
  updateJsmSyncRun,
} from "./recurringServicesDb";

const shouldRunPersistent =
  Boolean(process.env.DATABASE_URL) &&
  process.env.RUN_PERSISTENT_JSM_SYNC_J4_TEST === "true";

const serviceName = "__TEST_JSM_SYNC_J4__";

async function cleanup() {
  const db = await getDb();
  if (!db) return;
  const services = await db
    .select({ id: recurringServices.id })
    .from(recurringServices)
    .where(eq(recurringServices.serviceName, serviceName));
  const serviceIds = services.map(service => service.id);
  if (serviceIds.length === 0) return;
  await db
    .delete(recurringServiceJsmSyncRuns)
    .where(inArray(recurringServiceJsmSyncRuns.serviceId, serviceIds));
  await db
    .delete(recurringServiceJsmIssueTypeMappings)
    .where(inArray(recurringServiceJsmIssueTypeMappings.serviceId, serviceIds));
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
  "J4 persistencia de sincronización JSM",
  () => {
    beforeEach(cleanup);
    afterEach(cleanup);

    it("persiste mappings, deduplica dry-runs, reclama una vez y protege jiraIssueKey", async () => {
      const db = await getDb();
      expect(db).toBeTruthy();
      if (!db) throw new Error("Database not available");

      const [serviceResult] = await db.insert(recurringServices).values({
        clientName: "Cliente J4",
        serviceName,
        serviceType: "staffing",
        durationMonths: 1,
        billingType: "cuota_fija",
        jsmPlatform: "prodigio",
        jsmLinkSource: "linked",
        jsmProjectId: `94${Date.now()}`,
        jsmProjectKey: `J4${String(Date.now()).slice(-7)}`,
        jsmProjectName: "Mesa J4 Test",
        jsmServiceDeskId: `84${Date.now()}`,
        jsmLinkHealth: "healthy",
        createdBy: 1,
      });
      const serviceId = Number(serviceResult.insertId);

      await saveActiveJsmIssueTypeMappings({
        serviceId,
        configuredBy: 1,
        configuredByName: "Vitest J4",
        mappings: [
          {
            category: "work_plan",
            issueTypeId: "10001",
            issueTypeName: "Solicitud",
          },
          {
            category: "billing",
            issueTypeId: "10002",
            issueTypeName: "Facturación",
          },
        ],
      });
      await saveActiveJsmIssueTypeMappings({
        serviceId,
        configuredBy: 1,
        configuredByName: "Vitest J4",
        mappings: [
          {
            category: "work_plan",
            issueTypeId: "10003",
            issueTypeName: "Actividad",
          },
          {
            category: "billing",
            issueTypeId: "10002",
            issueTypeName: "Facturación",
          },
        ],
      });
      const mappings = await listActiveJsmIssueTypeMappings(serviceId);
      expect(mappings).toHaveLength(2);
      expect(
        mappings.find(mapping => mapping.category === "work_plan")
      ).toMatchObject({
        issueTypeId: "10003",
        issueTypeName: "Actividad",
        status: "active",
      });

      const runData = {
        runId: `jsm-sync:j4:${serviceId}`,
        serviceId,
        status: "ready" as const,
        fingerprint: "d".repeat(64),
        projectId: `94${serviceId}`,
        projectKey: `J4${serviceId}`,
        serviceDeskId: `84${serviceId}`,
        mappingsSnapshot: mappings,
        plan: {
          counts: { total: 2, toCreate: 2, alreadyLinked: 0, blocked: 0 },
          items: [],
          canSync: true,
        },
        triggeredBy: 1,
        triggeredByName: "Vitest J4",
      };
      const firstRun = await createOrReuseJsmSyncRun(runData);
      const repeatedRun = await createOrReuseJsmSyncRun({
        ...runData,
        runId: `${runData.runId}:retry`,
      });
      expect(firstRun.reused).toBe(false);
      expect(repeatedRun.reused).toBe(true);
      expect(repeatedRun.run.id).toBe(firstRun.run.id);
      await expect(
        createOrReuseJsmSyncRun({ ...runData, fingerprint: "e".repeat(64) })
      ).rejects.toMatchObject({ code: "SYNC_RUN_ID_CONFLICT" });

      expect(await claimJsmSyncRun(firstRun.run.runId)).toBe(true);
      expect(await claimJsmSyncRun(firstRun.run.runId)).toBe(false);
      const applied = await updateJsmSyncRun(firstRun.run.runId, "applied", {
        result: { created: 2, reused: 0, failed: 0 },
        finished: true,
      });
      expect(applied).toMatchObject({
        status: "applied",
        result: { created: 2, reused: 0, failed: 0 },
      });

      const [workResult] = await db.insert(recurringServiceWorkPlan).values({
        serviceId,
        itemType: "tarea_programada",
        title: "Actividad J4",
      });
      const [billingResult] = await db
        .insert(recurringServiceBillingMonths)
        .values({
          serviceId,
          monthNumber: 1,
          amount: "100.00",
          currency: "UF",
        });
      const issueKey = `J4${serviceId}-1`;
      const linked = await linkRecurringItemToExistingJiraIssue({
        serviceId,
        category: "work_plan",
        entityId: Number(workResult.insertId),
        jiraIssueKey: issueKey,
      });
      expect(linked).toEqual({ reused: false, jiraIssueKey: issueKey });
      await expect(
        linkRecurringItemToExistingJiraIssue({
          serviceId,
          category: "billing",
          entityId: Number(billingResult.insertId),
          jiraIssueKey: issueKey,
        })
      ).rejects.toBeInstanceOf(RecurringServiceJsmDbError);
    });
  }
);
