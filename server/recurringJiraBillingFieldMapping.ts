import { getAdminSettingValue } from "./db";

export const RECURRING_JIRA_BILLING_FIELD_SETTING_PREFIX = "recurring-jira-billing-field";

export type RecurringJiraBillingFieldMapping = {
  version: 1;
  serviceId: number;
  projectId: string;
  projectKey: string;
  fieldId: string;
  fieldName: string;
  verifiedAt: string;
};

export type RecurringJiraBillingFieldMappingScope = {
  serviceId: number;
  projectId?: string | null;
  projectKey?: string | null;
};

export type RecurringJiraBillingFieldMappingLoad = {
  mapping: RecurringJiraBillingFieldMapping | null;
  present: boolean;
  error: string | null;
};

export function getRecurringJiraBillingFieldMappingKey(serviceId: number): string {
  if (!Number.isInteger(serviceId) || serviceId <= 0) {
    throw new Error("serviceId inválido para mapping de facturación Jira");
  }
  return `${RECURRING_JIRA_BILLING_FIELD_SETTING_PREFIX}:${serviceId}`;
}

/** Alias corto para consumidores que sólo necesitan construir la clave determinista. */
export const recurringJiraBillingFieldMappingKey = getRecurringJiraBillingFieldMappingKey;

function invalid(message: string): never {
  throw new Error(`Mapping de facturación Jira inválido: ${message}`);
}

function parseObject(raw: unknown): Record<string, unknown> {
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

function asExpectedScope(expected: number | RecurringJiraBillingFieldMappingScope): RecurringJiraBillingFieldMappingScope {
  return typeof expected === "number" ? { serviceId: expected } : expected;
}

/**
 * Parses and validates a stored mapping. When a linked project identity is supplied,
 * both project id and key must match exactly; this prevents cross-service fallback.
 */
export function parseRecurringJiraBillingFieldMapping(
  raw: unknown,
  expected: number | RecurringJiraBillingFieldMappingScope,
): RecurringJiraBillingFieldMapping {
  const value = parseObject(raw);
  const scope = asExpectedScope(expected);

  if (value.version !== 1) invalid("version debe ser 1");
  if (!Number.isInteger(value.serviceId) || value.serviceId !== scope.serviceId) {
    invalid("serviceId fuera de scope");
  }

  const projectId = typeof value.projectId === "number" && Number.isInteger(value.projectId)
    ? String(value.projectId)
    : typeof value.projectId === "string"
      ? value.projectId.trim()
      : "";
  if (!projectId) invalid("projectId vacío");
  if (scope.projectId !== undefined && scope.projectId !== null && projectId !== String(scope.projectId)) {
    invalid("projectId no coincide con el JSM vinculado");
  }
  if (scope.projectId === null) invalid("el servicio no tiene projectId JSM vinculado");

  const projectKey = typeof value.projectKey === "string" ? value.projectKey.trim() : "";
  if (!projectKey) invalid("projectKey vacío");
  if (scope.projectKey !== undefined && scope.projectKey !== null && projectKey !== scope.projectKey) {
    invalid("projectKey no coincide con el JSM vinculado");
  }
  if (scope.projectKey === null) invalid("el servicio no tiene projectKey JSM vinculado");

  const fieldId = typeof value.fieldId === "string" ? value.fieldId.trim() : "";
  if (!/^customfield_\d+$/.test(fieldId)) invalid("fieldId debe tener formato customfield_<número>");

  const fieldName = typeof value.fieldName === "string" ? value.fieldName.trim() : "";
  if (!fieldName) invalid("fieldName vacío");

  const verifiedAt = typeof value.verifiedAt === "string" ? value.verifiedAt.trim() : "";
  if (!verifiedAt || !Number.isFinite(Date.parse(verifiedAt))) invalid("verifiedAt no es una fecha válida");

  return {
    version: 1,
    serviceId: scope.serviceId,
    projectId,
    projectKey,
    fieldId,
    fieldName,
    verifiedAt,
  };
}

export function tryParseRecurringJiraBillingFieldMapping(
  raw: unknown,
  expected: number | RecurringJiraBillingFieldMappingScope,
): { mapping: RecurringJiraBillingFieldMapping | null; error: string | null } {
  try {
    return { mapping: parseRecurringJiraBillingFieldMapping(raw, expected), error: null };
  } catch (error) {
    return { mapping: null, error: error instanceof Error ? error.message : "Mapping de facturación Jira inválido" };
  }
}

/** Reads one service-scoped setting; absence is compatibility, invalid/error is not. */
export async function loadRecurringJiraBillingFieldMapping(
  scope: RecurringJiraBillingFieldMappingScope,
): Promise<RecurringJiraBillingFieldMappingLoad> {
  const key = getRecurringJiraBillingFieldMappingKey(scope.serviceId);
  let raw: unknown;
  try {
    raw = await getAdminSettingValue(key);
  } catch (error) {
    const reason = error instanceof Error ? error.message.slice(0, 180) : "Database no disponible";
    return { mapping: null, present: true, error: `No se pudo leer ${key}: ${reason}` };
  }
  if (raw === null || raw === undefined) return { mapping: null, present: false, error: null };

  const parsed = tryParseRecurringJiraBillingFieldMapping(raw, scope);
  return { mapping: parsed.mapping, present: true, error: parsed.error };
}
