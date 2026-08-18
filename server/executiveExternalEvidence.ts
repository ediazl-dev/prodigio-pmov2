export type ExternalEvidenceAvailability = "available" | "unavailable" | "timed_out";

export type ExternalEvidenceResult<T> = {
  availability: ExternalEvidenceAvailability;
  value: T | null;
  observedAt: string | null;
  reason: "source_error" | "timeout" | null;
};

export class ExternalEvidenceTimeoutError extends Error {
  constructor(public readonly source: string) {
    super(`Tiempo de espera agotado para evidencia externa: ${source}`);
    this.name = "ExternalEvidenceTimeoutError";
  }
}

/**
 * Resuelve evidencia externa sin permitir que una integración secundaria bloquee
 * la decisión contractual del dashboard. La indisponibilidad conserva trazabilidad.
 */
export async function resolveExternalEvidence<T>(params: {
  source: string;
  load: () => Promise<T>;
  timeoutMs?: number;
  now?: () => Date;
}): Promise<ExternalEvidenceResult<T>> {
  const timeoutMs = params.timeoutMs ?? 4_500;
  const now = params.now ?? (() => new Date());
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => reject(new ExternalEvidenceTimeoutError(params.source)), timeoutMs);
    });
    const value = await Promise.race([Promise.resolve().then(params.load), timeout]);
    return { availability: "available", value, observedAt: now().toISOString(), reason: null };
  } catch (error) {
    const timedOut = error instanceof ExternalEvidenceTimeoutError;
    return {
      availability: timedOut ? "timed_out" : "unavailable",
      value: null,
      observedAt: null,
      reason: timedOut ? "timeout" : "source_error",
    };
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
