/**
 * JSM Setup es una COMPUERTA, no un tablero.
 *
 * La única pregunta de la página es «¿qué me falta para cerrar la etapa?».
 * El backend ya la responde: `calculateJsmSetupReadiness` (server/jsmRecurringSyncRunner.ts)
 * devuelve `readiness.blockers`, un arreglo de strings. Hoy la UI los une con
 * `.join(" ")` y los pinta en gris, al final de la página, junto al botón
 * deshabilitado.
 *
 * Este módulo convierte ese arreglo en una lista ordenada de pasos, cada uno
 * con su estado y su acción. NO inventa reglas nuevas: replica exactamente los
 * mismos predicados del servidor y, si por cualquier motivo la derivación local
 * y `readiness.canClose` no coinciden, lo marca en `serverMismatch` y manda a
 * la UI a mostrar los blockers crudos del servidor. El servidor siempre gana.
 */

import type { RouterOutputs } from "@/lib/trpc";

export type JsmIssuesSummary = RouterOutputs["recurringServices"]["getJiraIssuesSummary"];
export type JsmSyncConfiguration = RouterOutputs["recurringServices"]["getJsmSyncConfiguration"];

export type GateStepId =
  | "platform"
  | "client_url"
  | "space"
  | "mapping_work_plan"
  | "mapping_billing"
  | "sync";

/**
 * done    — resuelto, no requiere nada
 * warning — resuelto pero con una advertencia que conviene atender
 * current — el siguiente paso pendiente: es el único que se muestra expandido
 * pending — pendiente, pero todavía no es el turno
 * blocked — pendiente y bloqueado por un paso anterior
 */
export type GateStepState = "done" | "warning" | "current" | "pending" | "blocked";

export interface GateStep {
  id: GateStepId;
  /** 1-based, para el número que se pinta en el círculo. */
  order: number;
  title: string;
  detail: string;
  state: GateStepState;
  /** null cuando el paso no ofrece acción (ya está resuelto sin advertencias). */
  actionLabel: string | null;
  /** Texto pequeño bajo el control, cuando aporta. */
  hint: string | null;
}

export interface JsmSetupGate {
  steps: GateStep[];
  doneCount: number;
  totalCount: number;
  canClose: boolean;
  /** Los blockers del servidor, sin tocar. Es la fuente de verdad. */
  blockers: string[];
  /**
   * true cuando la derivación local dice algo distinto que `readiness.canClose`.
   * La UI entonces muestra los blockers crudos y no la checklist derivada: es
   * preferible una lista fea y correcta a una bonita que miente.
   */
  serverMismatch: boolean;
  linkedCount: number;
  totalLinkable: number;
  unsyncedCount: number;
  /** El primer paso no resuelto, para desplegarlo. null si no queda ninguno. */
  currentStepId: GateStepId | null;
}

export interface JsmSetupGateInput {
  platform: "prodigio" | "cliente" | null;
  clientPlatformUrl: string | null;
  projectKey: string | null;
  serviceDeskId: string | null;
  /** El vínculo al Space tiene salud vigente confirmada. */
  spaceHealthy: boolean;
  lastVerifiedAt: string | null;
  /** Categorías presentes en `syncConfig.mappings`. */
  mappingCategories: string[];
  totalWorkItems: number;
  totalBilling: number;
  totalSynced: number;
  totalUnsynced: number;
  /** `issuesSummary.readiness`, tal cual llega del servidor. */
  readiness: { canClose: boolean; blockers: string[] } | null;
  /** Hay un dry-run ejecutado y sin consumir. */
  hasDryRun: boolean;
}

export function buildJsmSetupGate(input: JsmSetupGateInput): JsmSetupGate {
  const blockers = input.readiness?.blockers ?? [];
  const serverCanClose = input.readiness?.canClose ?? false;

  const steps: GateStep[] =
    input.platform === "cliente" ? clientSteps(input) : prodigioSteps(input);

  // El primer paso que no está resuelto pasa a "current"; los siguientes
  // pendientes quedan "blocked" salvo que no dependan de él.
  let currentAssigned = false;
  for (const step of steps) {
    if (step.state === "done" || step.state === "warning") continue;
    if (!currentAssigned) {
      step.state = "current";
      currentAssigned = true;
    }
  }

  const doneCount = steps.filter(step => step.state === "done" || step.state === "warning").length;
  const localCanClose = doneCount === steps.length;

  return {
    steps,
    doneCount,
    totalCount: steps.length,
    canClose: serverCanClose,
    blockers,
    serverMismatch: input.readiness !== null && localCanClose !== serverCanClose,
    linkedCount: input.totalSynced,
    totalLinkable: input.totalWorkItems + input.totalBilling,
    unsyncedCount: input.totalUnsynced,
    currentStepId: steps.find(step => step.state === "current")?.id ?? null,
  };
}

