export type FinancialEvidenceSource = "snapshot" | "financial_sync" | "POR_CONFIRMAR";

type FinancialLike = object | null | undefined;

type FinancialEvidenceInput = {
  persistedSnapshot?: { capturedAt?: Date | string | null; financialData?: FinancialLike } | null;
  syncedFinancial?: FinancialLike;
  impact: unknown;
};

const SYNCED_FIELDS = [
  ["valorVentaUF", "Venta contractual"],
  ["presupuestoUF", "Presupuesto"],
  ["utilizadoUF", "Costo ejecutado"],
  ["margenBrutoNotaVentaUF", "Margen de nota de venta"],
  ["margenProyectadoUF", "Margen proyectado"],
  ["capacityHH", "Capacidad (HH)"],
  ["presupuestoHH", "Presupuesto (HH)"],
] as const;

const GOVERNANCE_FIELDS = [
  ["annualWacc", "WACC anual"],
  ["blockedHeadcount", "Headcount bloqueado"],
  ["dailyRateUf", "Tarifa diaria UF"],
  ["blockedDays", "Días bloqueados"],
  ["penaltyUf", "Penalidad contractual UF"],
] as const;

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function asRecord(record: FinancialLike) {
  return record as Record<string, unknown> | null | undefined;
}

function fieldsPresent(record: FinancialLike, fields: readonly (readonly [string, string])[]) {
  const values = asRecord(record);
  return fields.filter(([key]) => hasValue(values?.[key])).map(([, label]) => label);
}

function fieldsMissing(record: FinancialLike, fields: readonly (readonly [string, string])[]) {
  const values = asRecord(record);
  return fields.filter(([key]) => !hasValue(values?.[key])).map(([, label]) => label);
}

/**
 * Makes financial provenance explicit. This must never replace an absent
 * governance input with zero, nor imply that financial synchronization governs
 * contractual completion.
 */
export function buildExecutiveFinancialEvidence(input: FinancialEvidenceInput) {
  const snapshotData = input.persistedSnapshot?.financialData;
  const activeRecord = snapshotData && Object.keys(snapshotData).length > 0 ? snapshotData : input.syncedFinancial;
  const source: FinancialEvidenceSource = snapshotData && Object.keys(snapshotData).length > 0
    ? "snapshot"
    : input.syncedFinancial && Object.keys(input.syncedFinancial).length > 0
      ? "financial_sync"
      : "POR_CONFIRMAR";
  const syncedRecord = asRecord(input.syncedFinancial);
  const capturedAt = input.persistedSnapshot?.capturedAt
    ?? syncedRecord?.syncedAt as Date | string | null | undefined
    ?? syncedRecord?.updatedAt as Date | string | null | undefined
    ?? null;

  return {
    source,
    capturedAt,
    availableFields: fieldsPresent(activeRecord, SYNCED_FIELDS),
    pendingFields: fieldsMissing(activeRecord, GOVERNANCE_FIELDS),
    coverage: {
      synced: fieldsPresent(activeRecord, SYNCED_FIELDS).length,
      syncedExpected: SYNCED_FIELDS.length,
      governance: fieldsPresent(activeRecord, GOVERNANCE_FIELDS).length,
      governanceExpected: GOVERNANCE_FIELDS.length,
    },
    impact: input.impact,
  };
}
