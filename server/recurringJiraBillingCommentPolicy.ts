import { getAdminSettingValue } from "./db";
import type { JiraIssue } from "./jiraClient";

export const RECURRING_JIRA_BILLING_COMMENT_POLICY_SETTING_PREFIX = "recurring-jira-billing-comment-policy";

export type RecurringJiraBillingCommentPolicy = {
  version: 1;
  serviceId: number;
  projectId: string;
  projectKey: string;
  issueKeys: string[];
  authorAccountIds: string[];
  verifiedAt: string;
};

/** Identidad completa del servicio y del proyecto Jira al que se limita la política. */
export type RecurringJiraBillingCommentPolicyScope = {
  serviceId: number;
  projectId: string | number | null | undefined;
  projectKey: string | null | undefined;
};

export type RecurringJiraBillingCommentPolicyLoad = {
  policy: RecurringJiraBillingCommentPolicy | null;
  present: boolean;
  error: string | null;
};

export type ExplicitJiraBillingCommentConfirmation = {
  status: "billed" | "not_billed" | "unknown";
  id: string;
  authorAccountId: string;
  authorName: string;
  updatedAt: string;
  text: string;
};

export function getRecurringJiraBillingCommentPolicyKey(serviceId: number): string {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new Error("serviceId inválido para política de comentarios Jira");
  }
  return `${RECURRING_JIRA_BILLING_COMMENT_POLICY_SETTING_PREFIX}:${serviceId}`;
}

/** Alias corto para consumidores que sólo necesitan construir la clave determinista. */
export const recurringJiraBillingCommentPolicyKey = getRecurringJiraBillingCommentPolicyKey;

function invalid(message: string): never {
  throw new Error(`Política de comentarios Jira inválida: ${message}`);
}

function objectValue(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      invalid("JSON no válido");
    }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    invalid("se esperaba un objeto JSON");
  }
  return raw as Record<string, unknown>;
}

function scopeProjectId(value: unknown): string {
  if (typeof value === "number" && Number.isInteger(value)) return String(value);
  return typeof value === "string" ? value.trim() : "";
}

