import { and, eq, ne, desc, sql, isNull, isNotNull, gte, lte, like, notLike, count, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  users, projects, projectStages, sowDocuments, risks, wbsTasks,
  billingMilestones, designDocuments, lessonsLearned, uploadedFiles, adminSettings,
  invitations, sowVersions, stageDeadlines, stageOpenings, holidays,
  stageDeadlineExtensions, deadlineNotifications, stageApprovals, stageClosures, jiraSpaces, riskVersions, auditLogs,
  ganttUploads, financialData, executiveVerdicts, linkedProjectDocuments, recurringServices,
  executiveProjectSources, executiveContractMilestones, executiveMilestoneAcceptances, executiveMeetingMinutes,
  executiveCommitments, executiveRequirements, executiveRecoveryPlans, executiveGovernanceAssignments,
  executiveFinancialSnapshots, executiveDashboardSnapshots, executiveVerdictReviews,
  jiraProjectOnboardings, jiraEntityMappings, jiraSyncLogs, jiraImportExceptions,
  InsertUser, InsertProject, InsertSowDocument, InsertRisk, InsertWbsTask, InsertSowVersion,
  InsertStageDeadline, InsertStageOpening, InsertHoliday,
  InsertStageDeadlineExtension, InsertDeadlineNotification, InsertStageApproval, InsertStageClosure, InsertJiraSpace, InsertRiskVersion, InsertAuditLog,
  InsertGanttUpload, InsertFinancialData, InsertExecutiveVerdict, InsertLinkedProjectDocument,
  InsertExecutiveProjectSource, InsertExecutiveContractMilestone, InsertExecutiveMilestoneAcceptance,
  InsertExecutiveMeetingMinute, InsertExecutiveCommitment, InsertExecutiveRequirement, InsertExecutiveRecoveryPlan,
  InsertExecutiveGovernanceAssignment, InsertExecutiveFinancialSnapshot, InsertExecutiveDashboardSnapshot, InsertExecutiveVerdictReview,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { buildCanonicalLinkedProjectStagePlan } from "./jiraHomologation";
import {
  assessHistoricalStageReconciliation,
  assessHomologatedStageClosure,
  buildHistoricalReconciliationMetadata,
} from "./jiraOnboardingMaterialization";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = await getDb();
  if (!db) return;

  // Si el usuario tiene email, verificar si existe una cuenta con openId temporal (invite_)
  // Esto ocurre cuando un usuario invitado hace login por primera vez con OAuth
  if (user.email) {
    const existingByEmail = await db.select().from(users)
      .where(and(eq(users.email, user.email), like(users.openId, "invite_%")))
      .limit(1);
    if (existingByEmail.length > 0) {
      // Vincular el openId real con la cuenta existente
      const updateFields: Record<string, unknown> = {
        openId: user.openId,
        lastSignedIn: user.lastSignedIn ?? new Date(),
        status: "activo",
      };
      if (user.name) updateFields.name = user.name;
      if (user.loginMethod) updateFields.loginMethod = user.loginMethod;
      await db.update(users).set(updateFields).where(eq(users.email, user.email));
      console.log(`[Auth] Linked real openId for invited user: ${user.email}`);
      return;
    }
  }

  const updateSet: Record<string, unknown> = {};
  const values: InsertUser = { openId: user.openId };
  const fields = ["name", "email", "loginMethod"] as const;
  fields.forEach((f) => {
    if (user[f] !== undefined) { values[f] = user[f] ?? null; updateSet[f] = user[f] ?? null; }
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  // Bug fix: si el usuario existente tiene status "invitado" pero ya tiene openId real
  // (no invite_), significa que ya hizo login con OAuth — actualizar status a "activo"
  if (user.email) {
    await db.update(users)
      .set({ status: "activo" })
      .where(and(eq(users.email, user.email), eq(users.status, "invitado"), notLike(users.openId, "invite_%")));
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function updateUserRole(userId: number, role: "admin" | "pmo" | "pm" | "consulta") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserStatus(userId: number, status: "activo" | "invitado" | "desactivado") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function inviteUser(email: string, name: string, role: "pmo" | "pm" | "consulta") {
  const db = await getDb();
  if (!db) return null;
  // Check if already exists
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const fakeOpenId = `invite_${randomUUID()}`;
  await db.insert(users).values({ openId: fakeOpenId, email, name, role, status: "invitado", lastSignedIn: new Date() });
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createInvitation(data: {
  email: string;
  name: string;
  role: "pmo" | "pm" | "consulta";
  token: string;
  invitedBy: number;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return null;
  // Expire any previous pending invitations for this email
  await db.update(invitations)
    .set({ status: "expired" })
    .where(and(eq(invitations.email, data.email), eq(invitations.status, "pending")));
  await db.insert(invitations).values({ ...data, status: "pending" });
  const result = await db.select().from(invitations).where(eq(invitations.token, data.token)).limit(1);
  return result[0];
}

export async function getInvitationByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(invitations).where(eq(invitations.token, token)).limit(1);
  return result[0];
}

export async function acceptInvitation(token: string) {
  const db = await getDb();
  if (!db) return null;
  const inv = await getInvitationByToken(token);
  if (!inv || inv.status !== "pending") return null;
  if (new Date() > inv.expiresAt) {
    await db.update(invitations).set({ status: "expired" }).where(eq(invitations.token, token));
    return null;
  }
  await db.update(invitations).set({ status: "accepted", acceptedAt: new Date() }).where(eq(invitations.token, token));
  return inv;
}

export async function getPendingInvitations() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(invitations).where(eq(invitations.status, "pending")).orderBy(desc(invitations.createdAt));
}

// ==================== PROJECTS ====================
export async function getAllProjects() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).orderBy(desc(projects.createdAt));
}

export async function getProjectsByPm(pmId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.pmId, pmId)).orderBy(desc(projects.createdAt));
}

export async function getProjectById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(projects).values(data);
  const projectId = (result as any).insertId as number;
  // Create all stages as locked (sow = in_progress, rest = locked)
  const stages = ["sow", "jira", "risks", "planning", "design", "closure"] as const;
  for (const stageId of stages) {
    await db.insert(projectStages).values({
      projectId,
      stageId,
      status: stageId === "sow" ? "in_progress" : "locked",
      progress: 0,
    });
  }
  return projectId;
}

export async function updateProject(id: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) return;
  await db.update(projects).set({ ...data, updatedAt: new Date() }).where(eq(projects.id, id));
}

// ==================== PROJECT STAGES ====================
export async function getProjectStages(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectStages).where(eq(projectStages.projectId, projectId));
}

export async function updateProjectStage(
  projectId: number,
  stageId: string,
  update: { status?: "locked" | "in_progress" | "completed"; progress?: number; data?: unknown; completedAt?: Date }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(projectStages)
    .set({ ...update, updatedAt: new Date() })
    .where(and(eq(projectStages.projectId, projectId), eq(projectStages.stageId, stageId as any)));
}

export async function unlockNextStage(projectId: number, completedStageId: string) {
  const stageOrder = ["sow", "jira", "risks", "planning", "design", "closure"];
  const idx = stageOrder.indexOf(completedStageId);
  if (idx < 0 || idx >= stageOrder.length - 1) return;
  const nextStage = stageOrder[idx + 1];
  await updateProjectStage(projectId, completedStageId, { status: "completed", progress: 100, completedAt: new Date() });
  await updateProjectStage(projectId, nextStage, { status: "in_progress" });
  await updateProject(projectId, { currentStage: nextStage as any });
}

// ==================== SOW ====================
/** Drizzle mysql2 does not call mapFromDriverValue for json columns — TiDB returns them as strings.
 *  This helper safely parses a value that may already be an object or still a JSON string. */
function safeParseJson<T = unknown>(value: unknown): T | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return undefined; }
  }
  return value as T;
}

export async function getSowByProject(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(sowDocuments)
    .where(eq(sowDocuments.projectId, projectId))
    .orderBy(desc(sowDocuments.version)).limit(1);
  const row = result[0];
  if (!row) return undefined;
  // Parse JSON fields that TiDB/mysql2 may return as strings
  return {
    ...row,
    specificObjectives: safeParseJson(row.specificObjectives),
    activitiesIncluded: safeParseJson(row.activitiesIncluded),
    deliverables: safeParseJson(row.deliverables),
    limitations: safeParseJson(row.limitations),
    assumptions: safeParseJson(row.assumptions),
    clientDependencies: safeParseJson(row.clientDependencies),
    risks: safeParseJson(row.risks),
    prerequisites: safeParseJson(row.prerequisites),
    milestones: safeParseJson(row.milestones),
    billingMilestones: safeParseJson(row.billingMilestones),
    prodigioTeam: safeParseJson(row.prodigioTeam),
    clientTeam: safeParseJson(row.clientTeam),
  };
}

