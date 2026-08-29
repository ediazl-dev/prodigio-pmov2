import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  FolderSync,
  Landmark,
  ListChecks,
  Loader2,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

type HomologationException = {
  id: number;
  domain: string;
  sourceKey: string | null;
  reason: string;
};

export type JiraHomologationStatus = {
  project: { dealId: string | null };
  onboarding: { status: string; jiraProjectKey: string } | null;
  latestRun: { status: string; completedAt: Date | string | null; createdAt: Date | string } | null;
  counts: {
    risks: { imported: number; mapped: number };
    wbs: { imported: number; mapped: number };
    documents: { sow: number; gantt: number; milestoneAcceptances: number };
    openExceptions: number;
  };
  exceptions: HomologationException[];
  pending: string[];
};

const DOMAIN_LABELS: Record<string, string> = {
  risks: "Riesgos",
  planning: "Backlog",
  documents: "Documentos",
  finance: "Finanzas",
};

function formatRunDate(value: Date | string | null | undefined) {
  if (!value) return "[PENDIENTE]";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "[PENDIENTE]" : date.toLocaleString("es-CL");
}

function CountTile({ icon: Icon, label, value, detail }: {
  icon: typeof ShieldAlert;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-[10px] font-bold uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="mt-2 text-lg font-extrabold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

export function JiraHomologationStatusCardBody({
  status,
  canImport,
  isImporting = false,
  onImport,
}: {
  status: JiraHomologationStatus;
  canImport: boolean;
  isImporting?: boolean;
  onImport?: () => void;
}) {
  const onboardingReady = status.onboarding?.status === "ready";
  const importedAt = status.latestRun?.completedAt ?? status.latestRun?.createdAt;
  const hasPending = status.pending.length > 0 || status.counts.openExceptions > 0;

  return (
    <section className="mb-5 rounded-[14px] border border-slate-200 bg-white p-5 shadow-[0_2px_16px_rgba(10,22,40,0.08)]" aria-labelledby="jira-homologation-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FolderSync className="h-5 w-5 text-[#e91e8c]" aria-hidden="true" />
            <h2 id="jira-homologation-title" className="text-sm font-extrabold text-slate-800">Homologación Jira → Prodigio</h2>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${onboardingReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {onboardingReady ? "ONBOARDING LISTO" : "ONBOARDING [PENDIENTE]"}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-slate-500">
            La importación usa el snapshot y los mappings aprobados. Es idempotente, no elimina información PMO y no escribe en Jira.
          </p>
        </div>
        {canImport ? (
          <Button
            size="sm"
            onClick={onImport}
            disabled={!onboardingReady || isImporting}
            className="bg-[#e91e8c] text-white hover:bg-[#c51678] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:opacity-100"
          >
            {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="mr-2 h-4 w-4" aria-hidden="true" />}
            {isImporting ? "Importando…" : "Importar dominios aprobados"}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CountTile icon={Landmark} label="Deal financiero" value={status.project.dealId || "[POR CONFIRMAR]"} detail="Coincidencia exacta en datos financieros" />
        <CountTile icon={ShieldAlert} label="Riesgos Jira" value={`${status.counts.risks.imported}/${status.counts.risks.mapped}`} detail="Importados / mappings aprobados" />
        <CountTile icon={ListChecks} label="WBS canónico" value={`${status.counts.wbs.imported}/${status.counts.wbs.mapped}`} detail="Importados / mappings aprobados" />
        <CountTile icon={FileCheck2} label="Evidencia real" value={`${status.counts.documents.sow + status.counts.documents.gantt + status.counts.documents.milestoneAcceptances}`} detail={`${status.counts.documents.sow} SoW · ${status.counts.documents.gantt} Gantt · ${status.counts.documents.milestoneAcceptances} actas`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-600">
        <span><strong>Última corrida H6:</strong> {formatRunDate(importedAt)}</span>
        <span className={`inline-flex items-center gap-1 font-bold ${hasPending ? "text-amber-700" : "text-emerald-700"}`}>
          {hasPending ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
          {hasPending ? `${status.counts.openExceptions} excepciones abiertas` : "Sin excepciones abiertas"}
        </span>
      </div>

      {status.pending.length > 0 ? (
        <div className="mt-4">
          <h3 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-700">Faltantes explícitos</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {status.pending.map(item => <span key={item} className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">{item}</span>)}
          </div>
        </div>
      ) : null}

      {status.exceptions.length > 0 ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[110px_120px_1fr] gap-3 bg-slate-100 px-3 py-2 text-[9px] font-extrabold uppercase tracking-[0.08em] text-slate-600">
            <span>Dominio</span><span>Origen</span><span>Motivo resoluble</span>
          </div>
          {status.exceptions.slice(0, 8).map(exception => (
            <div key={exception.id} className="grid grid-cols-[110px_120px_1fr] gap-3 border-t border-slate-100 px-3 py-2 text-[10px] text-slate-700">
              <span className="font-bold">{DOMAIN_LABELS[exception.domain] ?? exception.domain}</span>
              <span className="truncate font-mono text-slate-500" title={exception.sourceKey ?? undefined}>{exception.sourceKey || "[POR CONFIRMAR]"}</span>
              <span>{exception.reason}</span>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 text-[10px] leading-relaxed text-slate-500">
        SoW y Gantt se almacenan como documentos del proyecto. Las actas permanecen asociadas a su hito contractual; un cierre Jira no equivale a aceptación del cliente.
      </p>
    </section>
  );
}

export function JiraHomologationStatusCard({ projectId, canImport }: { projectId: number; canImport: boolean }) {
  const utils = trpc.useUtils();
  const statusQuery = trpc.jira.getExistingProjectImportStatus.useQuery({ projectId });
  const importMutation = trpc.jira.importExistingProjectDomains.useMutation({
    onSuccess: async result => {
      toast.success(result.reused ? "La importación H6 ya estaba aplicada para este snapshot." : "Dominios Jira importados y trazabilidad actualizada.");
      await statusQuery.refetch();
      await utils.projects.get.invalidate({ id: projectId });
    },
    onError: error => toast.error(error.message),
  });

  if (statusQuery.isLoading) {
    return <div className="mb-5 h-44 animate-pulse rounded-[14px] border border-slate-200 bg-white" aria-label="Cargando estado de homologación Jira" />;
  }
  if (statusQuery.error) {
    return (
      <div className="mb-5 rounded-[14px] border border-red-200 bg-red-50 p-4 text-xs text-red-800">
        No fue posible leer el estado de homologación: {statusQuery.error.message}
      </div>
    );
  }
  if (!statusQuery.data) return null;

  return (
    <JiraHomologationStatusCardBody
      status={statusQuery.data as JiraHomologationStatus}
      canImport={canImport}
      isImporting={importMutation.isPending}
      onImport={() => importMutation.mutate({ projectId })}
    />
  );
}