function scopeProjectKey(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAccountId(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function assertScope(scope: RecurringJiraBillingCommentPolicyScope): { serviceId: number; projectId: string; projectKey: string } {
  if (!Number.isInteger(scope.serviceId) || scope.serviceId <= 0) invalid("serviceId inválido");
  const projectId = scopeProjectId(scope.projectId);
  if (!projectId) invalid("projectId vacío");
  const projectKey = scopeProjectKey(scope.projectKey);
  if (!projectKey) invalid("projectKey vacío");
  return { serviceId: scope.serviceId, projectId, projectKey };
}

function isJiraIssueKey(value: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(value);
}

export function parseRecurringJiraBillingCommentPolicy(
  raw: unknown,
  expected: RecurringJiraBillingCommentPolicyScope,
): RecurringJiraBillingCommentPolicy {
  const scope = assertScope(expected);
  const value = objectValue(raw);

  if (value.version !== 1) invalid("version debe ser 1");
  if (!Number.isInteger(value.serviceId) || value.serviceId !== scope.serviceId) {
    invalid("serviceId fuera de scope");
  }

  const projectId = scopeProjectId(value.projectId);
  if (!projectId) invalid("projectId vacío");
  if (projectId !== scope.projectId) invalid("projectId no coincide con el proyecto Jira vinculado");

  const projectKey = scopeProjectKey(value.projectKey);
  if (!projectKey) invalid("projectKey vacío");
  if (projectKey !== scope.projectKey) invalid("projectKey no coincide con el proyecto Jira vinculado");

  if (!Array.isArray(value.issueKeys) || value.issueKeys.length !== 6) {
    invalid("issueKeys debe contener exactamente 6 claves explícitas");
  }
  const issueKeys = value.issueKeys.map((key, index) => {
    if (typeof key !== "string" || !isJiraIssueKey(key.trim())) {
      invalid(`issueKeys[${index}] no es una clave Jira válida`);
    }
    const normalized = key.trim();
    const prefix = normalized.slice(0, normalized.lastIndexOf("-"));
    if (prefix !== projectKey) invalid(`issueKeys[${index}] está fuera del projectKey de scope`);
    return normalized;
  });
  if (new Set(issueKeys).size !== issueKeys.length) invalid("issueKeys contiene duplicados");

  if (!Array.isArray(value.authorAccountIds) || value.authorAccountIds.length === 0) {
    invalid("authorAccountIds debe contener autores verificados");
  }
  const authorAccountIds = value.authorAccountIds.map((author, index) => {
    const normalized = normalizeAccountId(author);
    if (!normalized) invalid(`authorAccountIds[${index}] vacío`);
    return normalized;
  });
  if (new Set(authorAccountIds).size !== authorAccountIds.length) invalid("authorAccountIds contiene duplicados");

  const verifiedAt = typeof value.verifiedAt === "string" ? value.verifiedAt.trim() : "";
  if (!verifiedAt || !Number.isFinite(Date.parse(verifiedAt))) invalid("verifiedAt no es una fecha válida");

  return {
    version: 1,
    serviceId: scope.serviceId,
    projectId: scope.projectId,
    projectKey: scope.projectKey,
    issueKeys,
    authorAccountIds,
    verifiedAt,
  };
}

export function tryParseRecurringJiraBillingCommentPolicy(
  raw: unknown,
  expected: RecurringJiraBillingCommentPolicyScope,
): { policy: RecurringJiraBillingCommentPolicy | null; error: string | null } {
  try {
    return { policy: parseRecurringJiraBillingCommentPolicy(raw, expected), error: null };
  } catch (error) {
    return {
      policy: null,
      error: error instanceof Error ? error.message : "Política de comentarios Jira inválida",
    };
  }
}

/** Lee únicamente la configuración del servicio; una política inválida nunca cae a un fallback global. */
export async function loadRecurringJiraBillingCommentPolicy(
  scope: RecurringJiraBillingCommentPolicyScope,
): Promise<RecurringJiraBillingCommentPolicyLoad> {
  const key = getRecurringJiraBillingCommentPolicyKey(scope.serviceId);
  let raw: unknown;
  try {
    raw = await getAdminSettingValue(key);
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 180) : "Base de datos no disponible";
    return { policy: null, present: true, error: `No se pudo leer ${key}: ${reason}` };
  }
  if (raw === null || raw === undefined) return { policy: null, present: false, error: null };

  const parsed = tryParseRecurringJiraBillingCommentPolicy(raw, scope);
  return { policy: parsed.policy, present: true, error: parsed.error };
}

type JiraCommentCandidate = ExplicitJiraBillingCommentConfirmation & {
  timestamp: number;
  order: number;
};

type TextRange = { start: number; end: number };

function withoutDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function isBlockType(type: string): boolean {
  return new Set([
    "paragraph",
    "heading",
    "blockquote",
    "codeblock",
    "listitem",
    "bulletlist",
    "orderedlist",
    "panel",
    "table",
    "tablerow",
    "tablecell",
    "tableheader",
  ]).has(type);
}

/** Convierte ADF anidado a texto y excluye citas/bloques de código como evidencia. */
function adfText(value: unknown, quoted = false): string {
  if (value === null || value === undefined || quoted) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(item => adfText(item, quoted)).join("");
  if (typeof value !== "object") return "";

  const object = value as Record<string, unknown>;
  const type = typeof object.type === "string" ? object.type.toLowerCase() : "";
  if (type === "blockquote" || type === "codeblock") return "";
  if (type === "hardbreak" || type === "hard_break") return "\n";
  const ownText = typeof object.text === "string" ? object.text : "";
  const content = adfText(object.content, false);
  const result = `${ownText}${content}`;
  return isBlockType(type) ? `${result}\n` : result;
}

function removeQuotedLines(value: string): string {
  const lines = value.split(/\r?\n/).filter(line => {
    const trimmed = line.trim();
    return !trimmed.startsWith(">") && !/^(?:cita|quote|quoted)\s*:/i.test(trimmed);
  });
  let text = lines.join("\n");
  // Las comillas explícitas son citas, no confirmaciones propias del autor.
  text = text.replace(/“[^“”\n]{0,800}”|"[^"\n]{0,800}"/g, " ");
  return text;
}

function normalizedCommentText(body: unknown): string {
  const extracted = removeQuotedLines(adfText(body));
  return extracted
    .split(/\r?\n/)
    .map(line => line.trim().replace(/[ \t]+/g, " "))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function isGeneratedRecurringIssue(issue: JiraIssue): boolean {
  const labels = Array.isArray(issue.fields?.labels)
    ? issue.fields.labels.map(label => String(label).trim().toLowerCase())
    : [];
  return labels.some(label =>
    label === "pmo-recurring"
      || label === "pmo-generated"
      || label.startsWith("pmo-rs-")
      || label.startsWith("pmo-service-")
      || label.startsWith("pmo-generated-"),
  );
}

function issueIsInPolicyScope(issue: JiraIssue, policy: RecurringJiraBillingCommentPolicy): boolean {
  const issueKey = typeof issue.key === "string" ? issue.key : "";
  const project = issue.fields?.project;
  const projectKey = typeof project?.key === "string" ? project.key : "";
  const projectId = scopeProjectId(project?.id);
  return policy.issueKeys.includes(issueKey)
    && projectKey === policy.projectKey
    && projectId === policy.projectId;
}

function isAuthorAllowed(comment: Record<string, unknown>, policy: RecurringJiraBillingCommentPolicy): {
  accountId: string;
  displayName: string;
} | null {
  const author = comment.author;
  if (!author || typeof author !== "object" || Array.isArray(author)) return null;
  const authorObject = author as Record<string, unknown>;
  if (authorObject.accountType !== "atlassian") return null;
  const accountId = normalizeAccountId(authorObject.accountId);
  if (!accountId || !policy.authorAccountIds.includes(accountId)) return null;
  const displayName = typeof authorObject.displayName === "string" ? authorObject.displayName : "";
  return { accountId, displayName };
}

function otherIssueKeys(text: string, currentKey: string): boolean {
  const issueKeyPattern = /\b[A-Z][A-Z0-9_]*-\d+\b/g;
  return Array.from(text.matchAll(issueKeyPattern)).some(match => match[0] !== currentKey);
}

function hasQuestionOrUncertainty(text: string): boolean {
  const prose = text.replace(/https?:\/\/\S+/gi, " ");
  const normalized = withoutDiacritics(prose).toLowerCase();
  return prose.includes("?")
    || prose.includes("¿")
    || /\b(?:quizas|posiblemente|probablemente|aparentemente|parece|pareceria|creo que|tal vez|tentativ\w*|por confirmar|pendiente de confirmar|podria|deberia)\b/.test(normalized);
}

function hasFutureAction(text: string): boolean {
  const normalized = withoutDiacritics(text).toLowerCase();
  return /\b(?:se facturara|se facturara|se va a facturar|vamos a facturar|facturaremos|facturara|sera facturado|pendiente de facturar|a facturar|para facturar|se debe facturar|en el futuro|a futuro|proxima facturacion)\b/.test(normalized);
}

function rangesFor(text: string, expression: RegExp): TextRange[] {
  const ranges: TextRange[] = [];
  for (const match of Array.from(text.matchAll(expression))) {
    if (match.index !== undefined) ranges.push({ start: match.index, end: match.index + match[0].length });
  }
  return ranges;
}

function overlaps(range: TextRange, ranges: TextRange[]): boolean {
  return ranges.some(other => range.start < other.end && other.start < range.end);
}

function classifyText(text: string): "billed" | "not_billed" | "unknown" | null {
  const normalized = withoutDiacritics(text).toLowerCase();
  if (!normalized) return null;
  if (hasQuestionOrUncertainty(text) || hasFutureAction(text)) return null;

  const negativeRanges = [
    ...rangesFor(normalized, /\bno\s+facturado\b/g),
    ...rangesFor(normalized, /\bfacturacion\s+anulada\b/g),
    ...rangesFor(normalized, /\bfacturacion\s+no\s+confirmada\b/g),
  ];
  const positiveRanges = [
    ...rangesFor(normalized, /^\s*facturado(?:\s*[.!:]\s*)?$/gm),
    ...rangesFor(normalized, /^\s*facturacion\s+confirmada(?:\s+el\s+\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)?\s*[.!:]?\s*$/gm),
    ...rangesFor(normalized, /^\s*confirmada\s+facturacion\s*,?\s*asociada\s+a\s+la\s+hes(?:\s*[.!:]?\s*)?$/gm),
    ...rangesFor(normalized, /^\s*facturacion\s+completada\s+asociada\s+a\s+la\s+hes(?:\s+\S.*)?$/gm),
  ].filter(range => !overlaps(range, negativeRanges));

  const hasNegative = negativeRanges.length > 0;
  const hasPositive = positiveRanges.length > 0;
  if (hasNegative && hasPositive) return "unknown";
  if (hasNegative) return "not_billed";
  if (hasPositive) return "billed";
  return null;
}

function commentTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Evalúa sólo evidencia explícita, completa y opt-in de la política. No usa el estado
 * Done ni fechas escritas en el texto; `updatedAt` siempre es la observación Jira.
 */
export function getExplicitJiraBillingCommentConfirmation(
  issue: JiraIssue,
  policy: RecurringJiraBillingCommentPolicy | undefined,
): ExplicitJiraBillingCommentConfirmation | null {
  if (!policy || !issueIsInPolicyScope(issue, policy) || isGeneratedRecurringIssue(issue)) return null;

  const commentField = issue.fields?.comment;
  if (!commentField || typeof commentField !== "object" || Array.isArray(commentField)) return null;
  const comments = (commentField as Record<string, unknown>).comments;
  const startAt = (commentField as Record<string, unknown>).startAt;
  const total = (commentField as Record<string, unknown>).total;
  if (!Array.isArray(comments) || startAt !== 0 || !Number.isInteger(total) || (total as number) < 0 || (total as number) > comments.length) {
    return null;
  }

  const candidates: JiraCommentCandidate[] = [];
  comments.forEach((value, order) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const comment = value as Record<string, unknown>;
    const author = isAuthorAllowed(comment, policy);
    if (!author) return;
    const id = typeof comment.id === "string" || typeof comment.id === "number" ? String(comment.id) : "";
    const updatedAt = typeof comment.updated === "string" ? comment.updated : "";
    const timestamp = commentTimestamp(updatedAt);
    if (!id || timestamp === null) return;

    const text = normalizedCommentText(comment.body);
    if (!text || otherIssueKeys(text, issue.key)) return;
    const status = classifyText(text);
    if (!status) return;
    candidates.push({
      status,
      id,
      authorAccountId: author.accountId,
      authorName: author.displayName,
      updatedAt,
      text,
      timestamp,
      order,
    });
  });

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => left.timestamp - right.timestamp || left.order - right.order);
  const latestTimestamp = candidates[candidates.length - 1].timestamp;
  const latest = candidates.filter(candidate => candidate.timestamp === latestTimestamp);
  const hasBilled = latest.some(candidate => candidate.status === "billed");
  const hasNotBilled = latest.some(candidate => candidate.status === "not_billed");
  const selected = latest[latest.length - 1];
  return {
    status: hasBilled && hasNotBilled ? "unknown" : selected.status,
    id: selected.id,
    authorAccountId: selected.authorAccountId,
    authorName: selected.authorName,
    updatedAt: selected.updatedAt,
    text: selected.text,
  };
}