export async function upsertSow(projectId: number, data: Partial<InsertSowDocument>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const rawAmount = data.totalAmount;
  const normalizedAmount = rawAmount === undefined
    ? undefined
    : (() => {
        const value = String(rawAmount).trim();
        if (!value) return null;
        const numeric = Number(value.replace(",", "."));
        return Number.isFinite(numeric) ? String(numeric) : null;
      })();
  const normalizedData = {
    ...data,
    ...(rawAmount === undefined ? {} : { totalAmount: normalizedAmount }),
  };
  const existing = await getSowByProject(projectId);
  if (existing) {
    await db.update(sowDocuments).set({ ...normalizedData, updatedAt: new Date() }).where(eq(sowDocuments.id, existing.id));
    return existing.id;
  } else {
    const [result] = await db.insert(sowDocuments).values({ projectId, ...normalizedData } as InsertSowDocument);
    return (result as any).insertId as number;
  }
}

// ==================== RISKS ====================
export async function getRisksByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(risks).where(eq(risks.projectId, projectId)).orderBy(risks.id);
}

export async function bulkInsertRisks(projectId: number, riskList: Omit<InsertRisk, "projectId">[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(risks).where(eq(risks.projectId, projectId));
  if (riskList.length > 0) {
    await db.insert(risks).values(riskList.map((r) => ({ ...r, projectId })));
  }
}

// ==================== RISK VERSIONS ====================
export async function getRiskVersionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(riskVersions)
    .where(eq(riskVersions.projectId, projectId))
    .orderBy(desc(riskVersions.createdAt));
}

export async function getNextRiskVersionNumber(projectId: number): Promise<string> {
  const db = await getDb();
  if (!db) return "v1.0";
  const versions = await db.select().from(riskVersions)
    .where(eq(riskVersions.projectId, projectId))
    .orderBy(desc(riskVersions.createdAt));
  if (versions.length === 0) return "v1.0";
  const last = versions[0].version; // e.g. "v1.2"
  const match = last.match(/v(\d+)\.(\d+)/);
  if (!match) return "v1.0";
  const minor = parseInt(match[2]) + 1;
  return `v${match[1]}.${minor}`;
}

export async function insertRiskVersion(data: InsertRiskVersion) {
  const db = await getDb();
  if (!db) return;
  await db.insert(riskVersions).values(data);
}

export async function updateRiskJiraKey(riskId: number, jiraIssueKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(risks).set({ jiraIssueKey, jiraTaskId: jiraIssueKey }).where(eq(risks.id, riskId));
}

export async function updateRiskConfirmed(riskId: number, confirmed: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(risks).set({ confirmed }).where(eq(risks.id, riskId));
}

export async function bulkUpdateRiskConfirmed(projectId: number, confirmedIds: number[]) {
  const db = await getDb();
  if (!db) return;
  // Reset all to false, then set confirmed ones to true
  await db.update(risks).set({ confirmed: false }).where(eq(risks.projectId, projectId));
  if (confirmedIds.length > 0) {
    await db.update(risks).set({ confirmed: true }).where(
      and(eq(risks.projectId, projectId), inArray(risks.id, confirmedIds))
    );
  }
}

export async function getConfirmedRisksByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(risks)
    .where(and(eq(risks.projectId, projectId), eq(risks.confirmed, true)))
    .orderBy(risks.id);
}

// ==================== WBS ====================
export async function getWbsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wbsTasks).where(eq(wbsTasks.projectId, projectId)).orderBy(wbsTasks.id);
}

export async function bulkInsertWbs(projectId: number, tasks: Omit<InsertWbsTask, "projectId">[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(wbsTasks).where(eq(wbsTasks.projectId, projectId));
  if (tasks.length > 0) {
    await db.insert(wbsTasks).values(tasks.map((t) => ({ ...t, projectId })));
  }
}

export async function updateWbsItemJiraKey(id: number, jiraIssueKey: string, jiraParentKey?: string | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(wbsTasks).set({ jiraIssueKey, jiraParentKey: jiraParentKey ?? null }).where(eq(wbsTasks.id, id));
}

// ==================== BILLING MILESTONES ====================
// ==================== EXECUTIVE DASHBOARD V2: CONTRACTUAL SOURCES ====================
export async function getExecutiveProjectSource(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(executiveProjectSources)
    .where(and(eq(executiveProjectSources.projectId, projectId), eq(executiveProjectSources.sourceStatus, "approved")))
    .orderBy(desc(executiveProjectSources.approvedAt)).limit(1);
  return rows[0];
}

export async function upsertExecutiveProjectSource(data: InsertExecutiveProjectSource) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await db.select({ id: executiveProjectSources.id }).from(executiveProjectSources)
    .where(and(eq(executiveProjectSources.projectId, data.projectId), eq(executiveProjectSources.baselineVersion, data.baselineVersion))).limit(1);
  if (existing[0]) {
    await db.update(executiveProjectSources).set(data).where(eq(executiveProjectSources.id, existing[0].id));
    return existing[0].id;
  }
  const [result] = await db.insert(executiveProjectSources).values(data);
  return Number((result as any).insertId);
}

export async function getExecutiveContractMilestones(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executiveContractMilestones)
    .where(sourceId
      ? and(eq(executiveContractMilestones.projectId, projectId), eq(executiveContractMilestones.sourceId, sourceId))
      : eq(executiveContractMilestones.projectId, projectId))
    .orderBy(executiveContractMilestones.milestoneCode);
}

export async function updateExecutiveContractMilestoneJiraObservation(
  milestoneId: number,
  observation: {
    jiraDueDate?: string | null;
    jiraClosedDate?: string | null;
    jiraStatusName?: string | null;
    semanticStatus?: "pending" | "fulfilled" | "delayed" | "blocked";
  }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(executiveContractMilestones)
    .set({ ...observation, lastObservedAt: new Date() })
    .where(eq(executiveContractMilestones.id, milestoneId));
}

export async function replaceExecutiveContractMilestones(projectId: number, sourceId: number, milestones: Omit<InsertExecutiveContractMilestone, "projectId" | "sourceId">[]) {
  const db = await getDb();
  if (!db) return;
  await db.delete(executiveContractMilestones).where(eq(executiveContractMilestones.sourceId, sourceId));
  if (milestones.length) await db.insert(executiveContractMilestones).values(milestones.map((milestone) => ({ ...milestone, projectId, sourceId })));
}

// ==================== EXECUTIVE DASHBOARD V2: EVIDENCE & GOVERNANCE ====================
export async function getExecutiveMilestoneAcceptances(projectId: number, sourceId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executiveMilestoneAcceptances)
    .where(and(eq(executiveMilestoneAcceptances.projectId, projectId), eq(executiveMilestoneAcceptances.sourceId, sourceId)))
    .orderBy(desc(executiveMilestoneAcceptances.createdAt));
}

export async function createExecutiveMilestoneAcceptance(data: InsertExecutiveMilestoneAcceptance) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveMilestoneAcceptances).values(data);
  return Number((result as any).insertId);
}

export async function getExecutiveMeetingMinutes(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = sourceId == null
    ? eq(executiveMeetingMinutes.projectId, projectId)
    : and(eq(executiveMeetingMinutes.projectId, projectId), eq(executiveMeetingMinutes.sourceId, sourceId));
  return db.select().from(executiveMeetingMinutes).where(filter).orderBy(desc(executiveMeetingMinutes.meetingDate));
}

export async function createExecutiveMeetingMinute(data: InsertExecutiveMeetingMinute) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveMeetingMinutes).values(data);
  return Number((result as any).insertId);
}

export async function getExecutiveCommitments(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(executiveCommitments)
    .where(eq(executiveCommitments.projectId, projectId))
    .orderBy(desc(executiveCommitments.createdAt));
}

export async function createExecutiveCommitment(data: InsertExecutiveCommitment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveCommitments).values(data);
  return Number((result as any).insertId);
}

export async function getExecutiveRequirements(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = sourceId == null
    ? eq(executiveRequirements.projectId, projectId)
    : and(eq(executiveRequirements.projectId, projectId), eq(executiveRequirements.sourceId, sourceId));
  return db.select().from(executiveRequirements).where(filter).orderBy(desc(executiveRequirements.createdAt));
}

export async function createExecutiveRequirement(data: InsertExecutiveRequirement) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveRequirements).values(data);
  return Number((result as any).insertId);
}

export async function getExecutiveRequirementById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(executiveRequirements).where(eq(executiveRequirements.id, id)).limit(1);
  return rows[0];
}

export async function closeExecutiveRequirement(id: number, data: { closedBy: number; closureEvidenceUrl: string; closureNotes?: string | null }) {
  const db = await getDb();
  if (!db) return;
  await db.update(executiveRequirements).set({ requirementStatus: "closed", closedAt: new Date(), ...data }).where(eq(executiveRequirements.id, id));
}

export async function waiveExecutiveRequirement(id: number, data: { waivedBy: number; waiverReason: string }) {
  const db = await getDb();
  if (!db) return;
  await db.update(executiveRequirements).set({ requirementStatus: "waived", waivedAt: new Date(), ...data }).where(eq(executiveRequirements.id, id));
}

