import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  json,
  boolean,
  decimal,
  date,
} from "drizzle-orm/mysql-core";

// ==================== USERS ====================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["admin", "pmo", "pm", "consulta"]).default("consulta").notNull(),
  status: mysqlEnum("status", ["activo", "invitado", "desactivado"]).default("invitado").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ==================== PROJECTS ====================
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  projectName: varchar("projectName", { length: 255 }).notNull(),
  clientName: varchar("clientName", { length: 255 }).notNull(),
  clientContact: varchar("clientContact", { length: 255 }),
  clientEmail: varchar("clientEmail", { length: 320 }),
  projectType: mysqlEnum("projectType", ["apigee", "desarrollo", "integracion", "data", "otro"]).default("otro"),
  status: mysqlEnum("status", ["activo", "pausado", "completado", "cancelado"]).default("activo").notNull(),
  currentStage: mysqlEnum("currentStage", ["sow", "jira", "risks", "planning", "design", "closure"]).default("sow").notNull(),
  pmId: int("pmId"),
  pmoId: int("pmoId"),
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  startDate: date("startDate", { mode: "string" }),
  endDate: date("endDate", { mode: "string" }),
  jiraProjectKey: varchar("jiraProjectKey", { length: 50 }),
  jiraProjectUrl: varchar("jiraProjectUrl", { length: 500 }),
  origin: mysqlEnum("origin", ["platform", "linked"]).default("platform").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ==================== PROJECT STAGES ====================
