/**
 * Detalle de un servicio recurrente, reordenado por decisión.
 *
 * Orden de bloques:
 *   1. Una sola cabecera (antes eran dos oscuras seguidas, casi una pantalla)
 *   2. Qué hacer con este servicio — las señales, accionables
 *   3. Pipeline de etapas — el único control que avanza el servicio
 *   4. Plan de cobro — ahora con la plata vencida a la vista
 *   5. Evidencia en pestañas — cobertura, calidad, financiero, entregables, SLA
 *
 * Lo que se va: la segunda cabecera oscura de «Vista 360°», sus cuatro KPIs
 * (duplicaban la Torre de Control) y la pestaña «Resumen», cuyo contenido subió
 * a los bloques 2 y bajó al 5.
 *
 * REQUISITO: el kit del dashboard aplicado (recurringDashboardV3ViewModel.ts y
 * components/EmptyDimension.tsx).
 */

import AppBreadcrumb from "@/components/AppBreadcrumb";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { RECURRING_SERVICE_TYPE_LABELS } from "@shared/recurringServiceTypes";

import { RECURRING_HEALTH_UI, formatCutOffDate, type RecurringHealthKey } from "./recurring/recurringDashboardV2ViewModel";
import { buildActionQueue } from "./recurring/recurringDashboardV3ViewModel";
import {
  SERVICE_STAGES,
  buildBillingPlan,
  buildDocumentRows,
  buildStagePipeline,
  formatDate,
  resolveServiceSignalStage,
} from "./recurring/serviceDetailViewModel";

import { BillingPlan } from "./recurring/components/BillingPlan";
import { ServiceEvidenceTabs } from "./recurring/components/ServiceEvidenceTabs";
import { ServiceSignals } from "./recurring/components/ServiceSignals";
import { StagePipeline } from "./recurring/components/StagePipeline";

const STATUS_LABELS: Record<string, string> = {
  activo: "Activo",
  pausado: "Pausado",
  completado: "Completado",
  cancelado: "Cancelado",
};

