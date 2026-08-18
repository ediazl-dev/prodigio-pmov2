export type ReviewableCommitmentPreview = {
  title: string;
  ownerName?: string;
  dueDate?: string;
  notes: string;
  confidence: "detected";
};

function normalizeDate(value: string) {
  const iso = value.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const latin = value.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
  if (!latin) return undefined;
  const day = latin[1].padStart(2, "0");
  const month = latin[2].padStart(2, "0");
  return `${latin[3]}-${month}-${day}`;
}

/**
 * Identifica únicamente líneas que se declaran explícitamente como compromiso,
 * acuerdo, acción o pendiente. No determina cumplimiento, ni completa datos
 * ausentes: el resultado siempre debe ser revisado antes de persistirse.
 */
export function extractReviewableCommitments(rawText: string): ReviewableCommitmentPreview[] {
  const seen = new Set<string>();
  const lines = rawText.split(/\r?\n/).map((line) => line.replace(/^\s*[-*•\d.)]+\s*/, "").trim()).filter(Boolean);
  const previews: ReviewableCommitmentPreview[] = [];

  for (const line of lines) {
    if (!/\b(compromiso|acuerdo|acci[oó]n|pendiente|se\s+acuerda)\b/i.test(line)) continue;
    const title = line
      .replace(/^\s*(compromiso|acuerdo|acci[oó]n|pendiente|se\s+acuerda)\s*[:\-–—]?\s*/i, "")
      .replace(/\b(responsable|due[nñ]o|owner)\s*[:\-].*$/i, "")
      .replace(/\b(fecha|vence|plazo)\s*[:\-].*$/i, "")
      .trim();
    if (title.length < 3) continue;

    const key = title.toLocaleLowerCase("es-CL");
    if (seen.has(key)) continue;
    seen.add(key);

    const ownerMatch = line.match(/\b(?:responsable|due[nñ]o|owner)\s*[:\-]\s*([^.;]+)/i);
    previews.push({
      title,
      ownerName: ownerMatch?.[1]?.trim() || undefined,
      dueDate: normalizeDate(line),
      notes: `Línea detectada: ${line}`,
      confidence: "detected",
    });
    if (previews.length === 25) break;
  }

  return previews;
}
