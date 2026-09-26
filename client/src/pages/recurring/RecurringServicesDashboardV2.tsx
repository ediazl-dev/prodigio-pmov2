/**
 * Torre de Control V2 — reordenada por decisión.
 *
 * Esta página REEMPLAZA en sitio a la versión anterior: misma ruta, mismo
 * toggle Torre V2 / Clásico / Lista, mismo endpoint. No cambia el backend.
 *
 * Orden de bloques (de arriba a abajo):
 *   1. DecisionHeader   — contexto, cifras de primer orden, confianza
 *   2. ActionQueue      — un hallazgo por fila, lo que hay que hacer hoy
 *   3. PortfolioTable   — la cartera (antes "Matriz priorizada", antes al pie)
 *   4. SystemHealthStrip— telemetría del ETL, colapsada
 *
 * El consolidado Financiero / Entregables / Formalidad / Operación JSM vive
 * exclusivamente en la vista Clásico, que es la superficie gerencial.
 *
 * Reglas que no se negocian:
 *   - N/D nunca se sustituye por 0 ni por un supuesto.
 *   - Nunca se suman monedas distintas.
 *   - Una dimensión sin evidencia se colapsa a una línea con su acción.
 */

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { countActiveFilters, type RecurringHealthKey } from "./recurringDashboardV2ViewModel";
import {
  buildActionQueue,
  buildConfidence,
  buildDecisionMetrics,
  buildPortfolioRows,
} from "./recurringDashboardV3ViewModel";

import { ActionQueue } from "./components/ActionQueue";
import { DecisionHeader } from "./components/DecisionHeader";
import { PortfolioTable } from "./components/PortfolioTable";
import { SystemHealthStrip } from "./components/SystemHealthStrip";

const STAGE_LABELS: Record<string, string> = {
  inicializacion: "Inicialización",
  plan_trabajo: "Plan de trabajo",
  jira_setup: "JSM Setup",
  ejecucion: "Ejecución",
  cierre: "Cierre",
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecurringServicesDashboardV2() {
  const { user } = useAuth();

  const [cutOffDate, setCutOffDate] = useState(todayIso);
  const [clientName, setClientName] = useState("all");
  const [status, setStatus] = useState("all");
  const [serviceType, setServiceType] = useState("all");
  const [health, setHealth] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [search, setSearch] = useState("");

  const [onlyCritical, setOnlyCritical] = useState(false);
  const filters = useMemo(
    () => ({ cutOffDate, clientName, status, serviceType, health, currency, search }),
    [cutOffDate, clientName, status, serviceType, health, currency, search],
  );

  const input = useMemo(
    () => ({
      cutOffDate,
      ...(clientName !== "all" ? { clientName } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(serviceType !== "all" ? { serviceType } : {}),
      ...(health !== "all" ? { health } : {}),
      ...(currency !== "all" ? { currency } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [cutOffDate, clientName, status, serviceType, health, currency, search],
  );

  const { data, isLoading, error, refetch, isFetching } = trpc.recurringServices.dashboardV2.useQuery(input as any, {
    staleTime: 30_000,
  });

  const historyInput = useMemo(() => ({ page: 1, limit: 5 }), []);
  const {
    data: jsmRefreshHistory,
    isLoading: isLoadingJsmHistory,
    error: jsmHistoryError,
    refetch: refetchJsmHistory,
  } = trpc.recurringServices.jsmRefreshHistory.useQuery(historyInput, { staleTime: 30_000 });

  const refreshJsmSnapshots = trpc.recurringServices.refreshJsmSnapshots.useMutation({
    onSuccess: async result => {
      if (result.eligibleCount === 0) {
        toast.info("No hay servicios activos con un vínculo JSM confirmado.");
      } else if (result.errorCount > 0) {
        toast.warning(`JSM actualizado con ${result.errorCount} servicio(s) en error.`);
      } else if (result.partialCount > 0) {
        toast.warning(`JSM actualizado con ${result.partialCount} servicio(s) con cobertura parcial.`);
      } else {
        toast.success(`${result.successCount} servicio(s) actualizado(s) desde JSM.`);
      }
      await Promise.all([refetch(), refetchJsmHistory()]);
    },
    onError: mutationError => toast.error(mutationError.message || "No fue posible actualizar JSM."),
  });

  const canRefreshJsm = user?.role === "admin" || user?.role === "pmo";

  const clearFilters = () => {
    setClientName("all");
    setStatus("all");
    setServiceType("all");
    setHealth("all");
    setCurrency("all");
    setSearch("");
  };

  /* ── Estados de carga y error, iguales a los actuales ────────────────── */

  if (isLoading) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <RefreshCw className="mx-auto animate-spin text-[#E91E8C]" size={28} />
          <p className="mt-3 text-sm font-semibold text-slate-600">Construyendo la vista consolidada…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> No fue posible cargar la Torre de Control
        </div>
        <p className="mt-2 text-sm">{error?.message ?? "La respuesta consolidada no está disponible."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  /* ── View models ─────────────────────────────────────────────────────── */

  const { kpis, metadata, filterOptions, matrix, evidenceInventory } = data;

  const queueAll = buildActionQueue(matrix, { stageLabels: STAGE_LABELS });
  const queue = onlyCritical ? queueAll.filter(item => item.level === "critical") : queueAll;

  const decisionMetrics = buildDecisionMetrics(data);
  const confidence = buildConfidence(data);
  const portfolioRows = buildPortfolioRows(matrix);
  const requiresAttention = kpis.healthCounts.critical + kpis.healthCounts.attention;
  const activeFilterCount = countActiveFilters(filters);
  const visibleLabel = `${metadata.totalAfterFilters} de ${metadata.totalBeforeFilters} servicios visibles`;

  return (
    <div className="space-y-4 pb-8">
      <DecisionHeader
        requiresAttention={requiresAttention}
        totalServices={kpis.totalServices}
        cutOffDate={cutOffDate}
        onCutOffDateChange={setCutOffDate}
        healthCounts={kpis.healthCounts as Record<RecurringHealthKey, number>}
        health={health}
        onHealthChange={setHealth}
        visibleLabel={visibleLabel}
        contractVersion={metadata.contractVersion}
        metrics={decisionMetrics}
        confidence={confidence}
        isFetching={isFetching}
        onRefetch={() => refetch()}
        canRefreshJsm={canRefreshJsm}
        isRefreshingJsm={refreshJsmSnapshots.isPending}
        onRefreshJsm={() => refreshJsmSnapshots.mutate({})}
      />

      <ActionQueue
        items={queue}
        totalFindings={queueAll.length}
        onlyCritical={onlyCritical}
        onToggleOnlyCritical={() => setOnlyCritical(value => !value)}
      />

      <PortfolioTable
        rows={portfolioRows}
        visibleLabel={visibleLabel}
        search={search}
        onSearchChange={setSearch}
        clientName={clientName}
        onClientChange={setClientName}
        serviceType={serviceType}
        onServiceTypeChange={setServiceType}
        status={status}
        onStatusChange={setStatus}
        currency={currency}
        onCurrencyChange={setCurrency}
        filterOptions={filterOptions}
        onClearFilters={clearFilters}
        activeFilterCount={activeFilterCount}
      />

      <SystemHealthStrip
        metadata={metadata}
        evidenceInventory={evidenceInventory}
        runs={jsmRefreshHistory?.runs ?? []}
        isLoadingRuns={isLoadingJsmHistory}
        runsError={jsmHistoryError?.message ?? null}
        onRetryRuns={() => refetchJsmHistory()}
      />
    </div>
  );
}