const STAGE_LABELS = Object.fromEntries(SERVICE_STAGES.map(stage => [stage.id, stage.label]));

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function RecurringServiceDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [cutOffDate] = useState(todayIso);

  const serviceQuery = trpc.recurringServices.getById.useQuery({ id }, { enabled: !!id });
  const { data, isLoading } = serviceQuery;
  const metrics = trpc.recurringServices.dashboardV2.useQuery(
    { serviceId: id, cutOffDate },
    { enabled: !!id, staleTime: 30_000 },
  );

  const svc = data?.service;

  const pipeline = useMemo(() => buildStagePipeline(data?.stages ?? []), [data?.stages]);
  const documents = useMemo(() => buildDocumentRows(data?.documents ?? []), [data?.documents]);
  const billingPlan = useMemo(
    () =>
      buildBillingPlan(
        data?.billingMonths ?? [],
        cutOffDate,
        svc?.totalContractAmount && svc?.currency
          ? { amount: Number(svc.totalContractAmount), currency: svc.currency }
          : null,
      ),
    [data?.billingMonths, cutOffDate, svc?.totalContractAmount, svc?.currency],
  );

  const serviceMetrics = metrics.data?.matrix[0] ?? null;
  const signals = useMemo(
    () => (serviceMetrics ? buildActionQueue([serviceMetrics], { stageLabels: STAGE_LABELS }) : []),
    [serviceMetrics],
  );

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <Loader2 size={32} className="animate-spin text-[#E91E8C]" />
      </div>
    );
  }

  if (!data || !svc) {
    return (
      <div className="py-16 text-center">
        <XCircle size={44} className="mx-auto text-[#B42318]" />
        <h3 className="mt-4 text-base font-bold text-slate-950">Servicio no encontrado</h3>
        <Button variant="outline" onClick={() => navigate("/recurring-services")} className="mt-4">
          <ArrowLeft size={16} className="mr-1" /> Volver
        </Button>
      </div>
    );
  }

  const health = serviceMetrics ? RECURRING_HEALTH_UI[serviceMetrics.health as RecurringHealthKey] : null;
  const serviceTypeLabel =
    RECURRING_SERVICE_TYPE_LABELS[svc.serviceType as keyof typeof RECURRING_SERVICE_TYPE_LABELS] ?? svc.serviceType;
  const canManage = user?.role === "admin" || user?.role === "pmo";
  const refreshAll = () => Promise.all([serviceQuery.refetch(), metrics.refetch()]);

  return (
    <div className="space-y-4 pb-8">
      <AppBreadcrumb
        segments={[{ label: "Servicios Recurrentes", href: "/recurring-services" }, { label: svc.serviceName }]}
      />

      {/* 1 · Una sola cabecera */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span
          className="absolute left-0 top-0 h-full w-[5px]"
          style={{ background: health ? health.tone : "#E91E8C" }}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {health && (
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider"
                  style={{ color: health.tone, background: health.surface, borderColor: health.border }}
                >
                  {health.label}
                </span>
              )}
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-200">
                {STATUS_LABELS[svc.status] ?? svc.status}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-200">
                {serviceTypeLabel}
              </span>
              {metrics.data && (
                <span className="text-[11px] text-slate-400">Corte {formatCutOffDate(metrics.data.metadata.cutOffDate)}</span>
              )}
            </div>

            <h1 className="mt-2 text-2xl font-black tracking-[-0.02em] sm:text-[25px]">{svc.serviceName}</h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span>{svc.clientName}</span>
              <Dot />
              <span>Deal {svc.dealId ?? "N/D"}</span>
              <Dot />
              <span>
                {svc.durationMonths} meses ·{" "}
                <b className="font-mono text-white">
                  {svc.currency} {svc.totalContractAmount ? Number(svc.totalContractAmount).toLocaleString("es-CL") : "—"}
                </b>
                {svc.billingType === "cuota_fija" && svc.fixedMonthlyAmount
                  ? ` · ${svc.currency} ${Number(svc.fixedMonthlyAmount).toLocaleString("es-CL")}/mes`
                  : " · cuotas variables"}
              </span>
              <Dot />
              <span>
                {formatDate(svc.formalStartDate)} → {formatDate(svc.endDate)}
              </span>
              {pipeline.activeStage && (
                <>
                  <Dot />
                  <span>
                    Etapa {pipeline.activeIndex + 1} de {pipeline.stages.length} · {pipeline.activeStage.label}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={refreshAll}
              disabled={serviceQuery.isFetching || metrics.isFetching}
              className="h-9 border-white/20 bg-white/[0.07] text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCw
                size={15}
                className={serviceQuery.isFetching || metrics.isFetching ? "mr-2 animate-spin" : "mr-2"}
              />
              Actualizar lectura
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/recurring-services/${id}/init`)}
              className="h-9 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              {canManage ? "Editar configuración" : "Ver configuración"}
            </Button>
          </div>
        </div>
      </section>

      {/* 2 · Qué hacer con este servicio */}
      {metrics.isLoading ? (
        <section className="grid min-h-[110px] place-items-center rounded-2xl border border-slate-200 bg-white">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600">
            <Loader2 size={16} className="animate-spin" /> Leyendo señales del servicio…
          </p>
        </section>
      ) : metrics.error ? (
        <section className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[#B42318]" />
            <div className="min-w-0 flex-grow">
              <p className="text-sm font-black text-red-950">No fue posible cargar las métricas del servicio</p>
              <p className="mt-1 text-xs leading-5 text-red-800">{metrics.error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => metrics.refetch()} disabled={metrics.isFetching}>
              Reintentar
            </Button>
          </div>
        </section>
      ) : serviceMetrics ? (
        <ServiceSignals
          items={signals}
          onAction={item => navigate(`/recurring-services/${id}/${resolveServiceSignalStage(item)}`)}
        />
      ) : (
        <section className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <p className="text-[12.5px] text-slate-700">
            Este servicio no forma parte del universo medible para la fecha de corte, así que no hay señales que mostrar.
          </p>
        </section>
      )}

      {/* 3 · Pipeline de etapas */}
      <StagePipeline
        pipeline={pipeline}
        onOpenStage={stage => navigate(`/recurring-services/${id}/${stage.path}`)}
      />

      {/* 4 · Plan de cobro */}
      <BillingPlan plan={billingPlan} onRowAction={() => navigate(`/recurring-services/${id}/execution`)} />

      {/* 5 · Evidencia */}
      {metrics.data && serviceMetrics && (
        <ServiceEvidenceTabs
          data={metrics.data}
          service={serviceMetrics}
          documents={documents}
          onRevalidateJsm={() => navigate(`/recurring-services/${id}/jsm-setup`)}
          onOpenInitialization={() => navigate(`/recurring-services/${id}/init`)}
          onOpenWorkPlan={() => navigate(`/recurring-services/${id}/work-plan`)}
        />
      )}
    </div>
  );
}

function Dot() {
  return <i className="block h-[3px] w-[3px] rounded-full bg-slate-500" aria-hidden="true" />;
}
