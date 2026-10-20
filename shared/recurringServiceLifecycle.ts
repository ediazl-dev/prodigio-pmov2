/** Closed lifecycle is immutable; it does not prove delivery, acceptance or invoicing. */
export function isRecurringServiceClosed(status: unknown): boolean {
  return status === "completado" || status === "cancelado";
}
export const RECURRING_SERVICE_CLOSED_MESSAGE = "Servicio cerrado: sólo consulta. No se permiten modificaciones ni sincronizaciones operativas.";
