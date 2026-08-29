import { and, eq, isNull } from "drizzle-orm";
import {
  jiraEntityMappings,
  jiraImportExceptions,
  jiraProjectOnboardings,
  jiraSyncLogs,
} from "../drizzle/schema";
import { createAuditLog, getDb } from "./db";
import { createJiraOnboardingService, type JiraOnboardingRepository } from "./jiraOnboardingService";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db;
}

async function selectById(table: any, idColumn: any, id: number) {
  const db = await requireDb();
  const rows = await db.select().from(table).where(eq(idColumn, id)).limit(1);
  return rows[0] ?? null;
}

export function createDrizzleJiraOnboardingRepository(): JiraOnboardingRepository {
  return {
    async findOnboardingByProjectKey(jiraProjectKey) {
      const db = await requireDb();
      const rows = await db.select().from(jiraProjectOnboardings)
        .where(eq(jiraProjectOnboardings.jiraProjectKey, jiraProjectKey)).limit(1);
      return rows[0] ?? null;
    },
    async createOnboarding(values) {
      const db = await requireDb();
      const [result] = await db.insert(jiraProjectOnboardings).values(values as any);
      return selectById(jiraProjectOnboardings, jiraProjectOnboardings.id, Number((result as any).insertId));
    },
    async updateOnboarding(id, values) {
      const db = await requireDb();
      const sanitized = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
      await db.update(jiraProjectOnboardings).set(sanitized as any).where(eq(jiraProjectOnboardings.id, id));
      return selectById(jiraProjectOnboardings, jiraProjectOnboardings.id, id);
    },
    async listMappings(onboardingId, mappingVersion) {
      const db = await requireDb();
      const filter = mappingVersion == null
        ? eq(jiraEntityMappings.onboardingId, onboardingId)
        : and(eq(jiraEntityMappings.onboardingId, onboardingId), eq(jiraEntityMappings.mappingVersion, mappingVersion));
      return db.select().from(jiraEntityMappings).where(filter).orderBy(jiraEntityMappings.sourceKey);
    },
    async findMappingByKey(mappingKey) {
      const db = await requireDb();
      const rows = await db.select().from(jiraEntityMappings)
        .where(eq(jiraEntityMappings.mappingKey, mappingKey)).limit(1);
      return rows[0] ?? null;
    },
    async createMapping(values) {
      const db = await requireDb();
      const [result] = await db.insert(jiraEntityMappings).values(values as any);
      return selectById(jiraEntityMappings, jiraEntityMappings.id, Number((result as any).insertId));
    },
    async updateMapping(id, values) {
      const db = await requireDb();
      await db.update(jiraEntityMappings).set(values as any).where(eq(jiraEntityMappings.id, id));
      return selectById(jiraEntityMappings, jiraEntityMappings.id, id);
    },
    async findSyncRunByRunId(runId) {
      const db = await requireDb();
      const rows = await db.select().from(jiraSyncLogs).where(eq(jiraSyncLogs.runId, runId)).limit(1);
      return rows[0] ?? null;
    },
    async createSyncRun(values) {
      const db = await requireDb();
      const [result] = await db.insert(jiraSyncLogs).values(values as any);
      return selectById(jiraSyncLogs, jiraSyncLogs.id, Number((result as any).insertId));
    },
    async updateSyncRun(id, values) {
      const db = await requireDb();
      await db.update(jiraSyncLogs).set(values as any).where(eq(jiraSyncLogs.id, id));
      return selectById(jiraSyncLogs, jiraSyncLogs.id, id);
    },
    async findExceptionByNaturalKey(input) {
      const db = await requireDb();
      const sourceCondition = input.sourceKey === null
        ? isNull(jiraImportExceptions.sourceKey)
        : eq(jiraImportExceptions.sourceKey, input.sourceKey);
      const rows = await db.select().from(jiraImportExceptions).where(and(
        eq(jiraImportExceptions.onboardingId, input.onboardingId),
        eq(jiraImportExceptions.domain, input.domain as any),
        sourceCondition,
        eq(jiraImportExceptions.reason, input.reason),
      )).limit(1);
      return rows[0] ?? null;
    },
    async createException(values) {
      const db = await requireDb();
      const [result] = await db.insert(jiraImportExceptions).values(values as any);
      return selectById(jiraImportExceptions, jiraImportExceptions.id, Number((result as any).insertId));
    },
    async updateException(id, values) {
      const db = await requireDb();
      await db.update(jiraImportExceptions).set(values as any).where(eq(jiraImportExceptions.id, id));
      return selectById(jiraImportExceptions, jiraImportExceptions.id, id);
    },
  };
}

export function createProductionJiraOnboardingService() {
  return createJiraOnboardingService(createDrizzleJiraOnboardingRepository(), createAuditLog);
}