export const projectStages = mysqlTable("project_stages", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  status: mysqlEnum("status", ["locked", "in_progress", "completed"]).default("locked").notNull(),
  progress: int("progress").default(0),
  completedAt: timestamp("completedAt"),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ProjectStage = typeof projectStages.$inferSelect;

// ==================== SOW ====================
export const sowDocuments = mysqlTable("sow_documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: int("version").default(1).notNull(),
  status: mysqlEnum("status", ["draft", "review", "approved"]).default("draft").notNull(),
  // Sección 1: Introducción
  introText: text("introText"),
  startDate: varchar("startDate", { length: 50 }),
  // Sección 2: Objetivos
  generalObjective: text("generalObjective"),
  specificObjectives: json("specificObjectives"),
  // Sección 4: Alcance
  activitiesIncluded: json("activitiesIncluded"),
  deliverables: json("deliverables"),
  limitations: json("limitations"),
  assumptions: json("assumptions"),
  clientDependencies: json("clientDependencies"),
  risks: json("risks"),
  prerequisites: json("prerequisites"),
  // Sección 5: Hitos
  milestones: json("milestones"),
  // Sección 6: Metodología
  meetingFrequency: text("meetingFrequency"),
  communicationChannel: text("communicationChannel"),
  // Sección 8: Roles
  prodigioTeam: json("prodigioTeam"),
  clientTeam: json("clientTeam"),
  // Sección 10: Precio
  totalAmount: decimal("totalAmount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  billingMilestones: json("billingMilestones"),
  // Fuente
  sourcePdfUrl: varchar("sourcePdfUrl", { length: 1000 }),
  aiExtracted: boolean("aiExtracted").default(false),
  finalDocUrl: varchar("finalDocUrl", { length: 1000 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SowDocument = typeof sowDocuments.$inferSelect;
export type InsertSowDocument = typeof sowDocuments.$inferInsert;

// ==================== RISKS ====================
export const risks = mysqlTable("risks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  riskCode: varchar("riskCode", { length: 20 }),
  description: text("description").notNull(),
  category: mysqlEnum("category", ["tecnico", "organizacional", "externo", "oculto"]).notNull(),
  type: mysqlEnum("type", ["riesgo", "riesgo_oculto", "supuesto_no_validado", "dependencia_externa"]).notNull(),
  probability: mysqlEnum("probability", ["alta", "media", "baja"]).notNull(),
  impact: mysqlEnum("impact", ["alto", "medio", "bajo"]).notNull(),
  mitigation: text("mitigation"),
  owner: varchar("owner", { length: 255 }),
  contingency: text("contingency"),
  dueDate: varchar("dueDate", { length: 20 }),
  estimatedCost: varchar("estimatedCost", { length: 100 }),
  status: mysqlEnum("status", ["abierto", "mitigado", "cerrado"]).default("abierto"),
  confirmed: boolean("confirmed").default(false).notNull(),
  jiraTaskId: varchar("jiraTaskId", { length: 100 }),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Risk = typeof risks.$inferSelect;
export type InsertRisk = typeof risks.$inferInsert;

// ==================== WBS TASKS ====================
export const wbsTasks = mysqlTable("wbs_tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  taskCode: varchar("taskCode", { length: 20 }),
  taskName: varchar("taskName", { length: 500 }).notNull(),
  phase: mysqlEnum("phase", ["preparacion", "inicio", "planificacion", "analisis", "construccion", "cierre"]).notNull(),
  optimistic: decimal("optimistic", { precision: 6, scale: 1 }),
  pessimistic: decimal("pessimistic", { precision: 6, scale: 1 }),
  probable: decimal("probable", { precision: 6, scale: 1 }),
  expected: decimal("expected", { precision: 6, scale: 1 }),
  isCritical: boolean("isCritical").default(false),
  dependencies: varchar("dependencies", { length: 255 }),
  assignee: varchar("assignee", { length: 255 }),
  jiraTaskId: varchar("jiraTaskId", { length: 100 }),
  // Backlog ágil (Epic → Story → Task)
  issueLevel: mysqlEnum("issueLevel", ["epic", "story", "task", "milestone"]).default("task"),
  epicCode: varchar("epicCode", { length: 20 }),
  storyCode: varchar("storyCode", { length: 20 }),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  jiraParentKey: varchar("jiraParentKey", { length: 50 }),
  acceptanceCriteria: text("acceptanceCriteria"),
  storyPoints: int("storyPoints"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WbsTask = typeof wbsTasks.$inferSelect;
export type InsertWbsTask = typeof wbsTasks.$inferInsert;

// ==================== BILLING MILESTONES ====================
export const billingMilestones = mysqlTable("billing_milestones", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  milestoneNumber: int("milestoneNumber").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  percentage: decimal("percentage", { precision: 5, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  dueDate: date("dueDate", { mode: "string" }),
  status: mysqlEnum("status", ["pendiente", "facturado", "pagado"]).default("pendiente"),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  paidAt: timestamp("paidAt"),
  // Responsable del hito
  responsableName: varchar("responsableName", { length: 255 }),
  responsableEmail: varchar("responsableEmail", { length: 320 }),
  // Date source tracking
  dateSource: mysqlEnum("dateSource", ["gantt", "sow", "ai", "manual"]),
  // JIRA integration
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  jiraIssueId: varchar("jiraIssueId", { length: 50 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BillingMilestone = typeof billingMilestones.$inferSelect;

// ==================== GANTT UPLOADS ====================
export const ganttUploads = mysqlTable("gantt_uploads", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  parsedRows: int("parsedRows").default(0),
  uploadedBy: int("uploadedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type GanttUpload = typeof ganttUploads.$inferSelect;
export type InsertGanttUpload = typeof ganttUploads.$inferInsert;

// ==================== DESIGN DOCUMENTS ====================
export const designDocuments = mysqlTable("design_documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  projectType: mysqlEnum("projectType", ["apigee", "desarrollo", "integracion", "data", "otro"]).notNull(),
  architectureProposal: text("architectureProposal"),
  techStack: json("techStack"),
  predefinedActivities: json("predefinedActivities"),
  planningProposal: text("planningProposal"),
  maxDurationDays: int("maxDurationDays"),
  aiGenerated: boolean("aiGenerated").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DesignDocument = typeof designDocuments.$inferSelect;

// ==================== LESSONS LEARNED ====================
export const lessonsLearned = mysqlTable("lessons_learned", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  category: mysqlEnum("category", ["proceso", "tecnico", "comunicacion", "riesgos", "equipo"]).notNull(),
  whatWorked: text("whatWorked"),
  whatDidntWork: text("whatDidntWork"),
  frictions: text("frictions"),
  improvements: text("improvements"),
  platformSuggestions: text("platformSuggestions"),
  finalScore: int("finalScore"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LessonLearned = typeof lessonsLearned.$inferSelect;

// ==================== UPLOADED FILES ====================
export const uploadedFiles = mysqlTable("uploaded_files", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId"),
  uploadedBy: int("uploadedBy"),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileKey: varchar("fileKey", { length: 1000 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  purpose: mysqlEnum("purpose", ["sow_source", "sow_final", "design_doc", "other"]).default("other"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;

// ==================== ADMIN SETTINGS ====================
export const adminSettings = mysqlTable("admin_settings", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 100 }).notNull().unique(),
  value: text("value"),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ==================== INVITATIONS ====================
export const invitations = mysqlTable("invitations", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  role: mysqlEnum("role", ["admin", "pmo", "pm", "consulta"]).default("pm").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  status: mysqlEnum("status", ["pending", "accepted", "expired"]).default("pending").notNull(),
  invitedBy: int("invitedBy"),
  expiresAt: timestamp("expiresAt").notNull(),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Invitation = typeof invitations.$inferSelect;
export type InsertInvitation = typeof invitations.$inferInsert;

// ==================== SOW VERSIONS (DOCX HISTORY) ====================
export const sowVersions = mysqlTable("sow_versions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: varchar("version", { length: 20 }).notNull(),
  redactor: varchar("redactor", { length: 200 }).notNull(),
  redactorRole: varchar("redactorRole", { length: 200 }),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  url: text("url").notNull(),
  fileSize: int("fileSize"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type SowVersion = typeof sowVersions.$inferSelect;
export type InsertSowVersion = typeof sowVersions.$inferInsert;

// ==================== STAGE DEADLINES (Plazos por etapa) ====================
export const stageDeadlines = mysqlTable("stage_deadlines", {
  id: int("id").autoincrement().primaryKey(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull().unique(),
  maxBusinessDays: int("maxBusinessDays").notNull().default(10),
  label: varchar("label", { length: 100 }).notNull(),
  description: text("description"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StageDeadline = typeof stageDeadlines.$inferSelect;
export type InsertStageDeadline = typeof stageDeadlines.$inferInsert;

// ==================== STAGE OPENINGS (Apertura de etapa por proyecto) ====================
export const stageOpenings = mysqlTable("stage_openings", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  openedBy: int("openedBy").notNull(),
  openedAt: timestamp("openedAt").defaultNow().notNull(),
});

export type StageOpening = typeof stageOpenings.$inferSelect;
export type InsertStageOpening = typeof stageOpenings.$inferInsert;

// ==================== HOLIDAYS (Feriados de Chile) ====================
export const holidays = mysqlTable("holidays", {
  id: int("id").autoincrement().primaryKey(),
  date: date("date", { mode: "string" }).notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  year: int("year").notNull(),
  source: varchar("source", { length: 100 }).default("feriados.cl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Holiday = typeof holidays.$inferSelect;
export type InsertHoliday = typeof holidays.$inferInsert;

// ==================== STAGE DEADLINE EXTENSIONS (Pausas y extensiones) ====================
export const stageDeadlineExtensions = mysqlTable("stage_deadline_extensions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  type: mysqlEnum("type", ["pause", "resume", "extend"]).notNull(),
  extraDays: int("extraDays").default(0),
  reason: text("reason").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type StageDeadlineExtension = typeof stageDeadlineExtensions.$inferSelect;
export type InsertStageDeadlineExtension = typeof stageDeadlineExtensions.$inferInsert;

// ==================== DEADLINE NOTIFICATIONS (Evitar duplicados) ====================
export const deadlineNotifications = mysqlTable("deadline_notifications", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  notificationType: mysqlEnum("notificationType", ["warning_75", "overdue"]).notNull(),
  sentTo: varchar("sentTo", { length: 500 }).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
});

export type DeadlineNotification = typeof deadlineNotifications.$inferSelect;
export type InsertDeadlineNotification = typeof deadlineNotifications.$inferInsert;

// ==================== STAGE APPROVALS (Documentos aprobados para cierre de etapa) ====================
export const stageApprovals = mysqlTable("stage_approvals", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 1000 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  notes: text("notes"),
  clientApproverName: varchar("clientApproverName", { length: 300 }),
  clientApprovalDate: varchar("clientApprovalDate", { length: 50 }),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
  closedAt: timestamp("closedAt"),
  closedBy: int("closedBy"),
});

export type StageApproval = typeof stageApprovals.$inferSelect;
export type InsertStageApproval = typeof stageApprovals.$inferInsert;

// ==================== STAGE CLOSURES (Cierre formal de etapas) ====================
export const stageClosures = mysqlTable("stage_closures", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  stageId: mysqlEnum("stageId", ["sow", "jira", "risks", "planning", "design", "closure"]).notNull(),
  closedBy: int("closedBy").notNull(),
  closedByName: varchar("closedByName", { length: 200 }),
  confirmationText: text("confirmationText").notNull(), // The disclaimer text the GP confirmed
  notes: text("notes"), // Optional observations
  closedAt: timestamp("closedAt").defaultNow().notNull(),
});

export type StageClosure = typeof stageClosures.$inferSelect;
export type InsertStageClosure = typeof stageClosures.$inferInsert;

// ==================== JIRA SPACES (Spaces creados en JIRA para proyectos PMO) ====================
export const jiraSpaces = mysqlTable("jira_spaces", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  spaceName: varchar("spaceName", { length: 255 }).notNull(), // Nombre del Space en PMO
  jiraProjectKey: varchar("jiraProjectKey", { length: 50 }), // Key real en JIRA (null si pendiente permisos)
  jiraProjectId: varchar("jiraProjectId", { length: 50 }), // ID real en JIRA
  jiraProjectName: varchar("jiraProjectName", { length: 255 }), // Nombre real en JIRA
  jiraProjectUrl: varchar("jiraProjectUrl", { length: 1000 }), // URL del Space en JIRA
  status: mysqlEnum("status", ["created", "pending_permissions", "linked"]).default("pending_permissions").notNull(),
  templateKey: varchar("templateKey", { length: 50 }).default("PBTISD1"), // Proyecto plantilla usado
  boards: json("boards"), // Array de tableros del Space
  issueTypes: json("issueTypes"), // Array de issue types
  workflows: json("workflows"), // Array de workflows/flujos
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type JiraSpace = typeof jiraSpaces.$inferSelect;
export type InsertJiraSpace = typeof jiraSpaces.$inferInsert;

// ==================== RISK VERSIONS (Historial de exportaciones Excel de la Matriz de Riesgos) ====================
export const riskVersions = mysqlTable("risk_versions", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  version: varchar("version", { length: 20 }).notNull(), // v1.0, v1.1, v2.0, etc.
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 1000 }).notNull(),
  riskCount: int("riskCount").default(0),
  notes: text("notes"),
  createdBy: int("createdBy").notNull(),
  createdByName: varchar("createdByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RiskVersion = typeof riskVersions.$inferSelect;
export type InsertRiskVersion = typeof riskVersions.$inferInsert;

// ==================== AUDIT LOGS ====================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 100 }).notNull(), // create, update, delete, login, logout, generate, upload, close, pause, resume, extend, invite, etc.
  entity: varchar("entity", { length: 100 }).notNull(), // project, user, sow, risk, wbs, stage, deadline, extension, invitation, etc.
  entityId: varchar("entityId", { length: 100 }), // ID of the affected entity
  entityName: varchar("entityName", { length: 500 }), // Human-readable name of the entity
  userId: int("userId"),
  userName: varchar("userName", { length: 200 }),
  userRole: varchar("userRole", { length: 50 }),
  details: json("details"), // Additional context: old/new values, parameters, etc.
  ipAddress: varchar("ipAddress", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

// ==================== FINANCIAL DATA (Datos financieros de la planilla Google Sheets) ====================
export const financialData = mysqlTable("financial_data", {
  id: int("id").autoincrement().primaryKey(),
  dealId: varchar("dealId", { length: 50 }).notNull().unique(), // e.g. "Deal1996"
  estadoProyecto: varchar("estadoProyecto", { length: 100 }),
  projectName: varchar("projectName", { length: 500 }),
  clientName: varchar("clientName", { length: 255 }),
  pm: varchar("pm", { length: 255 }),
  valorVentaUF: decimal("valorVentaUF", { precision: 14, scale: 4 }),
  presupuestoUF: decimal("presupuestoUF", { precision: 14, scale: 4 }),
  utilizadoUF: decimal("utilizadoUF", { precision: 14, scale: 4 }),
  utilizadoUFPorc: decimal("utilizadoUFPorc", { precision: 14, scale: 10 }),
  presupuestoHH: decimal("presupuestoHH", { precision: 14, scale: 4 }),
  capacityHH: decimal("capacityHH", { precision: 14, scale: 4 }),
  hhPorcUtilizado: decimal("hhPorcUtilizado", { precision: 14, scale: 10 }),
  margenBrutoNotaVentaUF: decimal("margenBrutoNotaVentaUF", { precision: 14, scale: 4 }),
  porcentajeAvanceProyecto: decimal("porcentajeAvanceProyecto", { precision: 14, scale: 10 }),
  costoProyectadoUF: decimal("costoProyectadoUF", { precision: 14, scale: 4 }),
  margenProyectadoUF: decimal("margenProyectadoUF", { precision: 14, scale: 4 }),
  margenProyectadoPorc: decimal("margenProyectadoPorc", { precision: 14, scale: 10 }),
  margenTargetPorc: decimal("margenTargetPorc", { precision: 14, scale: 10 }),
  capacityU: decimal("capacityU", { precision: 14, scale: 4 }),
  planificadoUF: decimal("planificadoUF", { precision: 14, scale: 4 }),
  proyectadoUF: decimal("proyectadoUF", { precision: 14, scale: 4 }),
  margenProyectadoSegunCapacity: decimal("margenProyectadoSegunCapacity", { precision: 14, scale: 10 }),
  notas: text("notas"),
  otrosCostosUF: decimal("otrosCostosUF", { precision: 14, scale: 4 }),
  lineaNegocio: varchar("lineaNegocio", { length: 100 }),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(), // Last sync from Google Sheets
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinancialData = typeof financialData.$inferSelect;
export type InsertFinancialData = typeof financialData.$inferInsert;

// ==================== EXECUTIVE VERDICTS (Historial de veredictos ejecutivos por proyecto) ====================
export const executiveVerdicts = mysqlTable("executive_verdicts", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  generatedBy: int("generatedBy").notNull(), // userId who triggered the generation
  generatedByName: varchar("generatedByName", { length: 200 }),
  semaphore: mysqlEnum("semaphore", ["VERDE", "AMARILLO", "ROJO"]).notNull(),
  // Role-specific insights (stored as JSON arrays of {text, tag} objects)
  ctoTitle: varchar("ctoTitle", { length: 500 }),
  ctoInsights: json("ctoInsights"), // [{text: string, tag: string}]
  cfoTitle: varchar("cfoTitle", { length: 500 }),
  cfoInsights: json("cfoInsights"), // [{text: string, tag: string}]
  commercialTitle: varchar("commercialTitle", { length: 500 }),
  commercialInsights: json("commercialInsights"), // [{text: string, tag: string}]
  // Overall verdict
  overallVerdict: text("overallVerdict"),
  semaphoreJustification: text("semaphoreJustification"),
  // Risks and recommendations (stored as JSON arrays)
  keyRisks: json("keyRisks"), // [{level: string, description: string, mitigation: string}]
  recommendations: json("recommendations"), // [{priority: string, title: string, description: string}]
  // Snapshot of key metrics at the time of generation
  metricsSnapshot: json("metricsSnapshot"), // {jiraAdvance, milestonesComplete, budgetUsed, marginProjected, ...}
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutiveVerdict = typeof executiveVerdicts.$inferSelect;
export type InsertExecutiveVerdict = typeof executiveVerdicts.$inferInsert;

// ==================== EXECUTIVE VERDICT REVIEWS ====================
// Un veredicto generado por IA es una observación. Sólo una revisión explícita puede validarlo para uso ejecutivo.
export const executiveVerdictReviews = mysqlTable("executive_verdict_reviews", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  verdictId: int("verdictId").notNull(),
  reviewStatus: mysqlEnum("reviewStatus", ["PENDING", "VALIDATED", "REJECTED"]).notNull().default("PENDING"),
  reviewNote: text("reviewNote"),
  reviewedBy: int("reviewedBy"),
  reviewedByName: varchar("reviewedByName", { length: 200 }),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutiveVerdictReview = typeof executiveVerdictReviews.$inferSelect;
export type InsertExecutiveVerdictReview = typeof executiveVerdictReviews.$inferInsert;

// ==================== EXECUTIVE DASHBOARD V2: SOURCES & CONTRACTUAL BASELINES ====================
// El SoW fija el baseline contractual; Jira sólo aporta estado y fecha operativa.
export const executiveProjectSources = mysqlTable("executive_project_sources", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  dealId: varchar("dealId", { length: 50 }).notNull(),
  jiraProjectKey: varchar("jiraProjectKey", { length: 50 }).notNull(),
  contractDocumentId: int("contractDocumentId"),
  baselineVersion: varchar("baselineVersion", { length: 50 }).notNull(),
  contractFileName: varchar("contractFileName", { length: 500 }).notNull(),
  contractFileUrl: varchar("contractFileUrl", { length: 1000 }).notNull(),
  contractSha256: varchar("contractSha256", { length: 64 }),
  sourceStatus: mysqlEnum("sourceStatus", ["draft", "approved", "superseded"]).default("draft").notNull(),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 200 }),
  approvalNotes: text("approvalNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutiveProjectSource = typeof executiveProjectSources.$inferSelect;
export type InsertExecutiveProjectSource = typeof executiveProjectSources.$inferInsert;

export const executiveContractMilestones = mysqlTable("executive_contract_milestones", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId").notNull(),
  milestoneCode: varchar("milestoneCode", { length: 50 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  billingWeight: decimal("billingWeight", { precision: 5, scale: 2 }).notNull(),
  baselineDate: date("baselineDate", { mode: "string" }),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }).notNull(),
  jiraStatusName: varchar("jiraStatusName", { length: 100 }),
  jiraDueDate: date("jiraDueDate", { mode: "string" }),
  jiraClosedDate: date("jiraClosedDate", { mode: "string" }),
  semanticStatus: mysqlEnum("semanticStatus", ["pending", "fulfilled", "delayed", "blocked"]).default("pending").notNull(),
  isCritical: boolean("isCritical").default(false).notNull(),
  reconciliationNotes: text("reconciliationNotes"),
  lastObservedAt: timestamp("lastObservedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutiveContractMilestone = typeof executiveContractMilestones.$inferSelect;
export type InsertExecutiveContractMilestone = typeof executiveContractMilestones.$inferInsert;

// ==================== EXECUTIVE DASHBOARD V2: EVIDENCE & GOVERNANCE ====================
// Las aceptaciones son registros independientes: el estado Jira no puede reemplazar una acta.
export const executiveMilestoneAcceptances = mysqlTable("executive_milestone_acceptances", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId").notNull(),
  milestoneId: int("milestoneId").notNull(),
  acceptedAt: date("acceptedAt", { mode: "string" }).notNull(),
  evidenceFileName: varchar("evidenceFileName", { length: 500 }).notNull(),
  evidenceUrl: varchar("evidenceUrl", { length: 1000 }).notNull(),
  evidenceSha256: varchar("evidenceSha256", { length: 64 }),
  acceptanceStatus: mysqlEnum("acceptanceStatus", ["accepted", "revoked"]).default("accepted").notNull(),
  notes: text("notes"),
  recordedBy: int("recordedBy").notNull(),
  recordedByName: varchar("recordedByName", { length: 200 }),
  revokedAt: timestamp("revokedAt"),
  revokedBy: int("revokedBy"),
  revokeReason: text("revokeReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutiveMilestoneAcceptance = typeof executiveMilestoneAcceptances.$inferSelect;
export type InsertExecutiveMilestoneAcceptance = typeof executiveMilestoneAcceptances.$inferInsert;

export const executiveMeetingMinutes = mysqlTable("executive_meeting_minutes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId"),
  meetingDate: date("meetingDate", { mode: "string" }).notNull(),
  isoWeek: varchar("isoWeek", { length: 10 }).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileSha256: varchar("fileSha256", { length: 64 }),
  reviewStatus: mysqlEnum("reviewStatus", ["received", "reviewed", "incomplete"]).default("received").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  reviewedBy: int("reviewedBy"),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedByName: varchar("uploadedByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutiveMeetingMinute = typeof executiveMeetingMinutes.$inferSelect;
export type InsertExecutiveMeetingMinute = typeof executiveMeetingMinutes.$inferInsert;

export const executiveCommitments = mysqlTable("executive_commitments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  minuteId: int("minuteId"),
  title: varchar("title", { length: 500 }).notNull(),
  ownerName: varchar("ownerName", { length: 200 }),
  dueDate: date("dueDate", { mode: "string" }),
  commitmentStatus: mysqlEnum("commitmentStatus", ["open", "fulfilled", "cancelled"]).default("open").notNull(),
  closureEvidenceUrl: varchar("closureEvidenceUrl", { length: 1000 }),
  closedAt: timestamp("closedAt"),
  closedBy: int("closedBy"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutiveCommitment = typeof executiveCommitments.$inferSelect;
export type InsertExecutiveCommitment = typeof executiveCommitments.$inferInsert;

export const executiveRequirements = mysqlTable("executive_requirements", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId"),
  requirementCode: varchar("requirementCode", { length: 50 }).notNull(),
  priority: mysqlEnum("priority", ["P0", "P1", "P2"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  rationale: text("rationale").notNull(),
  ownerName: varchar("ownerName", { length: 200 }).notNull(),
  dueDate: date("dueDate", { mode: "string" }).notNull(),
  requirementStatus: mysqlEnum("requirementStatus", ["open", "in_progress", "closed", "waived"]).default("open").notNull(),
  acceptanceCriteria: text("acceptanceCriteria").notNull(),
  consequence: text("consequence").notNull(),
  closureEvidenceUrl: varchar("closureEvidenceUrl", { length: 1000 }),
  closedAt: timestamp("closedAt"),
  closedBy: int("closedBy"),
  closureNotes: text("closureNotes"),
  waivedAt: timestamp("waivedAt"),
  waivedBy: int("waivedBy"),
  waiverReason: text("waiverReason"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutiveRequirement = typeof executiveRequirements.$inferSelect;
export type InsertExecutiveRequirement = typeof executiveRequirements.$inferInsert;

export const executiveRecoveryPlans = mysqlTable("executive_recovery_plans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId"),
  version: varchar("version", { length: 50 }).notNull(),
  recoveryStatus: mysqlEnum("recoveryStatus", ["draft", "vigente", "closed", "superseded"]).default("draft").notNull(),
  dueDate: date("dueDate", { mode: "string" }),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"),
  approvedByName: varchar("approvedByName", { length: 200 }),
  fileName: varchar("fileName", { length: 500 }),
  fileUrl: varchar("fileUrl", { length: 1000 }),
  fileSha256: varchar("fileSha256", { length: 64 }),
  summary: text("summary"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ExecutiveRecoveryPlan = typeof executiveRecoveryPlans.$inferSelect;
export type InsertExecutiveRecoveryPlan = typeof executiveRecoveryPlans.$inferInsert;

export const executiveGovernanceAssignments = mysqlTable("executive_governance_assignments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId"),
  governanceRole: mysqlEnum("governanceRole", ["pm", "delivery_manager", "portfolio_owner"]).notNull(),
  personName: varchar("personName", { length: 200 }).notNull(),
  userId: int("userId"),
  active: boolean("active").default(true).notNull(),
  assignedAt: timestamp("assignedAt").defaultNow().notNull(),
  assignedBy: int("assignedBy"),
  notes: text("notes"),
});

export type ExecutiveGovernanceAssignment = typeof executiveGovernanceAssignments.$inferSelect;
export type InsertExecutiveGovernanceAssignment = typeof executiveGovernanceAssignments.$inferInsert;

export const executiveFinancialSnapshots = mysqlTable("executive_financial_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId"),
  dealId: varchar("dealId", { length: 50 }).notNull(),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
  sourceLabel: varchar("sourceLabel", { length: 200 }).notNull(),
  dataFingerprint: varchar("dataFingerprint", { length: 64 }),
  financialData: json("financialData").notNull(),
  createdBy: int("createdBy"),
});

export type ExecutiveFinancialSnapshot = typeof executiveFinancialSnapshots.$inferSelect;
export type InsertExecutiveFinancialSnapshot = typeof executiveFinancialSnapshots.$inferInsert;

export const executiveDashboardSnapshots = mysqlTable("executive_dashboard_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceId: int("sourceId").notNull(),
  financialSnapshotId: int("financialSnapshotId"),
  cutoffDate: date("cutoffDate", { mode: "string" }).notNull(),
  snapshotKind: mysqlEnum("snapshotKind", ["fixture", "production"]).default("production").notNull(),
  governanceState: mysqlEnum("governanceState", ["VERDE", "AMARILLO", "NARANJO", "ROJO", "CRITICO", "POR_CONFIRMAR"]).notNull(),
  metrics: json("metrics").notNull(),
  inputFingerprint: varchar("inputFingerprint", { length: 64 }).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ExecutiveDashboardSnapshot = typeof executiveDashboardSnapshots.$inferSelect;
export type InsertExecutiveDashboardSnapshot = typeof executiveDashboardSnapshots.$inferInsert;

// ==================== LINKED PROJECT DOCUMENTS (SoW y Gantt de proyectos vinculados) ====================
export const linkedProjectDocuments = mysqlTable("linked_project_documents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  docType: mysqlEnum("docType", ["sow", "gantt"]).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 1000 }).notNull(),
  fileSize: int("fileSize"),
  mimeType: varchar("mimeType", { length: 100 }),
  notes: text("notes"),
  uploadedBy: int("uploadedBy").notNull(),
  uploadedByName: varchar("uploadedByName", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LinkedProjectDocument = typeof linkedProjectDocuments.$inferSelect;
export type InsertLinkedProjectDocument = typeof linkedProjectDocuments.$inferInsert;


// ==================== RECURRING SERVICES ====================
export const recurringServices = mysqlTable("recurring_services", {
  id: int("id").autoincrement().primaryKey(),
  // Datos generales
  clientName: varchar("clientName", { length: 255 }).notNull(),
  dealId: varchar("dealId", { length: 100 }),
  serviceName: varchar("serviceName", { length: 255 }).notNull(),
  serviceType: mysqlEnum("serviceType", ["soporte_incidentes", "requerimientos", "evolutivos", "mixto"]).notNull(),
  durationMonths: int("durationMonths").notNull(),
  estimatedStartDate: date("estimatedStartDate", { mode: "string" }),
  formalStartDate: date("formalStartDate", { mode: "string" }),
  endDate: date("endDate", { mode: "string" }),
  // Estructura de cobro
  billingType: mysqlEnum("billingType", ["cuota_fija", "cuotas_variables"]).notNull(),
  fixedMonthlyAmount: decimal("fixedMonthlyAmount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  totalContractAmount: decimal("totalContractAmount", { precision: 12, scale: 2 }),
  // Estado del pipeline
  status: mysqlEnum("status", ["activo", "pausado", "completado", "cancelado"]).default("activo").notNull(),
  currentStage: mysqlEnum("currentStage", ["inicializacion", "plan_trabajo", "jira_setup", "ejecucion", "cierre"]).default("inicializacion").notNull(),
  // Integración CRM Pipedrive
  pipedrivePersonName: varchar("pipedrivePersonName", { length: 255 }),
  pipedrivePersonEmail: varchar("pipedrivePersonEmail", { length: 320 }),
  pipedrivePersonPhone: varchar("pipedrivePersonPhone", { length: 100 }),
  pipedriveDealAmount: decimal("pipedriveDealAmount", { precision: 12, scale: 2 }),
  pipedriveDealCreatedAt: date("pipedriveDealCreatedAt", { mode: "string" }),
  pipedriveDealClosedAt: date("pipedriveDealClosedAt", { mode: "string" }),
  pipedriveInteractionCount: int("pipedriveInteractionCount"),
  pipedriveOrgName: varchar("pipedriveOrgName", { length: 255 }),
  pipedriveOrgAddress: varchar("pipedriveOrgAddress", { length: 500 }),
  pipedriveDealStatus: varchar("pipedriveDealStatus", { length: 50 }),
  pipedriveDealCurrency: varchar("pipedriveDealCurrency", { length: 10 }),
  pipedriveEmailsCount: int("pipedriveEmailsCount"),
  pipedriveNotesCount: int("pipedriveNotesCount"),
  pipedriveNotesRaw: text("pipedriveNotesRaw"),
  pipedriveFlowSummary: text("pipedriveFlowSummary"),
  pipedriveSyncedAt: timestamp("pipedriveSyncedAt"),
  pipedriveAiSummary: text("pipedriveAiSummary"),
  pipedriveClientConcerns: text("pipedriveClientConcerns"),
  // Integración JSM
  jsmPlatform: mysqlEnum("jsmPlatform", ["prodigio", "cliente"]).default("prodigio"),
  jsmProjectKey: varchar("jsmProjectKey", { length: 50 }),
  jsmProjectId: varchar("jsmProjectId", { length: 50 }),
  jsmPortalUrl: varchar("jsmPortalUrl", { length: 500 }),
  jsmOrganizationId: varchar("jsmOrganizationId", { length: 50 }),
  jsmServiceDeskId: varchar("jsmServiceDeskId", { length: 50 }),
  jsmClientPlatformUrl: varchar("jsmClientPlatformUrl", { length: 500 }),
  // Flujo de inicialización (2 pasos)
  initStep1Confirmed: boolean("initStep1Confirmed").default(false),
  pipedriveAiRecommendations: text("pipedriveAiRecommendations"),
  // Análisis agéntico persistido
  aiHealthStatus: varchar("aiHealthStatus", { length: 20 }),
  aiHealthJustification: text("aiHealthJustification"),
  aiExecutiveAbstract: text("aiExecutiveAbstract"),
  aiFullAnalysis: text("aiFullAnalysis"),
  aiAnalysisDate: timestamp("aiAnalysisDate"),
  // Responsables
  pmId: int("pmId"),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RecurringService = typeof recurringServices.$inferSelect;
export type InsertRecurringService = typeof recurringServices.$inferInsert;

// ==================== RECURRING SERVICE BILLING MONTHS ====================
export const recurringServiceBillingMonths = mysqlTable("recurring_service_billing_months", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  monthNumber: int("monthNumber").notNull(),
  dueDate: date("dueDate", { mode: "string" }),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD"),
  status: mysqlEnum("status", ["pendiente", "facturado", "pagado"]).default("pendiente").notNull(),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  invoiceNumber: varchar("invoiceNumber", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecurringServiceBillingMonth = typeof recurringServiceBillingMonths.$inferSelect;
export type InsertRecurringServiceBillingMonth = typeof recurringServiceBillingMonths.$inferInsert;

// ==================== RECURRING SERVICE DOCUMENTS ====================
export const recurringServiceDocuments = mysqlTable("recurring_service_documents", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  docType: mysqlEnum("docType", ["propuesta_tecnica", "pl", "sow", "contrato", "otro"]).notNull(),
  fileName: varchar("fileName", { length: 500 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
  fileKey: varchar("fileKey", { length: 500 }),
  uploadedBy: int("uploadedBy"),
  uploadedAt: timestamp("uploadedAt").defaultNow().notNull(),
});
export type RecurringServiceDocument = typeof recurringServiceDocuments.$inferSelect;
export type InsertRecurringServiceDocument = typeof recurringServiceDocuments.$inferInsert;

// ==================== RECURRING SERVICE STAGES ====================
export const recurringServiceStages = mysqlTable("recurring_service_stages", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  stageId: mysqlEnum("stageId", ["inicializacion", "plan_trabajo", "jira_setup", "ejecucion", "cierre"]).notNull(),
  status: mysqlEnum("status", ["locked", "in_progress", "completed"]).default("locked").notNull(),
  completedAt: timestamp("completedAt"),
  completedBy: int("completedBy"),
  data: json("data"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type RecurringServiceStage = typeof recurringServiceStages.$inferSelect;
export type InsertRecurringServiceStage = typeof recurringServiceStages.$inferInsert;

// ==================== RECURRING SERVICE WORK PLAN ====================
export const recurringServiceWorkPlan = mysqlTable("recurring_service_work_plan", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  itemType: mysqlEnum("itemType", ["informe_mensual", "facturacion", "tarea_programada", "sla_definition", "coverage_definition"]).notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  frequency: varchar("frequency", { length: 100 }),
  dueDate: date("dueDate", { mode: "string" }),
  monthNumber: int("monthNumber"),
  status: mysqlEnum("status", ["pendiente", "en_progreso", "completado", "vencido"]).default("pendiente").notNull(),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecurringServiceWorkPlanItem = typeof recurringServiceWorkPlan.$inferSelect;
export type InsertRecurringServiceWorkPlanItem = typeof recurringServiceWorkPlan.$inferInsert;

// ==================== RECURRING SERVICE SLA CONFIG ====================
export const recurringServiceSlaConfig = mysqlTable("recurring_service_sla_config", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  priority: mysqlEnum("priority", ["critical", "high", "medium", "low"]).notNull(),
  firstResponseMinutes: int("firstResponseMinutes").notNull(),
  resolutionMinutes: int("resolutionMinutes").notNull(),
  coverageType: mysqlEnum("coverageType", ["24x7", "8x5", "personalizado"]).default("8x5").notNull(),
  customCoverageDescription: varchar("customCoverageDescription", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecurringServiceSlaConfigItem = typeof recurringServiceSlaConfig.$inferSelect;
export type InsertRecurringServiceSlaConfigItem = typeof recurringServiceSlaConfig.$inferInsert;

// ==================== RECURRING SERVICE PENALTIES ====================
export const recurringServicePenalties = mysqlTable("recurring_service_penalties", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  penaltyDate: date("penaltyDate", { mode: "string" }).notNull(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }),
  currency: varchar("currency", { length: 10 }).default("USD"),
  jiraIssueKey: varchar("jiraIssueKey", { length: 50 }),
  status: mysqlEnum("status", ["identificada", "aplicada", "disputada", "resuelta"]).default("identificada").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecurringServicePenalty = typeof recurringServicePenalties.$inferSelect;
export type InsertRecurringServicePenalty = typeof recurringServicePenalties.$inferInsert;

// ==================== RECURRING SERVICE AI ANALYSES (HISTORY) ====================
export const recurringServiceAiAnalyses = mysqlTable("recurring_service_ai_analyses", {
  id: int("id").autoincrement().primaryKey(),
  serviceId: int("serviceId").notNull(),
  semaphore: varchar("semaphore", { length: 20 }).notNull(),
  semaphoreJustification: text("semaphoreJustification"),
  executiveAbstract: text("executiveAbstract"),
  fullAnalysis: text("fullAnalysis"),
  // Desglose del semáforo por dimensión
  slaDimension: varchar("slaDimension", { length: 20 }),
  slaScore: int("slaScore"),
  slaDetail: text("slaDetail"),
  deliverablesDimension: varchar("deliverablesDimension", { length: 20 }),
  deliverablesScore: int("deliverablesScore"),
  deliverablesDetail: text("deliverablesDetail"),
  billingDimension: varchar("billingDimension", { length: 20 }),
  billingScore: int("billingScore"),
  billingDetail: text("billingDetail"),
  generatedBy: int("generatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RecurringServiceAiAnalysis = typeof recurringServiceAiAnalyses.$inferSelect;
export type InsertRecurringServiceAiAnalysis = typeof recurringServiceAiAnalyses.$inferInsert;

/**
 * Registro de ejecuciones de la sincronización financiera (cron diario o manual).
 * Cada corrida del endpoint /api/scheduled/syncFinancial deja una fila con el
 * resultado: estado, cantidad de Deals leídos/insertados/actualizados y el error
 * si falló. Permite auditar el historial desde la vista de administración.
 */
export const financialSyncLogs = mysqlTable("financial_sync_log", {
  id: int("id").autoincrement().primaryKey(),
  status: mysqlEnum("status", ["applied", "error"]).notNull(),
  inputDeals: int("inputDeals").notNull().default(0),
  insertCount: int("insertCount").notNull().default(0),
  updateCount: int("updateCount").notNull().default(0),
  errorMessage: text("errorMessage"),
  triggeredBy: varchar("triggeredBy", { length: 20 }).notNull().default("cron"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FinancialSyncLog = typeof financialSyncLogs.$inferSelect;
export type InsertFinancialSyncLog = typeof financialSyncLogs.$inferInsert;

/**
 * Snapshot diario de salud por proyecto para la Consola de Gobierno PMO.
 * Persiste el IGE, estado, gatillos activos y métricas clave en cada corte
 * para calcular el deterioro (ΔIGE) entre cortes consecutivos.
 */
export const projectHealthSnapshots = mysqlTable("project_health_snapshot", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  cutoffDate: timestamp("cutoffDate").notNull(),
  ige: int("ige"),
  estado: varchar("estado", { length: 20 }),
  gatillos: text("gatillos"), // JSON array de gatillos activos
  ufEnRiesgo: int("ufEnRiesgo"),
  hitosVencidos: int("hitosVencidos"),
  hitosExigibles: int("hitosExigibles"),
  p0Vencidas: int("p0Vencidas"),
  planesRecuperacionVencidos: int("planesRecuperacionVencidos"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ProjectHealthSnapshot = typeof projectHealthSnapshots.$inferSelect;
export type InsertProjectHealthSnapshot = typeof projectHealthSnapshots.$inferInsert;
