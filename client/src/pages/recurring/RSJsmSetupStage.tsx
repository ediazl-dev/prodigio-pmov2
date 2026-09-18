import { useAuth } from "@/_core/hooks/useAuth";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Settings,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { JsmGateChecklist } from "./components/JsmGateChecklist";
import { JsmLinkedItems } from "./components/JsmLinkedItems";
import { JsmPendingItems } from "./components/JsmPendingItems";
import {
  buildJsmSetupGate,
  buildPendingGroups,
  type GateStep,
  type JsmSyncConfiguration,
} from "./jsmSetupGate";
import { RSExistingJsmLinkPanel } from "./RSExistingJsmLinkPanel";
import { canManageExistingJsmSpace } from "./jsmExistingSpaceUi";

type DryRunResult = RouterOutputs["recurringServices"]["dryRunJsmSync"];

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

export default function RSJsmSetupStage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const { user } = useAuth();
  const canManage = canManageExistingJsmSpace(user?.role);
  const spaceDetailsRef = useRef<HTMLDetailsElement>(null);

  const serviceQuery = trpc.recurringServices.getById.useQuery({ id }, { enabled: Boolean(id) });
  const stagesQuery = trpc.recurringServices.getStages.useQuery({ serviceId: id }, { enabled: Boolean(id) });
  const svc = serviceQuery.data?.service;
  const stage = stagesQuery.data?.find(item => item.stageId === "jira_setup");
  const isActive = stage?.status === "in_progress";
  const isCompleted = stage?.status === "completed";

  const issuesQuery = trpc.recurringServices.getJiraIssuesSummary.useQuery(
    { serviceId: id },
    { enabled: Boolean(id && svc) },
  );
  const linkStateQuery = trpc.recurringServices.getExistingJsmLinkState.useQuery(
    { serviceId: id, limit: 10 },
    { enabled: Boolean(id && svc?.jsmPlatform === "prodigio") },
  );
  const syncConfigQuery = trpc.recurringServices.getJsmSyncConfiguration.useQuery(
    { serviceId: id, limit: 10 },
    { enabled: Boolean(id && svc?.jsmProjectKey && svc?.jsmProjectId) },
  );

  const issuesSummary = issuesQuery.data;
  const syncConfig = syncConfigQuery.data;
  const link = linkStateQuery.data?.link;

  const [platform, setPlatform] = useState<"prodigio" | "cliente">("prodigio");
  const [clientUrl, setClientUrl] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [spaceName, setSpaceName] = useState("");
  const [spaceKey, setSpaceKey] = useState("");
  const [workPlanIssueTypeId, setWorkPlanIssueTypeId] = useState("");
  const [billingIssueTypeId, setBillingIssueTypeId] = useState("");
  const [dryRunResult, setDryRunResult] = useState<DryRunResult | null>(null);
  const [spaceManagementOpen, setSpaceManagementOpen] = useState(false);

  useEffect(() => {
    if (!svc) return;
    if (svc.jsmPlatform) setPlatform(svc.jsmPlatform);
    if (svc.jsmClientPlatformUrl) setClientUrl(svc.jsmClientPlatformUrl);
  }, [svc?.jsmPlatform, svc?.jsmClientPlatformUrl]);

  useEffect(() => {
    if (!syncConfig?.mappings) return;
    setWorkPlanIssueTypeId(
      syncConfig.mappings.find(mapping => mapping.category === "work_plan")?.issueTypeId ?? "",
    );
    setBillingIssueTypeId(
      syncConfig.mappings.find(mapping => mapping.category === "billing")?.issueTypeId ?? "",
    );
  }, [syncConfig?.mappings]);

  useEffect(() => {
    if (svc?.jsmPlatform === "prodigio" && (link?.health ?? svc.jsmLinkHealth) !== "healthy") {
      setSpaceManagementOpen(true);
    }
  }, [link?.health, svc?.jsmLinkHealth, svc?.jsmPlatform]);

  const setPlatformMutation = trpc.recurringServices.setPlatformChoice.useMutation({
    onSuccess: async () => {
      toast.success("Plataforma configurada");
      await Promise.all([
        utils.recurringServices.getById.invalidate({ id }),
        utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId: id }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const createJsmMutation = trpc.recurringServices.createJsmProject.useMutation({
    onSuccess: async result => {
      if (result.success && result.created) {
        toast.success(`Proyecto JSM creado: ${result.jiraProjectKey}`);
        setShowCreateDialog(false);
        setSpaceName("");
        setSpaceKey("");
      } else {
        toast.error(result.error ?? "Error al crear proyecto");
      }
      await Promise.all([
        utils.recurringServices.getById.invalidate({ id }),
        utils.recurringServices.getExistingJsmLinkState.invalidate({ serviceId: id, limit: 10 }),
        utils.recurringServices.listExistingJsmSpaces.invalidate(),
        utils.recurringServices.getJsmSyncConfiguration.invalidate({ serviceId: id, limit: 10 }),
        utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId: id }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const saveMappingsMutation = trpc.recurringServices.saveJsmIssueTypeMappings.useMutation({
    onSuccess: async () => {
      toast.success("Mappings de tipos de issue guardados");
      setDryRunResult(null);
      await Promise.all([
        utils.recurringServices.getJsmSyncConfiguration.invalidate({ serviceId: id, limit: 10 }),
        utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId: id }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const dryRunMutation = trpc.recurringServices.dryRunJsmSync.useMutation({
    onSuccess: result => {
      setDryRunResult(result);
      toast[result.plan.canSync ? "success" : "error"](
        result.plan.canSync
          ? `Dry-run listo: ${result.plan.counts.toCreate} issues por crear`
          : `Dry-run bloqueado: ${result.plan.counts.blocked} elementos requieren atención`,
      );
      utils.recurringServices.getJsmSyncConfiguration.invalidate({ serviceId: id, limit: 10 });
    },
    onError: error => toast.error(error.message),
  });

  const confirmSyncMutation = trpc.recurringServices.confirmJsmSync.useMutation({
    onSuccess: async result => {
      const created = result.results.filter(item => item.status === "created").length;
      const errors = result.results.filter(item => item.status === "error" || item.status === "blocked").length;
      toast[errors > 0 ? "error" : "success"](
        `Sincronización ${result.status}: ${created} creados, ${errors} con observaciones`,
      );
      setDryRunResult(null);
      await Promise.all([
        utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId: id }),
        utils.recurringServices.getJsmSyncConfiguration.invalidate({ serviceId: id, limit: 10 }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const closeMutation = trpc.recurringServices.closeJiraSetupStage.useMutation({
    onSuccess: async () => {
      toast.success("Etapa cerrada");
      await Promise.all([
        utils.recurringServices.getById.invalidate({ id }),
        utils.recurringServices.getStages.invalidate({ serviceId: id }),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const gate = useMemo(
    () =>
      buildJsmSetupGate({
        platform: svc?.jsmPlatform ?? null,
        clientPlatformUrl: svc?.jsmClientPlatformUrl ?? null,
        projectKey: link?.projectKey ?? svc?.jsmProjectKey ?? null,
        serviceDeskId: link?.serviceDeskId ?? svc?.jsmServiceDeskId ?? null,
        spaceHealthy: (link?.health ?? svc?.jsmLinkHealth) === "healthy",
        lastVerifiedAt: toIsoString(link?.lastVerifiedAt ?? svc?.jsmLastVerifiedAt),
        mappingCategories: syncConfig?.mappings.map(mapping => mapping.category) ?? [],
        totalWorkItems: issuesSummary?.totalWorkItems ?? 0,
        totalBilling: issuesSummary?.totalBilling ?? 0,
        totalSynced: issuesSummary?.totalSynced ?? 0,
        totalUnsynced: issuesSummary?.totalUnsynced ?? 0,
        readiness: issuesSummary?.readiness ?? null,
        hasDryRun: dryRunResult?.status === "ready" && dryRunResult.plan.canSync,
      }),
    [
      dryRunResult,
      issuesSummary,
      link?.health,
      link?.lastVerifiedAt,
      link?.projectKey,
      link?.serviceDeskId,
      svc?.jsmClientPlatformUrl,
      svc?.jsmLastVerifiedAt,
      svc?.jsmLinkHealth,
      svc?.jsmPlatform,
      svc?.jsmProjectKey,
      svc?.jsmServiceDeskId,
      syncConfig?.mappings,
    ],
  );
  const pendingGroups = useMemo(() => buildPendingGroups(issuesSummary), [issuesSummary]);
  const jiraBaseUrl = svc?.jsmPortalUrl?.replace(/\/servicedesk.*/, "") || "https://apiservice2.atlassian.net";

  if (!svc) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        {serviceQuery.error ? (
          <div className="text-center">
            <AlertCircle size={36} className="mx-auto text-[#B42318]" />
            <p className="mt-3 text-sm font-bold text-slate-900">No fue posible cargar el servicio</p>
            <p className="mt-1 text-xs text-slate-600">{serviceQuery.error.message}</p>
            <Button variant="outline" className="mt-4" onClick={() => serviceQuery.refetch()}>
              Reintentar
            </Button>
          </div>
        ) : (
          <Loader2 size={32} className="animate-spin text-[#E91E8C]" />
        )}
      </div>
    );
  }

  const renderPlatformControl = () => {
    if (!canManage || !isActive) {
      return <p className="text-xs text-slate-600">Solo Admin o PMO puede configurar la plataforma mientras la etapa está en curso.</p>;
    }
    const needsChoice = !svc.jsmPlatform;
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        {needsChoice && (
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPlatform("prodigio")}
              aria-pressed={platform === "prodigio"}
              className={`rounded-xl border-2 p-4 text-left ${platform === "prodigio" ? "border-[#3B8EE8] bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <b className="text-sm text-slate-950">Prodigio JSM</b>
              <p className="mt-1 text-xs text-slate-600">Crear o vincular un Service Desk en el tenant de Prodigio.</p>
            </button>
            <button
              type="button"
              onClick={() => setPlatform("cliente")}
              aria-pressed={platform === "cliente"}
              className={`rounded-xl border-2 p-4 text-left ${platform === "cliente" ? "border-[#3B8EE8] bg-blue-50" : "border-slate-200 bg-white"}`}
            >
              <b className="text-sm text-slate-950">Plataforma del cliente</b>
              <p className="mt-1 text-xs text-slate-600">Registrar la plataforma externa donde el cliente gestiona sus tickets.</p>
            </button>
          </div>
        )}
        {platform === "cliente" && (
          <div>
            <Label htmlFor="jsm-client-url">URL de la plataforma del cliente</Label>
            <Input
              id="jsm-client-url"
              value={clientUrl}
              onChange={event => setClientUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1 bg-white"
            />
          </div>
        )}
        <Button
          onClick={() =>
            setPlatformMutation.mutate({
              serviceId: id,
              platform,
              clientPlatformUrl: platform === "cliente" ? clientUrl.trim() : undefined,
            })
          }
          disabled={setPlatformMutation.isPending || (platform === "cliente" && !clientUrl.trim())}
          className="bg-[#175CD3] text-white hover:bg-[#1849A9]"
        >
          {setPlatformMutation.isPending && <Loader2 size={15} className="mr-2 animate-spin" />}
          {needsChoice ? "Confirmar plataforma" : "Guardar URL"}
        </Button>
      </div>
    );
  };

  const renderMappingsControl = () => {
    if (syncConfigQuery.isLoading) {
      return <InlineLoading text="Consultando tipos de issue en Jira/JSM…" />;
    }
    if (syncConfigQuery.error) {
      return (
        <InlineError
          title="No fue posible cargar la configuración JSM"
          message={syncConfigQuery.error.message}
          onRetry={() => syncConfigQuery.refetch()}
        />
      );
    }
    if (!syncConfig) return <p className="text-xs text-slate-600">La configuración JSM aún no está disponible.</p>;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <IssueTypeSelect
            label="Tipo de issue para Plan de Trabajo"
            value={workPlanIssueTypeId}
            issueTypes={syncConfig.issueTypes}
            disabled={!isActive || !canManage}
            onChange={value => {
              setWorkPlanIssueTypeId(value);
              setDryRunResult(null);
            }}
          />
          <IssueTypeSelect
            label="Tipo de issue para Facturación"
            value={billingIssueTypeId}
            issueTypes={syncConfig.issueTypes}
            disabled={!isActive || !canManage}
            onChange={value => {
              setBillingIssueTypeId(value);
              setDryRunResult(null);
            }}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="mt-3 bg-white"
          onClick={() =>
            saveMappingsMutation.mutate({
              serviceId: id,
              mappings: [
                { category: "work_plan", issueTypeId: workPlanIssueTypeId },
                { category: "billing", issueTypeId: billingIssueTypeId },
              ],
            })
          }
          disabled={
            !isActive ||
            !canManage ||
            saveMappingsMutation.isPending ||
            !workPlanIssueTypeId ||
            !billingIssueTypeId
          }
        >
          {saveMappingsMutation.isPending ? (
            <Loader2 size={14} className="mr-2 animate-spin" />
          ) : (
            <Settings size={14} className="mr-2" />
          )}
          Guardar mappings
        </Button>
      </div>
    );
  };

  const renderSyncControl = () => {
    if (syncConfigQuery.isLoading) return <InlineLoading text="Consultando configuración de sincronización…" />;
    if (syncConfigQuery.error) {
      return (
        <InlineError
          title="No fue posible preparar la sincronización"
          message={syncConfigQuery.error.message}
          onRetry={() => syncConfigQuery.refetch()}
        />
      );
    }
    const canDryRun = Boolean(syncConfig?.mappings.length);
    const dryRunReady = dryRunResult?.status === "ready" && dryRunResult.plan.canSync;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="text-xs leading-5 text-slate-700">
          El dry-run no crea issues. La creación sólo ocurre después de una confirmación explícita.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => dryRunMutation.mutate({ serviceId: id })}
            disabled={!isActive || !canManage || dryRunMutation.isPending || !canDryRun}
            className="bg-[#175CD3] text-white hover:bg-[#1849A9]"
          >
            {dryRunMutation.isPending ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <RefreshCw size={14} className="mr-2" />
            )}
            Ejecutar dry-run
          </Button>
          {dryRunReady && (
            <Button
              size="sm"
              onClick={() =>
                confirmSyncMutation.mutate({ serviceId: id, dryRunId: dryRunResult.runId })
              }
              disabled={confirmSyncMutation.isPending || !isActive || !canManage}
              className="bg-[#067647] text-white hover:bg-[#05603A]"
            >
              {confirmSyncMutation.isPending ? (
                <Loader2 size={14} className="mr-2 animate-spin" />
              ) : (
                <Upload size={14} className="mr-2" />
              )}
              Confirmar creación de {dryRunResult.plan.counts.toCreate} issues
            </Button>
          )}
        </div>
        {dryRunResult?.plan && <DryRunSummary result={dryRunResult} />}
      </div>
    );
  };

  const renderGateControl = (step: GateStep) => {
    if (step.id === "platform" || step.id === "client_url") return renderPlatformControl();
    if (step.id === "space") {
      return (
        <RSExistingJsmLinkPanel
          serviceId={id}
          service={svc}
          isActive={isActive}
          canManage={canManage}
          onCreateNew={() => setShowCreateDialog(true)}
        />
      );
    }
    if (step.id === "mapping_work_plan" || step.id === "mapping_billing") return renderMappingsControl();
    if (step.id === "sync") return renderSyncControl();
    return null;
  };

  const openSpaceManagement = () => {
    setSpaceManagementOpen(true);
    if (spaceDetailsRef.current) {
      spaceDetailsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="space-y-4 pb-8 text-slate-900">
      <AppBreadcrumb
        segments={[
          { label: "Servicios Recurrentes", href: "/recurring-services" },
          { label: svc.serviceName, href: `/recurring-services/${id}` },
          { label: "JSM Setup" },
        ]}
      />

      <section className="overflow-hidden rounded-2xl border-b-[3px] border-amber-500 bg-[#0B1A2E] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <button
              type="button"
              onClick={() => navigate(`/recurring-services/${id}`)}
              aria-label="Volver al detalle del servicio"
              className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/10 hover:bg-white/15"
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-300">
                  Compuerta de configuración
                </span>
                {isCompleted && (
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
                    Completada
                  </span>
                )}
              </div>
              <h1 className="mt-2 text-2xl font-black tracking-tight">JSM Setup</h1>
              <p className="mt-1 text-xs text-slate-300">
                {svc.serviceName} · {svc.clientName}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <HeaderMetric
              label="Listos"
              value={issuesQuery.isLoading ? "—" : `${gate.doneCount}/${gate.totalCount}`}
            />
            <HeaderMetric
              label="Vinculados"
              value={issuesQuery.isLoading ? "—" : `${gate.linkedCount}/${gate.totalLinkable}`}
            />
            <HeaderMetric
              label="Pendientes"
              value={issuesQuery.isLoading ? "—" : String(gate.unsyncedCount)}
              warning={!issuesQuery.isLoading && gate.unsyncedCount > 0}
            />
          </div>
        </div>
      </section>

      {issuesQuery.isLoading ? (
        <InlineLoading text="Calculando la compuerta con la validación del servidor…" />
      ) : issuesQuery.error ? (
        <InlineError
          title="No fue posible calcular qué falta para cerrar"
          message={issuesQuery.error.message}
          onRetry={() => issuesQuery.refetch()}
        />
      ) : (
        <JsmGateChecklist
          gate={gate}
          renderControl={renderGateControl}
          onStepAction={step => {
            if (step.id === "space") openSpaceManagement();
          }}
        />
      )}

      {svc.jsmPlatform === "prodigio" && gate.currentStepId !== "space" && (isActive || isCompleted) && (
        <details
          ref={spaceDetailsRef}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          open={spaceManagementOpen}
          onToggle={event => setSpaceManagementOpen(event.currentTarget.open)}
        >
          <summary className="cursor-pointer px-5 py-3.5 text-sm font-black text-slate-950">
            Gestión del Space JSM
            <span className="ml-2 text-xs font-normal text-slate-600">
              {link?.projectKey ?? svc.jsmProjectKey ?? "Sin vínculo"}
            </span>
          </summary>
          <div className="border-t border-slate-200 p-3">
            <RSExistingJsmLinkPanel
              serviceId={id}
              service={svc}
              isActive={isActive}
              canManage={canManage}
              onCreateNew={() => setShowCreateDialog(true)}
            />
          </div>
        </details>
      )}

      <JsmPendingItems groups={pendingGroups} />

      {issuesSummary && <JsmLinkedItems summary={issuesSummary} jiraBaseUrl={jiraBaseUrl} />}

      <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-black text-slate-950">Cerrar etapa</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {isCompleted
              ? "La etapa JSM Setup ya está cerrada."
              : gate.canClose
                ? "El servidor confirmó que no quedan bloqueos de cierre."
                : gate.blockers.join(" ") || "Complete el siguiente paso y espere la validación del servidor."}
          </p>
        </div>
        {isActive && canManage && (
          <Button
            onClick={() => closeMutation.mutate({ serviceId: id })}
            disabled={closeMutation.isPending || !gate.canClose}
            className={gate.canClose ? "bg-[#067647] text-white hover:bg-[#05603A]" : "bg-slate-300 text-slate-600"}
          >
            {closeMutation.isPending ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <CheckCircle2 size={16} className="mr-2" />
            )}
            Cerrar Etapa JSM Setup
          </Button>
        )}
        {isActive && !canManage && (
          <p className="text-xs font-semibold text-slate-500">Solo Admin o PMO puede cerrar esta etapa.</p>
        )}
      </section>

      <Dialog
        open={showCreateDialog}
        onOpenChange={open => {
          if (!canManage || !isActive) return setShowCreateDialog(false);
          setShowCreateDialog(open);
        }}
      >
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Crear Proyecto JSM</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="jsm-space-name">Nombre del Proyecto</Label>
              <Input
                id="jsm-space-name"
                value={spaceName}
                onChange={event => setSpaceName(event.target.value)}
                placeholder="Ej: Soporte Nivel 2 - ClienteXYZ"
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="jsm-space-key">Clave del Proyecto (Key)</Label>
              <Input
                id="jsm-space-key"
                value={spaceKey}
                onChange={event => setSpaceKey(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                placeholder="Ej: SNCXYZ"
                maxLength={10}
                className="mt-1"
              />
              <p className="mt-1 text-[10px] text-slate-500">Solo letras mayúsculas y números, máx. 10 caracteres.</p>
            </div>
            <Button
              onClick={() => createJsmMutation.mutate({ serviceId: id, spaceName, spaceKey })}
              disabled={createJsmMutation.isPending || !spaceName.trim() || !spaceKey.trim()}
              className="bg-[#175CD3] text-white hover:bg-[#1849A9]"
            >
              {createJsmMutation.isPending ? (
                <Loader2 size={16} className="mr-2 animate-spin" />
              ) : (
                <Settings size={16} className="mr-2" />
              )}
              Crear Proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HeaderMetric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="min-w-[92px] rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-0.5 font-mono text-lg font-black ${warning ? "text-amber-300" : "text-white"}`}>{value}</p>
    </div>
  );
}

function IssueTypeSelect({
  label,
  value,
  issueTypes,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  issueTypes: JsmSyncConfiguration["issueTypes"];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
      >
        <option value="">Seleccione un tipo</option>
        {issueTypes.map(issueType => (
          <option key={issueType.id} value={issueType.id}>
            {issueType.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DryRunSummary({ result }: { result: DryRunResult }) {
  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        result.plan.canSync ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
      }`}
    >
      <p className={`text-xs font-black ${result.plan.canSync ? "text-emerald-800" : "text-red-800"}`}>
        Dry-run {result.plan.canSync ? "listo para confirmar" : "bloqueado"}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-700">
        <span>Total: <b>{result.plan.counts.total}</b></span>
        <span>Por crear: <b>{result.plan.counts.toCreate}</b></span>
        <span>Ya vinculados: <b>{result.plan.counts.alreadyLinked}</b></span>
        <span>Bloqueados: <b>{result.plan.counts.blocked}</b></span>
      </div>
      {result.plan.items
        .filter(item => item.action === "blocked")
        .map(item => (
          <p key={`${item.category}-${item.entityId}`} className="mt-1 text-[11px] text-red-800">
            {item.title}: {item.reason}
          </p>
        ))}
    </div>
  );
}

function InlineLoading({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs font-semibold text-slate-600">
      <Loader2 size={16} className="animate-spin text-[#175CD3]" />
      {text}
    </div>
  );
}

function InlineError({ title, message, onRetry }: { title: string; message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4">
      <AlertCircle size={18} className="mt-0.5 shrink-0 text-[#B42318]" />
      <div className="min-w-0 flex-grow">
        <p className="text-sm font-black text-red-950">{title}</p>
        <p className="mt-1 text-xs leading-5 text-red-800">{message}</p>
      </div>
      <Button size="sm" variant="outline" onClick={onRetry} className="bg-white">
        <RefreshCw size={13} className="mr-2" /> Reintentar
      </Button>
    </div>
  );
}