export async function getLatestExecutiveRecoveryPlan(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filter = sourceId == null
    ? and(eq(executiveRecoveryPlans.projectId, projectId), eq(executiveRecoveryPlans.recoveryStatus, "vigente"))
    : and(eq(executiveRecoveryPlans.projectId, projectId), eq(executiveRecoveryPlans.sourceId, sourceId), eq(executiveRecoveryPlans.recoveryStatus, "vigente"));
  const rows = await db.select().from(executiveRecoveryPlans).where(filter).orderBy(desc(executiveRecoveryPlans.approvedAt)).limit(1);
  return rows[0];
}

export async function getExecutiveRecoveryPlans(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = sourceId == null
    ? eq(executiveRecoveryPlans.projectId, projectId)
    : and(eq(executiveRecoveryPlans.projectId, projectId), eq(executiveRecoveryPlans.sourceId, sourceId));
  return db.select().from(executiveRecoveryPlans).where(filter).orderBy(desc(executiveRecoveryPlans.createdAt));
}

export async function getExecutiveRecoveryPlanById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(executiveRecoveryPlans).where(eq(executiveRecoveryPlans.id, id)).limit(1);
  return rows[0];
}

export async function createExecutiveRecoveryPlan(data: InsertExecutiveRecoveryPlan) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveRecoveryPlans).values(data);
  return Number((result as any).insertId);
}

export async function approveExecutiveRecoveryPlan(input: { id: number; projectId: number; sourceId: number | null; approvedBy: number; approvedByName: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const activeFilter = input.sourceId == null
    ? and(eq(executiveRecoveryPlans.projectId, input.projectId), eq(executiveRecoveryPlans.recoveryStatus, "vigente"))
    : and(eq(executiveRecoveryPlans.projectId, input.projectId), eq(executiveRecoveryPlans.sourceId, input.sourceId), eq(executiveRecoveryPlans.recoveryStatus, "vigente"));
  await db.update(executiveRecoveryPlans).set({ recoveryStatus: "superseded" }).where(activeFilter);
  await db.update(executiveRecoveryPlans).set({ recoveryStatus: "vigente", approvedAt: new Date(), approvedBy: input.approvedBy, approvedByName: input.approvedByName }).where(eq(executiveRecoveryPlans.id, input.id));
}

export async function getExecutiveGovernanceAssignments(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return [];
  const filter = sourceId == null
    ? and(eq(executiveGovernanceAssignments.projectId, projectId), eq(executiveGovernanceAssignments.active, true))
    : and(eq(executiveGovernanceAssignments.projectId, projectId), eq(executiveGovernanceAssignments.sourceId, sourceId), eq(executiveGovernanceAssignments.active, true));
  return db.select().from(executiveGovernanceAssignments).where(filter).orderBy(desc(executiveGovernanceAssignments.assignedAt));
}

export async function replaceExecutiveGovernanceAssignment(data: InsertExecutiveGovernanceAssignment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const filter = data.sourceId == null
    ? and(eq(executiveGovernanceAssignments.projectId, data.projectId), eq(executiveGovernanceAssignments.governanceRole, data.governanceRole), eq(executiveGovernanceAssignments.active, true))
    : and(eq(executiveGovernanceAssignments.projectId, data.projectId), eq(executiveGovernanceAssignments.sourceId, data.sourceId), eq(executiveGovernanceAssignments.governanceRole, data.governanceRole), eq(executiveGovernanceAssignments.active, true));
  await db.update(executiveGovernanceAssignments).set({ active: false }).where(filter);
  const [result] = await db.insert(executiveGovernanceAssignments).values(data);
  return Number((result as any).insertId);
}

export async function createExecutiveFinancialSnapshot(data: InsertExecutiveFinancialSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveFinancialSnapshots).values(data);
  return Number((result as any).insertId);
}

export async function getLatestExecutiveFinancialSnapshot(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filter = sourceId == null
    ? eq(executiveFinancialSnapshots.projectId, projectId)
    : and(eq(executiveFinancialSnapshots.projectId, projectId), eq(executiveFinancialSnapshots.sourceId, sourceId));
  const rows = await db.select().from(executiveFinancialSnapshots).where(filter).orderBy(desc(executiveFinancialSnapshots.capturedAt)).limit(1);
  const row = rows[0];
  return row ? { ...row, financialData: safeParseJson(row.financialData) ?? {} } : undefined;
}

export async function createExecutiveDashboardSnapshot(data: InsertExecutiveDashboardSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(executiveDashboardSnapshots).values(data);
  return Number((result as any).insertId);
}

export async function getLatestExecutiveDashboardSnapshot(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const filter = sourceId == null
    ? eq(executiveDashboardSnapshots.projectId, projectId)
    : and(eq(executiveDashboardSnapshots.projectId, projectId), eq(executiveDashboardSnapshots.sourceId, sourceId));
  const rows = await db.select().from(executiveDashboardSnapshots).where(filter).orderBy(desc(executiveDashboardSnapshots.createdAt)).limit(1);
  const row = rows[0];
  return row ? { ...row, metrics: safeParseJson(row.metrics) ?? {} } : undefined;
}

/** Nunca usar un fixture como si fuera el corte oficial del dashboard. */
export async function getLatestExecutiveProductionDashboardSnapshot(projectId: number, sourceId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  const projectFilter = sourceId == null
    ? eq(executiveDashboardSnapshots.projectId, projectId)
    : and(eq(executiveDashboardSnapshots.projectId, projectId), eq(executiveDashboardSnapshots.sourceId, sourceId));
  const rows = await db.select().from(executiveDashboardSnapshots)
    .where(and(projectFilter, eq(executiveDashboardSnapshots.snapshotKind, "production")))
    .orderBy(desc(executiveDashboardSnapshots.createdAt)).limit(1);
  const row = rows[0];
  return row ? { ...row, metrics: safeParseJson(row.metrics) ?? {} } : undefined;
}

export async function getBillingByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(billingMilestones).where(eq(billingMilestones.projectId, projectId)).orderBy(billingMilestones.milestoneNumber);
}

export async function upsertBillingMilestones(projectId: number, milestoneList: any[]) {
  const db = await getDb();
  if (!db) return;
  // Preserve existing JIRA keys before deleting
  const existing = await db.select({ id: billingMilestones.id, milestoneNumber: billingMilestones.milestoneNumber, jiraIssueKey: billingMilestones.jiraIssueKey, jiraIssueId: billingMilestones.jiraIssueId })
    .from(billingMilestones).where(eq(billingMilestones.projectId, projectId));
  const existingByNum = new Map(existing.map(e => [e.milestoneNumber, e]));
  
  await db.delete(billingMilestones).where(eq(billingMilestones.projectId, projectId));
  if (milestoneList.length > 0) {
    await db.insert(billingMilestones).values(milestoneList.map((m, i) => {
      const num = i + 1;
      const prev = existingByNum.get(num);
      return {
        projectId,
        milestoneNumber: num,
        description: m.description || `Hito ${num}`,
        amount: m.amount && m.amount !== '' ? String(m.amount) : null,
        percentage: m.percentage && m.percentage !== '' ? String(m.percentage) : null,
        currency: m.currency || 'USD',
        dueDate: m.dueDate || null,
        responsableName: m.responsableName || null,
        responsableEmail: m.responsableEmail || null,
        dateSource: m.dateSource || null,
        // Preserve JIRA keys: use incoming value if present, otherwise keep previous value
        jiraIssueKey: m.jiraIssueKey || prev?.jiraIssueKey || null,
        jiraIssueId: m.jiraIssueId || prev?.jiraIssueId || null,
      };
    }));
  }
}

export async function updateBillingMilestoneJiraKey(id: number, jiraIssueKey: string, jiraIssueId?: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(billingMilestones).set({ jiraIssueKey, jiraIssueId: jiraIssueId ?? null }).where(eq(billingMilestones.id, id));
}

// ==================== GANTT UPLOADS ====================
export async function insertGanttUpload(data: InsertGanttUpload) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(ganttUploads).values(data);
  return (result as any).insertId as number;
}

export async function getLatestGanttUpload(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(ganttUploads)
    .where(eq(ganttUploads.projectId, projectId))
    .orderBy(desc(ganttUploads.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

// ==================== DESIGN ====================
export async function getDesignByProject(projectId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(designDocuments).where(eq(designDocuments.projectId, projectId)).limit(1);
  return result[0];
}

export async function upsertDesign(projectId: number, data: any) {
  const db = await getDb();
  if (!db) return;
  const existing = await getDesignByProject(projectId);
  if (existing) {
    await db.update(designDocuments).set({ ...data, updatedAt: new Date() }).where(eq(designDocuments.id, existing.id));
  } else {
    await db.insert(designDocuments).values({ projectId, ...data });
  }
}

// ==================== LESSONS LEARNED ====================
export async function getLessonsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lessonsLearned).where(eq(lessonsLearned.projectId, projectId));
}

export async function upsertLesson(projectId: number, data: any) {
  const db = await getDb();
  if (!db) return;
  const existing = await getLessonsByProject(projectId);
  if (existing[0]) {
    await db.update(lessonsLearned).set({ ...data, updatedAt: new Date() }).where(eq(lessonsLearned.id, existing[0].id));
  } else {
    await db.insert(lessonsLearned).values({ projectId, ...data });
  }
}

// ==================== FILES ====================
export async function saveUploadedFile(data: any) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(uploadedFiles).values(data);
  return (result as any).insertId as number;
}

