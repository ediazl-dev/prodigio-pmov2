export type ProjectDealSource = "project_field" | "contract_link" | "name_match" | null;

export type ResolvedProjectDeal = {
  dealId: string | null;
  source: ProjectDealSource;
  formallyLinked: boolean;
};

/** Normaliza identificadores como `Deal 4728`, `deal4728` o `4728`. */
export function normalizeDealId(value: string | null | undefined): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const explicit = raw.match(/\bDeal\s*([A-Za-z0-9_-]+)\b/i);
  if (explicit?.[1]) return `Deal${explicit[1]}`;
  const standalone = raw.match(/^([0-9]{4,})$/);
  return standalone?.[1] ? `Deal${standalone[1]}` : null;
}

/**
 * Prioridad única para toda la plataforma: campo formal, contrato enlazado y,
 * sólo si ambos faltan, Deal explícito en el nombre. La última vía habilita la
 * lectura, pero no simula que la asociación local ya fue formalizada.
 */
export function resolveProjectDeal(input: {
  projectDealId: string | null | undefined;
  projectName: string | null | undefined;
  linkedDealIds?: Array<string | null | undefined>;
}): ResolvedProjectDeal {
  const directRaw = String(input.projectDealId ?? "").trim();
  const direct = directRaw ? (normalizeDealId(directRaw) ?? directRaw) : null;
  if (direct) return { dealId: direct, source: "project_field", formallyLinked: true };
  const fromName = normalizeDealId(input.projectName);
  const linkedDeals = Array.from(new Set(
    (input.linkedDealIds ?? [])
      .map((value) => String(value ?? "").trim())
      .filter(Boolean)
      .map((value) => normalizeDealId(value) ?? value),
  ));
  if (linkedDeals.length === 1) return { dealId: linkedDeals[0], source: "contract_link", formallyLinked: true };
  if (fromName && linkedDeals.some((dealId) => dealId.toLowerCase() === fromName.toLowerCase())) {
    return { dealId: fromName, source: "contract_link", formallyLinked: true };
  }
  return fromName
    ? { dealId: fromName, source: "name_match", formallyLinked: false }
    : { dealId: null, source: null, formallyLinked: false };
}

export function sameDeal(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftRaw = String(left ?? "").trim();
  const rightRaw = String(right ?? "").trim();
  const normalizedLeft = normalizeDealId(leftRaw) ?? leftRaw;
  const normalizedRight = normalizeDealId(rightRaw) ?? rightRaw;
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft.toLowerCase() === normalizedRight.toLowerCase());
}