/* ── Plataforma del cliente: un solo requisito, la URL ───────────────────── */

function clientSteps(input: JsmSetupGateInput): GateStep[] {
  const hasUrl = Boolean(input.clientPlatformUrl?.trim());
  return [
    {
      id: "platform",
      order: 1,
      title: "Plataforma elegida",
      detail: "Plataforma del cliente — el servicio se gestiona fuera de nuestro tenant.",
      state: "done",
      actionLabel: null,
      hint: null,
    },
    {
      id: "client_url",
      order: 2,
      title: "URL de la plataforma",
      detail: hasUrl
        ? (input.clientPlatformUrl as string)
        : "Registrar dónde el cliente atiende los tickets de este servicio.",
      state: hasUrl ? "done" : "pending",
      actionLabel: hasUrl ? null : "Registrar URL",
      hint: hasUrl ? null : "Es el único requisito para cerrar la etapa en esta modalidad.",
    },
  ];
}

/* ── Plataforma Prodigio: cinco pasos ────────────────────────────────────── */

function prodigioSteps(input: JsmSetupGateInput): GateStep[] {
  const hasSpace = Boolean(input.projectKey);
  const hasWorkPlanMapping = input.mappingCategories.includes("work_plan");
  const hasBillingMapping = input.mappingCategories.includes("billing");
  const workPlanRequired = input.totalWorkItems > 0;
  const billingRequired = input.totalBilling > 0;
  const bothMappingsReady =
    (!workPlanRequired || hasWorkPlanMapping) && (!billingRequired || hasBillingMapping);

  const steps: GateStep[] = [];

  steps.push({
    id: "platform",
    order: 1,
    title: "Plataforma elegida",
    detail: input.platform
      ? "Plataforma Prodigio (JSM) — el servicio se gestiona en nuestro tenant."
      : "Todavía no se elige dónde se gestionará el servicio.",
    state: input.platform ? "done" : "pending",
    actionLabel: input.platform ? null : "Elegir plataforma",
    hint: null,
  });

  steps.push({
    id: "space",
    order: 2,
    title: "Space JSM vinculado",
    detail: hasSpace
      ? spaceDetail(input)
      : "Crear un proyecto JSM o vincular un Service Desk existente.",
    state: hasSpace ? (input.spaceHealthy ? "done" : "warning") : "pending",
    actionLabel: hasSpace ? (input.spaceHealthy ? null : "Revisar vínculo") : "Vincular Space",
    hint: null,
  });

  steps.push({
    id: "mapping_work_plan",
    order: 3,
    title: "Mapping de plan de trabajo",
    detail: workPlanRequired
      ? "Qué tipo de issue del proyecto representa una actividad del plan."
      : "No hay actividades de plan de trabajo en este servicio.",
    state: !workPlanRequired ? "done" : hasWorkPlanMapping ? "done" : hasSpace ? "pending" : "blocked",
    actionLabel: workPlanRequired ? "Seleccionar tipo de issue" : null,
    hint: workPlanRequired
      ? `${input.totalWorkItems} actividad${input.totalWorkItems === 1 ? "" : "es"} espera${input.totalWorkItems === 1 ? "" : "n"} este mapping`
      : null,
  });

  steps.push({
    id: "mapping_billing",
    order: 4,
    title: "Mapping de facturación",
    detail: billingRequired
      ? "Qué tipo de issue representa un hito de cobro."
      : "No hay plan de cobro en este servicio.",
    state: !billingRequired ? "done" : hasBillingMapping ? "done" : hasSpace ? "pending" : "blocked",
    actionLabel: billingRequired ? "Seleccionar tipo de issue" : null,
    hint: billingRequired
      ? `${input.totalBilling} cuota${input.totalBilling === 1 ? "" : "s"} espera${input.totalBilling === 1 ? "" : "n"} este mapping`
      : null,
  });

  steps.push({
    id: "sync",
    order: 5,
    title:
      input.totalUnsynced > 0
        ? `Vincular ${input.totalUnsynced} elemento${input.totalUnsynced === 1 ? "" : "s"}`
        : "Vincular elementos a Jira",
    detail: syncDetail(input, bothMappingsReady),
    state: syncState(input, bothMappingsReady),
    actionLabel: syncAction(input, bothMappingsReady),
    hint: bothMappingsReady ? null : "Se habilita en cuanto los mappings estén guardados.",
  });

  return steps;
}