// ==================== STATS ====================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { total: 0, active: 0, completed: 0, users: 0 };
  const [totalRes] = await db.select({ count: sql<number>`count(*)` }).from(projects);
  const [activeRes] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, "activo"));
  const [completedRes] = await db.select({ count: sql<number>`count(*)` }).from(projects).where(eq(projects.status, "completado"));
  const [usersRes] = await db.select({ count: sql<number>`count(*)` }).from(users);
  return {
    total: Number(totalRes?.count ?? 0),
    active: Number(activeRes?.count ?? 0),
    completed: Number(completedRes?.count ?? 0),
    users: Number(usersRes?.count ?? 0),
  };
}

// ==================== SOW VERSIONS ====================
export async function saveSowVersion(data: InsertSowVersion) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(sowVersions).values(data);
  return (result as any).insertId as number;
}

export async function getSowVersionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sowVersions).where(eq(sowVersions.projectId, projectId)).orderBy(desc(sowVersions.createdAt));
}

// ==================== STAGE DEADLINES ====================
export async function getAllStageDeadlines() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stageDeadlines).orderBy(stageDeadlines.id);
}

export async function upsertStageDeadline(stageId: string, maxBusinessDays: number, label: string, description?: string) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(stageDeadlines).where(eq(stageDeadlines.stageId, stageId as any)).limit(1);
  if (existing[0]) {
    await db.update(stageDeadlines)
      .set({ maxBusinessDays, label, description: description ?? null, updatedAt: new Date() })
      .where(eq(stageDeadlines.stageId, stageId as any));
  } else {
    await db.insert(stageDeadlines).values({ stageId: stageId as any, maxBusinessDays, label, description });
  }
}

// ==================== STAGE OPENINGS ====================
export async function getStageOpening(projectId: number, stageId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stageOpenings)
    .where(and(eq(stageOpenings.projectId, projectId), eq(stageOpenings.stageId, stageId as any)))
    .limit(1);
  return result[0];
}

export async function getStageOpeningsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stageOpenings).where(eq(stageOpenings.projectId, projectId));
}

export async function recordStageOpening(projectId: number, stageId: string, openedBy: number) {
  const db = await getDb();
  if (!db) return null;
  // Only record if not already opened
  const existing = await getStageOpening(projectId, stageId);
  if (existing) return existing;
  await db.insert(stageOpenings).values({ projectId, stageId: stageId as any, openedBy });
  return getStageOpening(projectId, stageId);
}

// ==================== HOLIDAYS ====================
export async function getHolidaysByYear(year: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(holidays).where(eq(holidays.year, year)).orderBy(holidays.date);
}

export async function getAllHolidays() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(holidays).orderBy(holidays.date);
}

export async function getHolidaysInRange(startDate: string, endDate: string) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.execute(
    sql`SELECT date, name FROM holidays WHERE date >= ${startDate} AND date <= ${endDate} ORDER BY date`
  );
  return (result as any)[0] || [];
}

// ==================== BUSINESS DAYS CALCULATION ====================
/**
 * Calculate the deadline date by adding business days to a start date,
 * excluding weekends (Sat/Sun) and Chilean holidays.
 */
export async function calculateDeadlineDate(startDate: Date, businessDays: number): Promise<Date> {
  const db = await getDb();
  // Get all holidays as a Set of date strings for O(1) lookup
  const allHolidays = db ? await db.select({ date: holidays.date }).from(holidays) : [];
  const holidaySet = new Set(allHolidays.map((h) => {
    const d = h.date;
    return String(d);
  }));

  let count = 0;
  const current = new Date(startDate);
  
  while (count < businessDays) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay(); // 0=Sun, 6=Sat
    if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends
    const dateStr = current.toISOString().split("T")[0];
    if (holidaySet.has(dateStr)) continue; // Skip holidays
    count++;
  }
  
  return current;
}

/**
 * Calculate remaining business days between today and a deadline date,
 * excluding weekends and Chilean holidays.
 * Returns negative if past deadline.
 */
export async function calculateRemainingBusinessDays(deadlineDate: Date): Promise<number> {
  const db = await getDb();
  const allHolidays = db ? await db.select({ date: holidays.date }).from(holidays) : [];
  const holidaySet = new Set(allHolidays.map((h) => {
    const d = h.date;
    return String(d);
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDate);
  deadline.setHours(0, 0, 0, 0);

  if (today >= deadline) {
    // Count negative business days
    let count = 0;
    const current = new Date(deadline);
    while (current < today) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      const dateStr = current.toISOString().split("T")[0];
      if (holidaySet.has(dateStr)) continue;
      count++;
    }
    return -count;
  }

  // Count positive business days remaining
  let count = 0;
  const current = new Date(today);
  while (current < deadline) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const dateStr = current.toISOString().split("T")[0];
    if (holidaySet.has(dateStr)) continue;
    count++;
  }
  return count;
}

/**
 * Calculate the number of business days between two dates,
 * excluding weekends and Chilean holidays.
 */
export async function calculateBusinessDaysBetween(startDate: Date, endDate: Date): Promise<number> {
  const db = await getDb();
  const allHolidays = db ? await db.select({ date: holidays.date }).from(holidays) : [];
  const holidaySet = new Set(allHolidays.map((h) => String(h.date)));

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  if (start >= end) return 0;

  let count = 0;
  const current = new Date(start);
  while (current < end) {
    current.setDate(current.getDate() + 1);
    const dayOfWeek = current.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    const dateStr = current.toISOString().split("T")[0];
    if (holidaySet.has(dateStr)) continue;
    count++;
  }
  return count;
}

// ==================== STAGE DEADLINE EXTENSIONS ====================
export async function getExtensionsByProjectStage(projectId: number, stageId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stageDeadlineExtensions)
    .where(and(eq(stageDeadlineExtensions.projectId, projectId), eq(stageDeadlineExtensions.stageId, stageId as any)))
    .orderBy(desc(stageDeadlineExtensions.createdAt));
}

export async function getExtensionsByProject(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stageDeadlineExtensions)
    .where(eq(stageDeadlineExtensions.projectId, projectId))
    .orderBy(desc(stageDeadlineExtensions.createdAt));
}

export async function createExtension(data: InsertStageDeadlineExtension) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(stageDeadlineExtensions).values(data);
  return (result as any).insertId as number;
}

/**
 * Check if a stage is currently paused (last action is "pause" without a subsequent "resume")
 */
export async function isStagePaused(projectId: number, stageId: string): Promise<boolean> {
  const extensions = await getExtensionsByProjectStage(projectId, stageId);
  if (extensions.length === 0) return false;
  // Most recent action determines state
  return extensions[0].type === "pause";
}

/**
 * Calculate total extra business days from extensions for a project stage
 */
export async function getTotalExtraDays(projectId: number, stageId: string): Promise<number> {
  const extensions = await getExtensionsByProjectStage(projectId, stageId);
  return extensions
    .filter((e) => e.type === "extend")
    .reduce((sum, e) => sum + (e.extraDays ?? 0), 0);
}

/**
 * Calculate total paused business days for a project stage.
 * Counts business days between each pause-resume pair.
 */
export async function getTotalPausedDays(projectId: number, stageId: string): Promise<number> {
  const extensions = await getExtensionsByProjectStage(projectId, stageId);
  if (extensions.length === 0) return 0;

  // Sort by createdAt ascending
  const sorted = [...extensions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  const db = await getDb();
  const allHolidays = db ? await db.select({ date: holidays.date }).from(holidays) : [];
  const holidaySet = new Set(allHolidays.map((h) => {
    const d = h.date;
    return String(d);
  }));

  let totalPaused = 0;
  let pauseStart: Date | null = null;

  for (const ext of sorted) {
    if (ext.type === "pause") {
      pauseStart = new Date(ext.createdAt);
    } else if (ext.type === "resume" && pauseStart) {
      const resumeDate = new Date(ext.createdAt);
      // Count business days between pause and resume
      const current = new Date(pauseStart);
      while (current < resumeDate) {
        current.setDate(current.getDate() + 1);
        const dayOfWeek = current.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;
        const dateStr = current.toISOString().split("T")[0];
        if (holidaySet.has(dateStr)) continue;
        totalPaused++;
      }
      pauseStart = null;
    }
  }

  // If currently paused (no resume after last pause), count up to today
  if (pauseStart) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const current = new Date(pauseStart);
    while (current < today) {
      current.setDate(current.getDate() + 1);
      const dayOfWeek = current.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;
      const dateStr = current.toISOString().split("T")[0];
      if (holidaySet.has(dateStr)) continue;
      totalPaused++;
    }
  }

  return totalPaused;
}

