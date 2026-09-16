import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import {
  recurringServiceJsmIssueTypeMappings,
  recurringServiceJsmLinkRuns,
  recurringServices,
} from "../drizzle/schema";
import {
  JSM_ISSUE_MAPPING_CATEGORY_VALUES,
  JSM_LINK_RUN_SOURCE_VALUES,
  JSM_LINK_RUN_STATUS_VALUES,
  JSM_LINK_SOURCE_VALUES,
} from "../shared/jsmExistingSpace";
import { getDb } from "./db";

const shouldRunPersistent = Boolean(process.env.DATABASE_URL)
  && process.env.RUN_PERSISTENT_JSM_LINK_MODEL_TEST === "true";

const serviceNames = ["__TEST_JSM_LINK_MODEL_A__", "__TEST_JSM_LINK_MODEL_B__"];

describe("contrato del vínculo de Spaces JSM existentes", () => {
  it("mantiene separados el origen, la corrida y las categorías de issue type", () => {
    expect(JSM_LINK_SOURCE_VALUES).toEqual(["created", "linked"]);
    expect(JSM_LINK_RUN_SOURCE_VALUES).toContain("preflight");
    expect(JSM_LINK_RUN_STATUS_VALUES).toContain("ready");
    expect(JSM_ISSUE_MAPPING_CATEGORY_VALUES).toEqual(["work_plan", "billing"]);
  });
});

async function cleanup() {
  const db = await getDb();
  if (!db) return;

  const rows = await db.select({ id: recurringServices.id })
    .from(recurringServices)
    .where(inArray(recurringServices.serviceName, serviceNames));
  const serviceIds = rows.map(row => row.id);

  if (serviceIds.length > 0) {
    await db.delete(recurringServiceJsmIssueTypeMappings)
      .where(inArray(recurringServiceJsmIssueTypeMappings.serviceId, serviceIds));
    await db.delete(recurringServiceJsmLinkRuns)
      .where(inArray(recurringServiceJsmLinkRuns.serviceId, serviceIds));
    await db.delete(recurringServices).where(inArray(recurringServices.id, serviceIds));
  }
}

describe.runIf(shouldRunPersistent)("persistencia aislada del modelo JSM existente", () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it("protege identidades, corridas y mapeos contra duplicados", async () => {
    const db = await getDb();
    expect(db).toBeTruthy();
    if (!db) throw new Error("Database not available");

    const [serviceAResult] = await db.insert(recurringServices).values({
      clientName: "Cliente JSM A",
      serviceName: serviceNames[0],
      serviceType: "staffing",
      durationMonths: 1,
      billingType: "cuota_fija",
      jsmPlatform: "prodigio",
      jsmLinkSource: "linked",
      jsmProjectKey: "TJSMLA",
      jsmProjectId: "9900001",
      jsmProjectName: "JSM Link Model A",
      jsmServiceDeskId: "8800001",
      jsmAgentUrl: "https://example.atlassian.net/jira/servicedesk/projects/TJSMLA",
      jsmPortalUrl: "https://example.atlassian.net/servicedesk/customer/portal/8800001",
      jsmLinkHealth: "healthy",
      jsmLastVerifiedAt: new Date(),
      jsmLinkedAt: new Date(),
      jsmLinkedBy: 1,
      createdBy: 1,
    });
    const serviceAId = Number(serviceAResult.insertId);

    const [serviceBResult] = await db.insert(recurringServices).values({
      clientName: "Cliente JSM B",
      serviceName: serviceNames[1],
      serviceType: "staffing",
      durationMonths: 1,
      billingType: "cuota_fija",
      jsmPlatform: "prodigio",
      createdBy: 1,
    });
    const serviceBId = Number(serviceBResult.insertId);

    await db.insert(recurringServiceJsmLinkRuns).values({
      runId: `preflight:${serviceAId}:fixture`,
      serviceId: serviceAId,
      source: "preflight",
      status: "ready",
      candidateProjectId: "9900001",
      candidateProjectKey: "TJSMLA",
      candidateProjectName: "JSM Link Model A",
      candidateServiceDeskId: "8800001",
      fingerprint: "a".repeat(64),
      checks: { projectType: "service_desk", available: true },
      snapshot: { projectId: "9900001", serviceDeskId: "8800001" },
      triggeredBy: 1,
      triggeredByName: "Vitest JSM Link",
      finishedAt: new Date(),
    });

    await db.insert(recurringServiceJsmIssueTypeMappings).values([
      {
        serviceId: serviceAId,
        category: "work_plan",
        issueTypeId: "10001",
        issueTypeName: "Task",
        configuredBy: 1,
        configuredByName: "Vitest JSM Link",
      },
      {
        serviceId: serviceAId,
        category: "billing",
        issueTypeId: "10002",
        issueTypeName: "Service Request",
        configuredBy: 1,
        configuredByName: "Vitest JSM Link",
      },
    ]);

    const [stored] = await db.select().from(recurringServices)
      .where(eq(recurringServices.id, serviceAId));
    const runs = await db.select().from(recurringServiceJsmLinkRuns)
      .where(eq(recurringServiceJsmLinkRuns.serviceId, serviceAId));
    const mappings = await db.select().from(recurringServiceJsmIssueTypeMappings)
      .where(eq(recurringServiceJsmIssueTypeMappings.serviceId, serviceAId));

    expect(stored).toMatchObject({
      jsmLinkSource: "linked",
      jsmProjectKey: "TJSMLA",
      jsmProjectId: "9900001",
      jsmServiceDeskId: "8800001",
      jsmLinkHealth: "healthy",
    });
    expect(runs).toHaveLength(1);
    expect(mappings.map(row => row.category).sort()).toEqual(["billing", "work_plan"]);

    await expect(db.insert(recurringServices).values({
      clientName: "Cliente duplicado",
      serviceName: "__TEST_JSM_LINK_MODEL_DUPLICATE__",
      serviceType: "staffing",
      durationMonths: 1,
      billingType: "cuota_fija",
      jsmPlatform: "prodigio",
      jsmProjectId: "9900001",
    })).rejects.toBeTruthy();

    await expect(db.insert(recurringServiceJsmLinkRuns).values({
      runId: `preflight:${serviceAId}:fixture-2`,
      serviceId: serviceAId,
      source: "preflight",
      status: "ready",
      fingerprint: "a".repeat(64),
    })).rejects.toBeTruthy();

    await expect(db.insert(recurringServiceJsmIssueTypeMappings).values({
      serviceId: serviceAId,
      category: "work_plan",
      issueTypeId: "10003",
      issueTypeName: "Another Task",
    })).rejects.toBeTruthy();

    expect(serviceBId).toBeGreaterThan(0);
  });
});