function spaceDetail(input: JsmSetupGateInput): string {
  const parts = [input.projectKey as string];
  if (input.serviceDeskId) parts.push(`Service Desk ${input.serviceDeskId}`);
  const base = parts.join(" · ");
  if (input.spaceHealthy) return base;
  return input.lastVerifiedAt
    ? `${base} — con advertencias, verificado el ${formatStamp(input.lastVerifiedAt)}.`
    : `${base} — el vínculo no tiene salud vigente confirmada.`;
}

function syncDetail(input: JsmSetupGateInput, bothMappingsReady: boolean): string {
  if (input.totalWorkItems + input.totalBilling === 0) {
    return "No existen elementos aplicables para sincronizar.";
  }
  if (input.totalUnsynced === 0) {
    return `Los ${input.totalSynced} elementos aplicables están vinculados a Jira.`;
  }
  if (!bothMappingsReady) return "Dry-run y confirmación, una vez guardados los mappings.";
  if (input.hasDryRun) return "Dry-run listo. Revisa el plan y confirma para crear los issues.";
  return "Ejecuta el dry-run para revisar qué se va a crear antes de crearlo.";
}

function syncState(input: JsmSetupGateInput, bothMappingsReady: boolean): GateStepState {
  if (input.totalWorkItems + input.totalBilling === 0) return "blocked";
  if (input.totalUnsynced === 0) return "done";
  if (!bothMappingsReady) return "blocked";
  return "pending";
}

function syncAction(input: JsmSetupGateInput, bothMappingsReady: boolean): string | null {
  if (input.totalUnsynced === 0) return null;
  if (!bothMappingsReady) return "Ejecutar dry-run";
  return input.hasDryRun ? "Confirmar sincronización" : "Ejecutar dry-run";
}

function formatStamp(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("es-CL");
}

/* ── Pendientes de vincular, agrupados y con su plata ─────────────────────── */

export interface PendingGroup {
  key: "actividad" | "facturacion";
  label: string;
  count: number;
  /** Etiqueta por moneda; nunca se suman monedas distintas. */
  amountLabel: string | null;
  items: Array<{ id: number; title: string; note: string | null; amountLabel: string | null }>;
}

export function buildPendingGroups(summary: JsmIssuesSummary | undefined): PendingGroup[] {
  if (!summary) return [];
  const groups: PendingGroup[] = [];

  if (summary.unsyncedWorkItems.length > 0) {
    groups.push({
      key: "actividad",
      label: "Actividades del plan de trabajo",
      count: summary.unsyncedWorkItems.length,
      amountLabel: null,
      items: summary.unsyncedWorkItems.map(item => ({
        id: item.id,
        title: item.title,
        note: [item.type, item.frequency].filter(Boolean).join(" · ") || null,
        amountLabel: null,
      })),
    });
  }

  if (summary.unsyncedBilling.length > 0) {
    const byCurrency = new Map<string, number>();
    for (const item of summary.unsyncedBilling) {
      const currency = (item.currency ?? "N/D").toUpperCase();
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + Number(item.amount ?? 0));
    }

    groups.push({
      key: "facturacion",
      label: "Hitos de facturación",
      count: summary.unsyncedBilling.length,
      // Una etiqueta por moneda, unidas con " + ". Nunca una suma entre monedas.
      amountLabel: Array.from(byCurrency.entries())
        .map(([currency, total]) => formatMoney(total, currency))
        .join(" + "),
      items: summary.unsyncedBilling.map(item => ({
        id: item.id,
        title: item.title,
        note: item.monthNumber !== null ? `Mes ${item.monthNumber}` : null,
        amountLabel: formatMoney(Number(item.amount ?? 0), (item.currency ?? "N/D").toUpperCase()),
      })),
    });
  }

  return groups;
}

export function formatMoney(value: number, currency: string): string {
  return `${currency} ${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(value)}`;
}