// ==================== DEADLINE NOTIFICATIONS ====================
export async function hasNotificationBeenSent(projectId: number, stageId: string, notificationType: "warning_75" | "overdue") {
  const db = await getDb();
  if (!db) return true; // Assume sent to prevent spam if DB is down
  const result = await db.select().from(deadlineNotifications)
    .where(and(
      eq(deadlineNotifications.projectId, projectId),
      eq(deadlineNotifications.stageId, stageId as any),
      eq(deadlineNotifications.notificationType, notificationType),
    ))
    .limit(1);
  return result.length > 0;
}

export async function recordNotificationSent(data: InsertDeadlineNotification) {
  const db = await getDb();
  if (!db) return;
  await db.insert(deadlineNotifications).values(data);
}

// ==================== COMPLIANCE METRICS ====================
export async function getComplianceMetrics() {
  const db = await getDb();
  if (!db) return { onTime: 0, late: 0, inProgress: 0, details: [] as any[] };

  // Get all projects with their stages
  const allProjects = await db.select().from(projects);
  const allStages = await db.select().from(projectStages);
  const allOpenings = await db.select().from(stageOpenings);
  const allDeadlines = await db.select().from(stageDeadlines);
  const allExtensions = await db.select().from(stageDeadlineExtensions);

  // Get holidays for business day calculation
  const allHolidays = await db.select({ date: holidays.date }).from(holidays);
  const holidaySet = new Set(allHolidays.map((h) => {
    const d = h.date;
    return String(d);
  }));

  let onTime = 0;
  let late = 0;
  let inProgress = 0;
  const details: Array<{
    projectId: number;
    projectName: string;
    stageId: string;
    status: "on_time" | "late" | "in_progress" | "not_started";
    daysUsed: number;
    totalAllowed: number;
  }> = [];

  for (const project of allProjects) {
    for (const deadline of allDeadlines) {
      const stage = allStages.find((s) => s.projectId === project.id && s.stageId === deadline.stageId);
      const opening = allOpenings.find((o) => o.projectId === project.id && o.stageId === deadline.stageId);

      if (!opening) {
        details.push({
          projectId: project.id,
          projectName: project.projectName,
          stageId: deadline.stageId,
          status: "not_started",
          daysUsed: 0,
          totalAllowed: deadline.maxBusinessDays,
        });
        continue;
      }

      // Calculate extra days from extensions
      const extensions = allExtensions.filter((e) => e.projectId === project.id && e.stageId === deadline.stageId);
      const extraDays = extensions.filter((e) => e.type === "extend").reduce((sum, e) => sum + (e.extraDays ?? 0), 0);

      // Calculate paused days
      const sortedExts = [...extensions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      let pausedDays = 0;
      let pauseStart: Date | null = null;
      for (const ext of sortedExts) {
        if (ext.type === "pause") pauseStart = new Date(ext.createdAt);
        else if (ext.type === "resume" && pauseStart) {
          const current = new Date(pauseStart);
          const resumeDate = new Date(ext.createdAt);
          while (current < resumeDate) {
            current.setDate(current.getDate() + 1);
            const dow = current.getDay();
            if (dow === 0 || dow === 6) continue;
            if (holidaySet.has(current.toISOString().split("T")[0])) continue;
            pausedDays++;
          }
          pauseStart = null;
        }
      }
      if (pauseStart) {
        const current = new Date(pauseStart);
        const today = new Date(); today.setHours(0,0,0,0);
        while (current < today) {
          current.setDate(current.getDate() + 1);
          const dow = current.getDay();
          if (dow === 0 || dow === 6) continue;
          if (holidaySet.has(current.toISOString().split("T")[0])) continue;
          pausedDays++;
        }
      }

      const totalAllowed = deadline.maxBusinessDays + extraDays;
      const isCompleted = stage?.status === "completed";

      // Count business days used
      const endDate = isCompleted && stage?.completedAt ? new Date(stage.completedAt) : new Date();
      const startDate = new Date(opening.openedAt);
      let daysUsed = 0;
      const current = new Date(startDate);
      while (current < endDate) {
        current.setDate(current.getDate() + 1);
        const dow = current.getDay();
        if (dow === 0 || dow === 6) continue;
        if (holidaySet.has(current.toISOString().split("T")[0])) continue;
        daysUsed++;
      }
      daysUsed = Math.max(0, daysUsed - pausedDays);

      if (isCompleted) {
        if (daysUsed <= totalAllowed) { onTime++; }
        else { late++; }
        details.push({
          projectId: project.id,
          projectName: project.projectName,
          stageId: deadline.stageId,
          status: daysUsed <= totalAllowed ? "on_time" : "late",
          daysUsed,
          totalAllowed,
        });
      } else if (stage?.status === "in_progress") {
        inProgress++;
        details.push({
          projectId: project.id,
          projectName: project.projectName,
          stageId: deadline.stageId,
          status: "in_progress",
          daysUsed,
          totalAllowed,
        });
      }
    }
  }

  return { onTime, late, inProgress, details };
}

// ==================== STAGE APPROVALS ====================
export async function getStageApproval(projectId: number, stageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(stageApprovals)
    .where(and(eq(stageApprovals.projectId, projectId), eq(stageApprovals.stageId, stageId as any)))
    .orderBy(desc(stageApprovals.uploadedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createStageApproval(data: {
  projectId: number;
  stageId: string;
  fileName: string;
  fileUrl: string;
  fileKey: string;
  fileSize?: number;
  mimeType?: string;
  notes?: string;
  clientApproverName?: string;
  clientApprovalDate?: string;
  uploadedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(stageApprovals).values({
    projectId: data.projectId,
    stageId: data.stageId as any,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    fileKey: data.fileKey,
    fileSize: data.fileSize,
    mimeType: data.mimeType,
    notes: data.notes,
    clientApproverName: data.clientApproverName,
    clientApprovalDate: data.clientApprovalDate,
    uploadedBy: data.uploadedBy,
  });
  return result[0].insertId;
}

export async function getUploadedFilesByProject(projectId: number, purpose?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(uploadedFiles.projectId, projectId)];
  if (purpose) conditions.push(eq(uploadedFiles.purpose, purpose as any));
  return db.select().from(uploadedFiles)
    .where(and(...conditions))
    .orderBy(desc(uploadedFiles.createdAt));
}

export async function deleteUploadedFile(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(uploadedFiles).where(eq(uploadedFiles.id, id));
}

export async function closeStageApproval(projectId: number, stageId: string, closedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(stageApprovals)
    .set({ closedAt: new Date(), closedBy })
    .where(and(
      eq(stageApprovals.projectId, projectId),
      eq(stageApprovals.stageId, stageId as any),
      isNull(stageApprovals.closedAt),
    ));
}

export async function deleteStageApproval(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(stageApprovals).where(eq(stageApprovals.id, id));
}

// ==================== STAGE CLOSURES ====================
export async function getStageClosure(projectId: number, stageId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(stageClosures)
    .where(and(eq(stageClosures.projectId, projectId), eq(stageClosures.stageId, stageId as any)))
    .orderBy(desc(stageClosures.closedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function createStageClosure(data: {
  projectId: number;
  stageId: string;
  closedBy: number;
  closedByName: string;
  confirmationText: string;
  notes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(stageClosures).values({
    projectId: data.projectId,
    stageId: data.stageId as any,
    closedBy: data.closedBy,
    closedByName: data.closedByName,
    confirmationText: data.confirmationText,
    notes: data.notes || null,
  });
  return (result as any).insertId as number;
}

export async function getAllStageClosures(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stageClosures)
    .where(eq(stageClosures.projectId, projectId))
    .orderBy(desc(stageClosures.closedAt));
}

// ==================== SOW VERSION SERIALIZATION ====================
export async function getNextSowVersionNumber(projectId: number): Promise<string> {
  const versions = await getSowVersionsByProject(projectId);
  if (versions.length === 0) return "v1.0";
  // Parse existing versions and find the highest
  let maxMajor = 0;
  let maxMinor = 0;
  for (const v of versions) {
    const match = v.version.match(/v?(\d+)\.(\d+)/);
    if (match) {
      const major = parseInt(match[1], 10);
      const minor = parseInt(match[2], 10);
      if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
        maxMajor = major;
        maxMinor = minor;
      }
    }
  }
  // Increment minor version
  return `v${maxMajor}.${maxMinor + 1}`;
}

// ==================== AUDIT LOGS ====================
export async function createAuditLog(log: {
  action: string;
  entity: string;
  entityId?: string | number | null;
  entityName?: string | null;
  userId?: number | null;
  userName?: string | null;
  userRole?: string | null;
  details?: Record<string, any> | null;
  ipAddress?: string | null;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(auditLogs).values({
      action: log.action,
      entity: log.entity,
      entityId: log.entityId != null ? String(log.entityId) : null,
      entityName: log.entityName || null,
      userId: log.userId || null,
      userName: log.userName || null,
      userRole: log.userRole || null,
      details: log.details || null,
      ipAddress: log.ipAddress || null,
    });
  } catch (err) {
    console.error("[AuditLog] Failed to create audit log:", err);
    // Don't throw - audit logging should never break the main operation
  }
}

export async function getAuditLogs(filters: {
  action?: string;
  entity?: string;
  userId?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ logs: any[]; total: number }> {
  const db = await getDb();
  if (!db) return { logs: [], total: 0 };
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const offset = (page - 1) * pageSize;

  const conditions: any[] = [];
  if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
  if (filters.entity) conditions.push(eq(auditLogs.entity, filters.entity));
  if (filters.userId) conditions.push(eq(auditLogs.userId, filters.userId));
  if (filters.search) conditions.push(like(auditLogs.entityName, `%${filters.search}%`));
  if (filters.dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(filters.dateFrom)));
  if (filters.dateTo) conditions.push(lte(auditLogs.createdAt, new Date(filters.dateTo)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, totalResult] = await Promise.all([
    db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(pageSize).offset(offset),
    db.select({ count: count() }).from(auditLogs).where(where),
  ]);

  return { logs, total: totalResult[0]?.count || 0 };
}

export async function getAuditLogDistinctActions(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ action: auditLogs.action }).from(auditLogs).orderBy(auditLogs.action);
  return result.map(r => r.action);
}

export async function getAuditLogDistinctEntities(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.selectDistinct({ entity: auditLogs.entity }).from(auditLogs).orderBy(auditLogs.entity);
  return result.map(r => r.entity);
}

// ==================== JIRA SPACES ====================
export async function createJiraSpaceRecord(data: InsertJiraSpace) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [result] = await db.insert(jiraSpaces).values(data);
  return (result as any).insertId as number;
}

export async function getJiraSpaceByProject(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(jiraSpaces)
    .where(eq(jiraSpaces.projectId, projectId))
    .orderBy(desc(jiraSpaces.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllJiraSpaces() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(jiraSpaces).orderBy(desc(jiraSpaces.createdAt));
}

export async function updateJiraSpaceStatus(
  id: number,
  data: { status: "created" | "pending_permissions" | "linked"; jiraProjectKey?: string; jiraProjectId?: string; jiraProjectName?: string; jiraProjectUrl?: string }
) {
  const db = await getDb();
  if (!db) return;
  await db.update(jiraSpaces).set(data).where(eq(jiraSpaces.id, id));
}


// ==================== LINKED PROJECTS ====================

/**
 * Create a project linked from an existing JIRA project.
 * Los proyectos vinculados conservan el pipeline canónico completo.
 * Ninguna etapa se cierra sin evidencia y confirmación humana.
 */
export async function createLinkedProject(data: {
  projectName: string;
  clientName: string;
  jiraProjectKey: string;
  jiraProjectUrl: string;
  pmoId: number;
  pmId?: number | null;
  projectType?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const stagePlan = buildCanonicalLinkedProjectStagePlan();
  const [result] = await db.insert(projects).values({
    projectName: data.projectName,
    clientName: data.clientName,
    jiraProjectKey: data.jiraProjectKey,
    jiraProjectUrl: data.jiraProjectUrl,
    pmoId: data.pmoId,
    pmId: data.pmId ?? null,
    projectType: (data.projectType as any) ?? "otro",
    status: stagePlan.projectStatus,
    currentStage: stagePlan.currentStage,
    origin: "linked",
  });
  const projectId = (result as any).insertId as number;
  for (const stage of stagePlan.stages) {
    await db.insert(projectStages).values({
      projectId,
      stageId: stage.stageId,
      status: stage.status,
      progress: stage.progress,
      completedAt: null,
      data: stage.data,
    });
  }
  return projectId;
}

export async function getProjectByJiraProjectKey(jiraProjectKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projects)
    .where(eq(projects.jiraProjectKey, jiraProjectKey.trim().toUpperCase()))
    .limit(1);
  return rows[0] ?? null;
}

export async function bindJiraOnboardingToProject(input: {
  onboardingId: number;
  projectId: number;
  jiraSpaceId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(jiraProjectOnboardings).set({
    projectId: input.projectId,
    jiraSpaceId: input.jiraSpaceId,
    currentStep: 5,
    lastError: null,
    updatedAt: new Date(),
  }).where(eq(jiraProjectOnboardings.id, input.onboardingId));
  await db.update(jiraEntityMappings).set({
    projectId: input.projectId,
    updatedAt: new Date(),
  }).where(eq(jiraEntityMappings.onboardingId, input.onboardingId));
}

export async function createHomologatedStageClosure(input: {
  projectId: number;
  onboardingId: number;
  stageId: "sow" | "jira" | "risks" | "planning" | "design" | "closure";
  closedBy: number;
  closedByName: string;
  actorConfirmed: boolean;
  confirmationText: string;
  evidenceSource: string;
  evidenceReference: string;
  evidenceDate: string;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getStageClosure(input.projectId, input.stageId);
  if (existing) return { closure: existing, created: false };

  const stages = await getProjectStages(input.projectId);
  const current = stages.find(stage => stage.stageId === input.stageId);
  if (!current) throw new Error("La etapa no existe en el proyecto");
  const stageStatuses = Object.fromEntries(stages.map(stage => [stage.stageId, stage.status])) as any;
  const assessment = assessHomologatedStageClosure({
    stageId: input.stageId,
    stageStatus: current.status,
    stageStatuses,
    actorConfirmed: input.actorConfirmed,
    evidenceSource: input.evidenceSource,
    evidenceReference: input.evidenceReference,
    evidenceDate: input.evidenceDate,
    notes: input.notes,
  });
  if (!assessment.allowed) throw new Error(assessment.errors.join(" "));

  const [result] = await db.insert(stageClosures).values({
    projectId: input.projectId,
    stageId: input.stageId,
    closedBy: input.closedBy,
    closedByName: input.closedByName,
    confirmationText: input.confirmationText,
    notes: input.notes?.trim() || null,
    closureMode: "homologated",
    onboardingId: input.onboardingId,
    evidenceSource: input.evidenceSource.trim(),
    evidenceReference: input.evidenceReference.trim(),
    evidenceDate: input.evidenceDate,
    homologationMetadata: {
      actorConfirmed: true,
      jiraStatusIsNotClientAcceptance: true,
      reconciledAt: new Date().toISOString(),
    },
  });
  const closureId = (result as any).insertId as number;
  if (input.stageId === "closure") {
    await updateProjectStage(input.projectId, "closure", { status: "completed", progress: 100, completedAt: new Date() });
    await updateProject(input.projectId, { status: "completado", currentStage: "closure" });
  } else {
    await unlockNextStage(input.projectId, input.stageId);
  }
  const closure = await getStageClosure(input.projectId, input.stageId);
  return { closure: closure ?? { id: closureId }, created: true };
}

export async function reconcileHistoricalStageClosure(input: {
  projectId: number;
  onboardingId?: number | null;
  stageId: "sow" | "jira" | "risks" | "planning" | "design" | "closure";
  closedBy: number;
  closedByName: string;
  actorConfirmed: boolean;
  confirmationText: string;
  evidenceSource: string;
  evidenceReference: string;
  evidenceDate: string;
  notes?: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const project = await getProjectById(input.projectId);
  if (!project || project.origin !== "linked") {
    throw new Error("La conciliación histórica solo aplica a proyectos vinculados desde Jira.");
  }
  const stages = await getProjectStages(input.projectId);
  const current = stages.find(stage => stage.stageId === input.stageId);
  if (!current) throw new Error("La etapa no existe en el proyecto");
  const existing = await getStageClosure(input.projectId, input.stageId);
  const existingHomologatedEvidence = Boolean(
    existing?.closureMode === "homologated" && existing.evidenceReference && existing.evidenceSource && existing.evidenceDate,
  );
  const stageStatuses = Object.fromEntries(stages.map(stage => [stage.stageId, stage.status])) as any;
  const assessment = assessHistoricalStageReconciliation({
    stageId: input.stageId,
    stageStatus: current.status,
    stageStatuses,
    existingHomologatedEvidence,
    actorConfirmed: input.actorConfirmed,
    evidenceSource: input.evidenceSource,
    evidenceReference: input.evidenceReference,
    evidenceDate: input.evidenceDate,
    notes: input.notes,
  });
  if (!assessment.allowed) throw new Error(assessment.errors.join(" "));
  if (assessment.idempotent && existing) return { closure: existing, created: false, stageStatusPreserved: true };

  const metadata = buildHistoricalReconciliationMetadata({
    stageId: input.stageId,
    stageStatus: current.status,
    stageStatuses,
    existingHomologatedEvidence: false,
    actorConfirmed: input.actorConfirmed,
    evidenceSource: input.evidenceSource,
    evidenceReference: input.evidenceReference,
    evidenceDate: input.evidenceDate,
    notes: input.notes,
  });
  const values = {
    closedBy: input.closedBy,
    closedByName: input.closedByName,
    confirmationText: input.confirmationText,
    notes: input.notes?.trim() || null,
    closureMode: metadata.closureMode,
    onboardingId: input.onboardingId ?? null,
    evidenceSource: metadata.evidenceSource,
    evidenceReference: metadata.evidenceReference,
    evidenceDate: metadata.evidenceDate,
    homologationMetadata: {
      ...metadata.homologationMetadata,
      reconciledAt: new Date().toISOString(),
      previousClosureId: existing?.id ?? null,
    },
  } as const;

  if (existing) {
    await db.update(stageClosures).set(values).where(eq(stageClosures.id, existing.id));
  } else {
    await db.insert(stageClosures).values({ projectId: input.projectId, stageId: input.stageId, ...values });
  }
  const closure = await getStageClosure(input.projectId, input.stageId);
  return { closure, created: !existing, stageStatusPreserved: true };
}

/**
 * Get all JIRA project keys that are already managed in the PMO platform.
 */
export async function getManagedJiraProjectKeys(): Promise<string[]> {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select({ key: projects.jiraProjectKey }).from(projects)
    .where(sql`${projects.jiraProjectKey} IS NOT NULL AND ${projects.jiraProjectKey} != ''`);
  return result.map(r => r.key!).filter(Boolean);
}

async function deleteJiraOnboardingRecordsForProject(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  projectId: number,
) {
  const onboardings = await db.select({ id: jiraProjectOnboardings.id })
    .from(jiraProjectOnboardings)
    .where(eq(jiraProjectOnboardings.projectId, projectId));

  for (const onboarding of onboardings) {
    await db.delete(jiraEntityMappings).where(eq(jiraEntityMappings.onboardingId, onboarding.id));
    await db.delete(jiraImportExceptions).where(eq(jiraImportExceptions.onboardingId, onboarding.id));
    await db.delete(jiraSyncLogs).where(eq(jiraSyncLogs.onboardingId, onboarding.id));
  }

  await db.delete(jiraEntityMappings).where(eq(jiraEntityMappings.projectId, projectId));
  await db.delete(jiraImportExceptions).where(eq(jiraImportExceptions.projectId, projectId));
  await db.delete(jiraSyncLogs).where(eq(jiraSyncLogs.projectId, projectId));
  await db.delete(jiraProjectOnboardings).where(eq(jiraProjectOnboardings.projectId, projectId));
}


/**
 * Unlink a linked JIRA project: deletes the project and all associated records.
 * Only works for projects with origin='linked'.
 * Returns the project name for audit/confirmation purposes.
 */
export async function unlinkProject(projectId: number): Promise<{ deleted: boolean; projectName: string | null }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Verify the project exists and is linked
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return { deleted: false, projectName: null };
  if (project.origin !== "linked") {
    throw new Error("Solo se pueden desvincular proyectos con origen 'linked'");
  }

  const projectName = project.projectName;

  // Delete all associated records (linked projects only have stages and jira_spaces)
  await deleteJiraOnboardingRecordsForProject(db, projectId);
  await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
  await db.delete(jiraSpaces).where(eq(jiraSpaces.projectId, projectId));
  await db.delete(stageOpenings).where(eq(stageOpenings.projectId, projectId));
  await db.delete(auditLogs).where(eq(auditLogs.entityId, String(projectId)));
  await db.delete(projects).where(eq(projects.id, projectId));

  return { deleted: true, projectName };
}

/**
 * Delete a PMO project (admin only). Blocked if currentStage is 'design' or 'closure'.
 * Performs a full cascade delete across all related tables.
 */
export async function deleteProjectAdmin(projectId: number): Promise<{ deleted: boolean; projectName: string | null; blockedReason?: string }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
  if (!project) return { deleted: false, projectName: null };

  // Block deletion if project is in design (Diseño/Ejecución) or closure stage
  const BLOCKED_STAGES = ["design", "closure"];
  if (BLOCKED_STAGES.includes(project.currentStage)) {
    const stageNames: Record<string, string> = { design: "Diseño/Ejecución", closure: "Cierre" };
    return {
      deleted: false,
      projectName: project.projectName,
      blockedReason: `No se puede eliminar un proyecto en etapa de ${stageNames[project.currentStage]}. Solo se permiten proyectos en etapas iniciales (SoW, JIRA, Riesgos, Planificación).`,
    };
  }

  const projectName = project.projectName;

  // Full cascade delete
  await deleteJiraOnboardingRecordsForProject(db, projectId);
  await db.delete(executiveContractMilestones).where(eq(executiveContractMilestones.projectId, projectId));
  await db.delete(executiveProjectSources).where(eq(executiveProjectSources.projectId, projectId));
  await db.delete(billingMilestones).where(eq(billingMilestones.projectId, projectId));
  await db.delete(deadlineNotifications).where(eq(deadlineNotifications.projectId, projectId));
  await db.delete(designDocuments).where(eq(designDocuments.projectId, projectId));
  await db.delete(executiveVerdicts).where(eq(executiveVerdicts.projectId, projectId));
  await db.delete(ganttUploads).where(eq(ganttUploads.projectId, projectId));
  await db.delete(jiraSpaces).where(eq(jiraSpaces.projectId, projectId));
  await db.delete(lessonsLearned).where(eq(lessonsLearned.projectId, projectId));
  await db.delete(linkedProjectDocuments).where(eq(linkedProjectDocuments.projectId, projectId));
  await db.delete(riskVersions).where(eq(riskVersions.projectId, projectId));
  await db.delete(risks).where(eq(risks.projectId, projectId));
  await db.delete(sowDocuments).where(eq(sowDocuments.projectId, projectId));
  await db.delete(sowVersions).where(eq(sowVersions.projectId, projectId));
  await db.delete(stageApprovals).where(eq(stageApprovals.projectId, projectId));
  await db.delete(stageClosures).where(eq(stageClosures.projectId, projectId));
  await db.delete(stageDeadlineExtensions).where(eq(stageDeadlineExtensions.projectId, projectId));
  await db.delete(stageOpenings).where(eq(stageOpenings.projectId, projectId));
  await db.delete(uploadedFiles).where(eq(uploadedFiles.projectId, projectId));
  await db.delete(wbsTasks).where(eq(wbsTasks.projectId, projectId));
  await db.delete(projectStages).where(eq(projectStages.projectId, projectId));
  await db.delete(auditLogs).where(and(eq(auditLogs.entity, "project"), eq(auditLogs.entityId, String(projectId))));
  await db.delete(projects).where(eq(projects.id, projectId));

  return { deleted: true, projectName };
}

// ==================== FINANCIAL DATA ====================

export async function getFinancialDataByDealId(dealId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(financialData).where(eq(financialData.dealId, dealId)).limit(1);
  return result[0];
}

export async function getAllFinancialData() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialData).orderBy(desc(financialData.syncedAt));
}

export async function getActiveFinancialData() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(financialData).where(
    or(
      eq(financialData.estadoProyecto, "EN EJECUCION"),
      eq(financialData.estadoProyecto, "EN EJECUCIÓN"),
      eq(financialData.estadoProyecto, "CERRADO")
    )
  );
}

export async function upsertFinancialData(data: InsertFinancialData) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const updateSet: Record<string, unknown> = { ...data };
  delete (updateSet as any).id;
  delete (updateSet as any).createdAt;
  updateSet.syncedAt = new Date();
  await db.insert(financialData).values({ ...data, syncedAt: new Date() }).onDuplicateKeyUpdate({ set: updateSet });
}

export async function bulkUpsertFinancialData(rows: InsertFinancialData[]) {
  for (const row of rows) {
    await upsertFinancialData(row);
  }
  return rows.length;
}

export async function getFinancialDataSyncInfo() {
  const db = await getDb();
  if (!db) return { count: 0, lastSync: null };
  const [countResult] = await db.select({ total: count() }).from(financialData);
  const [latestResult] = await db.select({ syncedAt: financialData.syncedAt }).from(financialData).orderBy(desc(financialData.syncedAt)).limit(1);
  return {
    count: countResult?.total ?? 0,
    lastSync: latestResult?.syncedAt ?? null,
  };
}


// ==================== EXECUTIVE VERDICTS ====================

export async function saveExecutiveVerdict(data: InsertExecutiveVerdict) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(executiveVerdicts).values(data);
  return result[0].insertId;
}

export async function createExecutiveVerdictReview(data: InsertExecutiveVerdictReview) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(executiveVerdictReviews).values(data);
  return result.insertId;
}

export async function getExecutiveVerdictReview(verdictId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(executiveVerdictReviews)
    .where(eq(executiveVerdictReviews.verdictId, verdictId))
    .orderBy(desc(executiveVerdictReviews.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function reviewExecutiveVerdict(input: {
  projectId: number;
  verdictId: number;
  reviewStatus: "VALIDATED" | "REJECTED";
  reviewNote: string;
  reviewedBy: number;
  reviewedByName: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const current = await getExecutiveVerdictReview(input.verdictId);
  if (!current || current.projectId !== input.projectId) throw new Error("Revisión de veredicto no encontrada");
  if (current.reviewStatus !== "PENDING") throw new Error("El veredicto ya fue revisado y no puede modificarse");

  await db.update(executiveVerdictReviews)
    .set({
      reviewStatus: input.reviewStatus,
      reviewNote: input.reviewNote,
      reviewedBy: input.reviewedBy,
      reviewedByName: input.reviewedByName,
      reviewedAt: new Date(),
    })
    .where(eq(executiveVerdictReviews.id, current.id));

  return getExecutiveVerdictReview(input.verdictId);
}

export async function getLatestVerdict(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  // Exclude agentic analysis records (ctoTitle = "Análisis Agéntico" or "Análisis PM Senior")
  const rows = await db.select().from(executiveVerdicts)
    .where(and(
      eq(executiveVerdicts.projectId, projectId),
      or(
        isNull(executiveVerdicts.ctoTitle),
        and(
          ne(executiveVerdicts.ctoTitle, "Análisis Agéntico"),
          ne(executiveVerdicts.ctoTitle, "Análisis PM Senior")
        )
      )
    ))
    .orderBy(desc(executiveVerdicts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getVerdictHistory(projectId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  // Exclude agentic analysis records
  return db.select({
    id: executiveVerdicts.id,
    semaphore: executiveVerdicts.semaphore,
    generatedByName: executiveVerdicts.generatedByName,
    overallVerdict: executiveVerdicts.overallVerdict,
    metricsSnapshot: executiveVerdicts.metricsSnapshot,
    createdAt: executiveVerdicts.createdAt,
  }).from(executiveVerdicts)
    .where(and(
      eq(executiveVerdicts.projectId, projectId),
      or(
        isNull(executiveVerdicts.ctoTitle),
        and(
          ne(executiveVerdicts.ctoTitle, "Análisis Agéntico"),
          ne(executiveVerdicts.ctoTitle, "Análisis PM Senior")
        )
      )
    ))
    .orderBy(desc(executiveVerdicts.createdAt))
    .limit(limit);
}

export async function getVerdictById(verdictId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(executiveVerdicts)
    .where(eq(executiveVerdicts.id, verdictId));
  return rows[0] ?? null;
}


export async function getLatestPMAnalysis(projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(executiveVerdicts)
    .where(and(
      eq(executiveVerdicts.projectId, projectId),
      isNotNull(executiveVerdicts.overallVerdict),
      ne(executiveVerdicts.overallVerdict, ""),
      or(
        eq(executiveVerdicts.ctoTitle, "Análisis Agéntico"),
        eq(executiveVerdicts.ctoTitle, "Análisis PM Senior")
      )
    ))
    .orderBy(desc(executiveVerdicts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLatestPMAnalysisWithReview(projectId: number) {
  const analysis = await getLatestPMAnalysis(projectId);
  if (!analysis) return { analysis: null, review: null };
  return { analysis, review: await getExecutiveVerdictReview(analysis.id) };
}

export async function getPMAnalysisHistory(projectId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: executiveVerdicts.id,
    semaphore: executiveVerdicts.semaphore,
    generatedByName: executiveVerdicts.generatedByName,
    overallVerdict: executiveVerdicts.overallVerdict,
    metricsSnapshot: executiveVerdicts.metricsSnapshot,
    createdAt: executiveVerdicts.createdAt,
  }).from(executiveVerdicts)
    .where(and(
      eq(executiveVerdicts.projectId, projectId),
      isNotNull(executiveVerdicts.overallVerdict),
      ne(executiveVerdicts.overallVerdict, ""),
      or(
        eq(executiveVerdicts.ctoTitle, "Análisis Agéntico"),
        eq(executiveVerdicts.ctoTitle, "Análisis PM Senior")
      )
    ))
    .orderBy(desc(executiveVerdicts.createdAt))
    .limit(limit);
}

// ==================== LINKED PROJECT DOCUMENTS ====================
export async function insertLinkedProjectDocument(data: InsertLinkedProjectDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [result] = await db.insert(linkedProjectDocuments).values(data);
  return result.insertId;
}

export async function getLinkedProjectDocuments(projectId: number, docType?: "sow" | "gantt") {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(linkedProjectDocuments.projectId, projectId)];
  if (docType) conditions.push(eq(linkedProjectDocuments.docType, docType));
  return db.select().from(linkedProjectDocuments)
    .where(and(...conditions))
    .orderBy(desc(linkedProjectDocuments.createdAt));
}

export async function deleteLinkedProjectDocument(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(linkedProjectDocuments).where(eq(linkedProjectDocuments.id, id));
}

export async function getLinkedProjectDocumentById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(linkedProjectDocuments)
    .where(eq(linkedProjectDocuments.id, id));
  return rows[0] ?? null;
}

// ==================== MY PROFILE ====================
export async function getMyProfileData(userId: number) {
  const db = await getDb();
  if (!db) return null;
  // Get user data
  const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = userRows[0];
  if (!user) return null;
  // Count projects where user is PM
  const pmProjectsResult = await db.select({ count: count() }).from(projects).where(eq(projects.pmId, userId));
  const pmProjectCount = pmProjectsResult[0]?.count || 0;
  // Count active projects where user is PM
  const activeProjectsResult = await db.select({ count: count() }).from(projects).where(and(eq(projects.pmId, userId), eq(projects.status, "activo")));
  const activeProjectCount = activeProjectsResult[0]?.count || 0;
  // Count recurring services where user is PM
  const rsResult = await db.select({ count: count() }).from(recurringServices).where(eq(recurringServices.pmId, userId));
  const rsCount = rsResult[0]?.count || 0;
  // Get recent audit logs for this user (last 20)
  const recentActivity = await db.select().from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(20);
  // Count total audit logs for this user
  const totalActivityResult = await db.select({ count: count() }).from(auditLogs).where(eq(auditLogs.userId, userId));
  const totalActivity = totalActivityResult[0]?.count || 0;
  return {
    user,
    stats: {
      pmProjectCount,
      activeProjectCount,
      recurringServiceCount: rsCount,
      totalActivity,
    },
    recentActivity,
  };
}

/* ─── Financial sync log helpers ─── */

/** Devuelve el historial de sincronizaciones financieras, más reciente primero. */
export async function getFinancialSyncLogs(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const { financialSyncLogs } = await import("../drizzle/schema");
  return db
    .select()
    .from(financialSyncLogs)
    .orderBy(desc(financialSyncLogs.createdAt))
    .limit(Math.max(1, Math.min(200, limit)));
}

/** Devuelve la sincronización financiera más reciente (cualquier estado), o undefined. */
export async function getLatestFinancialSync() {
  const db = await getDb();
  if (!db) return undefined;
  const { financialSyncLogs } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(financialSyncLogs)
    .orderBy(desc(financialSyncLogs.createdAt))
    .limit(1);
  return rows[0];
}

// ==================== BASELINE EJECUTIVO: EDICIÓN Y CREACIÓN DESDE JIRA ====================
/** Actualiza la fecha baseline contractual de un hito ejecutivo. */
export async function updateExecutiveMilestoneBaseline(milestoneId: number, baselineDate: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(executiveContractMilestones)
    .set({ baselineDate })
    .where(eq(executiveContractMilestones.id, milestoneId));
}
/** Crea un baseline ejecutivo aprobado junto con sus hitos contractuales (origen Jira). */
export async function createExecutiveBaselineWithMilestones(input: {
  projectId: number;
  dealId: string;
  jiraProjectKey: string;
  baselineVersion: string;
  approvedBy: number;
  approvedByName: string | null;
  approvalNotes?: string;
  milestones: { milestoneCode: string; title: string; billingWeight: string; baselineDate: string | null; jiraIssueKey: string; jiraStatusName?: string | null; jiraDueDate?: string | null; semanticStatus?: "pending" | "fulfilled" | "delayed" | "blocked" }[];
}) {
  const db = await getDb();
  if (!db) return undefined;
  const [result] = await db.insert(executiveProjectSources).values({
    projectId: input.projectId,
    dealId: input.dealId,
    jiraProjectKey: input.jiraProjectKey,
    baselineVersion: input.baselineVersion,
    contractFileName: `baseline-jira-${input.jiraProjectKey}`,
    contractFileUrl: `jira://${input.jiraProjectKey}`,
    sourceStatus: "approved",
    approvedAt: new Date(),
    approvedBy: input.approvedBy,
    approvedByName: input.approvedByName,
    approvalNotes: input.approvalNotes ?? null,
  });
  const sourceId = Number((result as any).insertId);
  if (input.milestones.length) {
    await db.insert(executiveContractMilestones).values(
      input.milestones.map((m) => ({
        projectId: input.projectId,
        sourceId,
        milestoneCode: m.milestoneCode,
        title: m.title,
        billingWeight: m.billingWeight,
        baselineDate: m.baselineDate,
        jiraIssueKey: m.jiraIssueKey,
        jiraStatusName: m.jiraStatusName ?? null,
        jiraDueDate: m.jiraDueDate ?? null,
        semanticStatus: m.semanticStatus ?? "pending",
      }))
    );
  }
  return sourceId;
}
