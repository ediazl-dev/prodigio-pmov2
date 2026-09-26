import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { AlertTriangle, Archive, CheckCircle2, Download, FileClock, FileText, Loader2, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

type EntityType = "project" | "recurring_service";
type RequirementCode = "contract" | "sow" | "technical_economic_proposal" | "costed_pnl" | "work_plan_milestones";
type Requirement = RouterOutputs["documentGovernance"]["portfolio"]["items"][number]["requirements"][number];
type Artifact = RouterOutputs["documentGovernance"]["dossier"]["artifacts"][number];

const STATUS_META: Record<Requirement["status"], { label: string; className: string }> = {
  compliant: { label: "Cumple", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  pending_validation: { label: "Pendiente de validación", className: "border-amber-200 bg-amber-50 text-amber-800" },
  missing: { label: "Faltante", className: "border-rose-200 bg-rose-50 text-rose-700" },
  expired: { label: "Vencido", className: "border-red-300 bg-red-50 text-red-800" },
  rejected: { label: "Rechazado", className: "border-red-300 bg-red-50 text-red-800" },
  not_applicable: { label: "No aplica", className: "border-slate-200 bg-slate-50 text-slate-600" },
  unconfirmed: { label: "Por confirmar", className: "border-sky-200 bg-sky-50 text-sky-700" },
};

const COSTING_CHECKS = [
  ["revenueOrBudget", "Ingreso o presupuesto"],
  ["cost", "Costos"],
  ["margin", "Margen"],
  ["currency", "Moneda"],
  ["cutoffDate", "Fecha de corte"],
  ["financialApproval", "Aprobación financiera"],
] as const;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "N/D";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString("es-CL") : "N/D";
}

function artifactDecision(dossier: RouterOutputs["documentGovernance"]["dossier"] | undefined, artifactId: number) {
  return dossier?.decisions.filter(item => item.artifactId === artifactId)[0] ?? null;
}

export default function DocumentGovernancePanel({
  entityType,
  entityId,
  title = "Expediente documental obligatorio",
  gateCode,
}: {
  entityType: EntityType;
  entityId: number;
  title?: string;
  gateCode?: "recurring_initialization" | "project_planning";
}) {
  const { user } = useAuth();
  const role = String((user as any)?.role ?? "consulta");
  const canUpload = ["admin", "pmo", "pm"].includes(role);
  const canValidate = ["admin", "pmo"].includes(role);
  const isAdmin = role === "admin";
  const utils = trpc.useUtils();
  const queryInput = useMemo(() => ({ entityId, entityType, lifecycle: "all" as const, coverageStatus: "all" as const, requirementCode: "all" as const, page: 1, pageSize: 10 }), [entityId, entityType]);
  const portfolio = trpc.documentGovernance.portfolio.useQuery(queryInput, { refetchOnWindowFocus: true });
  const dossier = trpc.documentGovernance.dossier.useQuery({ entityType, entityId }, { refetchOnWindowFocus: true });
  const readiness = trpc.documentGovernance.readiness.useQuery({ entityType, entityId, gateCode: gateCode ?? (entityType === "project" ? "project_planning" : "recurring_initialization") }, { enabled: Boolean(gateCode), refetchOnWindowFocus: true });
  const item = portfolio.data?.items[0];

  const [uploadTarget, setUploadTarget] = useState<Requirement | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Requirement | null>(null);
  const [decision, setDecision] = useState<"valid" | "rejected" | "revoked">("valid");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [openEnded, setOpenEnded] = useState(true);
  const [reason, setReason] = useState("");
  const [costingChecks, setCostingChecks] = useState<Record<string, boolean>>(() => Object.fromEntries(COSTING_CHECKS.map(([key]) => [key, false])));
  const [archiveTarget, setArchiveTarget] = useState<Artifact | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [resolutionTarget, setResolutionTarget] = useState<Requirement | null>(null);
  const [applicability, setApplicability] = useState<"required" | "not_applicable" | "unconfirmed">("required");
  const [resolutionReason, setResolutionReason] = useState("");
  const [resolutionEvidenceId, setResolutionEvidenceId] = useState("");

  const invalidate = async () => {
    await Promise.all([
      utils.documentGovernance.portfolio.invalidate(),
      utils.documentGovernance.dossier.invalidate({ entityType, entityId }),
      utils.documentGovernance.readiness.invalidate(),
    ]);
  };

  const upload = trpc.documentGovernance.upload.useMutation({
    onSuccess: async result => {
      toast.success(result.duplicate ? "El mismo archivo ya estaba registrado" : "Nueva versión cargada; queda pendiente de validación");
      setUploadTarget(null);
      setUploadFile(null);
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const decide = trpc.documentGovernance.decide.useMutation({
    onSuccess: async () => {
      toast.success(decision === "valid" ? "Documento validado" : decision === "rejected" ? "Documento rechazado" : "Validación revocada");
      setReviewTarget(null);
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const archive = trpc.documentGovernance.archive.useMutation({
    onSuccess: async () => {
      toast.success("Versión archivada; el historial se conserva");
      setArchiveTarget(null);
      setArchiveReason("");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const setResolution = trpc.documentGovernance.setApplicability.useMutation({
    onSuccess: async () => {
      toast.success("Aplicabilidad actualizada con trazabilidad");
      setResolutionTarget(null);
      setResolutionReason("");
      setResolutionEvidenceId("");
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });
  const download = trpc.documentGovernance.download.useMutation({
    onSuccess: result => window.open(result.url, "_blank", "noopener,noreferrer"),
    onError: error => toast.error(error.message),
  });
  const snapshotPlan = trpc.documentGovernance.snapshotProjectWorkPlan.useMutation({
    onSuccess: async result => {
      toast.success(result.duplicate ? `El snapshot de ${result.milestoneCount} hito(s) ya estaba registrado` : `Snapshot creado con ${result.milestoneCount} hito(s); requiere validación`);
      await invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const submitUpload = () => {
    if (!uploadTarget || !uploadFile) return;
    if (uploadFile.size > 25 * 1024 * 1024) return toast.error("El archivo supera el máximo de 25 MB");
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result ?? "");
      const extension = uploadFile.name.split(".").pop()?.toLowerCase() ?? "";
      upload.mutate({
        entityType,
        entityId,
        requirementCode: uploadTarget.code as RequirementCode,
        fileName: uploadFile.name,
        mimeType: uploadFile.type || MIME_BY_EXTENSION[extension] || "application/octet-stream",
        fileBase64: value.includes(",") ? value.slice(value.indexOf(",") + 1) : value,
      });
    };
    reader.onerror = () => toast.error("No fue posible leer el archivo seleccionado");
    reader.readAsDataURL(uploadFile);
  };

  const submitDecision = () => {
    if (!reviewTarget?.activeArtifact) return;
    decide.mutate({
      artifactId: reviewTarget.activeArtifact.id,
      decision,
      validFrom: decision === "valid" && validFrom ? validFrom : null,
      validUntil: decision === "valid" && !openEnded && validUntil ? validUntil : null,
      openEndedValidity: decision === "valid" && openEnded,
      reason: reason.trim() || null,
      costingChecklist: reviewTarget.code === "costed_pnl" && decision === "valid" ? costingChecks : null,
    });
  };

  const openReview = (requirement: Requirement) => {
    setReviewTarget(requirement);
    setDecision("valid");
    setOpenEnded(true);
    setValidFrom(new Date().toISOString().slice(0, 10));
    setValidUntil("");
    setReason("");
    setCostingChecks(Object.fromEntries(COSTING_CHECKS.map(([key]) => [key, false])));
  };

  const pnlChecklistComplete = COSTING_CHECKS.every(([key]) => costingChecks[key]);
  const decisionReady = Boolean(reviewTarget?.activeArtifact)
    && (decision === "valid" ? (openEnded || Boolean(validUntil)) && (reviewTarget?.code !== "costed_pnl" || pnlChecklistComplete) : reason.trim().length >= 5);

  if (portfolio.isLoading || dossier.isLoading) {
    return <section className="rounded-xl border border-slate-200 bg-white p-8"><div className="flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Cargando expediente documental...</div></section>;
  }
  if (portfolio.error || dossier.error || !item) {
    return <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{portfolio.error?.message ?? dossier.error?.message ?? "No fue posible construir el expediente documental."}</section>;
  }

  const artifactById = new Map(dossier.data?.artifacts.map(artifact => [artifact.id, artifact]) ?? []);
  const evidenceOptions = dossier.data?.artifacts.filter(artifact => artifact.artifactStatus === "active") ?? [];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby={`document-governance-${entityType}-${entityId}`}>
      <header className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.1em] text-sky-700">Política {item.policyVersion}</p><h2 id={`document-governance-${entityType}-${entityId}`} className="mt-1 text-base font-black text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">Contrato, SoW, propuesta técnico-económica y P&amp;L con costeo{entityType === "project" ? ", más plan de trabajo con hitos" : ""}. Presencia no equivale a validación.</p></div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[270px]"><div className="rounded-lg bg-white p-2"><b className="block text-lg text-slate-950">{item.coverage.compliant}/{item.coverage.required}</b><span className="text-[9px] uppercase text-slate-500">Cumplen</span></div><div className="rounded-lg bg-amber-50 p-2"><b className="block text-lg text-amber-800">{item.coverage.pendingValidation}</b><span className="text-[9px] uppercase text-amber-700">Por validar</span></div><div className="rounded-lg bg-rose-50 p-2"><b className="block text-lg text-rose-800">{item.coverage.missing + item.coverage.expired + item.coverage.rejected}</b><span className="text-[9px] uppercase text-rose-700">Brechas</span></div></div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-slate-400"><span>Corte {formatDate(item.cutoffAt)} · cada reemplazo crea una nueva versión; el historial no se elimina.</span>{readiness.data && <span className={`rounded-full border px-2 py-1 font-bold uppercase ${readiness.data.ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{readiness.data.ready ? "Ready" : `${readiness.data.blockers.length} bloqueador(es)`} · modo {readiness.data.mode}</span>}</div>
      </header>

      <div className="grid gap-3 p-4 sm:p-5 xl:grid-cols-2">
        {item.requirements.map(requirement => {
          const meta = STATUS_META[requirement.status];
          const activeArtifact = requirement.activeArtifact ? artifactById.get(requirement.activeArtifact.id) ?? null : null;
          const versions = dossier.data?.artifacts.filter(artifact => artifact.requirementCode === requirement.code) ?? [];
          return (
            <article key={requirement.code} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-sm font-black text-slate-900">{requirement.label}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{requirement.description}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${meta.className}`}>{meta.label}</span></div>
              <div className="mt-3 rounded-lg bg-slate-50 p-3"><p className="text-[11px] font-semibold text-slate-700">{requirement.detail}</p>{requirement.activeArtifact ? <><p className="mt-2 truncate text-xs text-slate-700">v{requirement.activeArtifact.version} · {requirement.activeArtifact.fileName}</p><p className="mt-1 font-mono text-[9px] text-slate-400">{requirement.activeArtifact.sha256 ? `SHA-256 ${requirement.activeArtifact.sha256.slice(0, 16)}…` : "SHA-256 no disponible en referencia legacy"} · {requirement.activeArtifact.sourceKind}</p></> : <p className="mt-2 text-xs text-slate-400">Sin versión activa</p>}{requirement.workPlanSnapshot && <p className="mt-2 text-[10px] font-bold text-sky-700">{requirement.workPlanSnapshot.milestoneCount} hito(s) versionados · {requirement.workPlanSnapshot.sourceType}</p>}</div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap [&>button]:min-w-0 [&>button]:w-full sm:[&>button]:w-auto">
                {canUpload && <Button size="sm" variant="outline" aria-label={`${requirement.activeArtifact ? "Cargar nueva versión" : "Cargar"} de ${requirement.label}`} onClick={() => { setUploadTarget(requirement); setUploadFile(null); }}><Upload className="mr-1 h-3.5 w-3.5" /> {requirement.activeArtifact ? "Nueva versión" : "Cargar"}</Button>}
                {entityType === "project" && requirement.code === "work_plan_milestones" && canUpload && <Button size="sm" variant="outline" aria-label="Crear snapshot del plan desde Jira o WBS" onClick={() => snapshotPlan.mutate({ projectId: entityId })} disabled={snapshotPlan.isPending}>{snapshotPlan.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}Snapshot Jira/WBS</Button>}
                {canValidate && requirement.activeArtifact && <Button size="sm" aria-label={`Revisar ${requirement.label}`} onClick={() => openReview(requirement)} className="bg-slate-950 text-white"><ShieldCheck className="mr-1 h-3.5 w-3.5" /> Revisar</Button>}
                {activeArtifact?.fileKey && <Button size="sm" variant="outline" aria-label={`Descargar ${requirement.label}`} onClick={() => download.mutate({ artifactId: activeArtifact.id })} disabled={download.isPending}><Download className="mr-1 h-3.5 w-3.5" /> Descargar</Button>}
                {canValidate && activeArtifact && <Button size="sm" variant="ghost" aria-label={`Archivar ${requirement.label}`} onClick={() => { setArchiveTarget(activeArtifact); setArchiveReason(""); }}><Archive className="mr-1 h-3.5 w-3.5" /> Archivar</Button>}
                {(canValidate || isAdmin) && <Button size="sm" variant="ghost" aria-label={`Cambiar aplicabilidad de ${requirement.label}`} onClick={() => { setResolutionTarget(requirement); setApplicability(requirement.applicability); setResolutionReason(requirement.resolution?.reason ?? ""); setResolutionEvidenceId(requirement.resolution?.evidenceArtifactId ? String(requirement.resolution.evidenceArtifactId) : ""); }}><FileClock className="mr-1 h-3.5 w-3.5" /> Aplicabilidad</Button>}
              </div>
              {versions.length > 0 && <details className="mt-3 border-t border-slate-100 pt-2"><summary className="cursor-pointer text-[10px] font-bold text-slate-500">Historial · {versions.length} versión(es)</summary><div className="mt-2 space-y-1">{versions.map(version => { const versionDecision = artifactDecision(dossier.data, version.id); return <div key={version.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-[10px] text-slate-600"><span className="min-w-0 truncate">v{version.version} · {version.fileName}</span><span>{version.artifactStatus} · {versionDecision?.decision ?? "pending"}</span></div>; })}</div></details>}
            </article>
          );
        })}
      </div>

      <Dialog open={Boolean(uploadTarget)} onOpenChange={open => { if (!open) { setUploadTarget(null); setUploadFile(null); } }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle>Cargar {uploadTarget?.label}</DialogTitle><DialogDescription>La carga crea una nueva versión pendiente de validación. Máximo 25 MB; formatos PDF, Word, Excel o PowerPoint.</DialogDescription></DialogHeader><div className="space-y-3"><Label htmlFor="governance-file">Archivo</Label><Input id="governance-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={event => setUploadFile(event.target.files?.[0] ?? null)} /><p className="text-[11px] text-slate-500">{uploadFile ? `${uploadFile.name} · ${(uploadFile.size / 1024 / 1024).toFixed(2)} MB` : "Selecciona un documento fuente verificable."}</p></div><DialogFooter><Button variant="outline" onClick={() => setUploadTarget(null)}>Cancelar</Button><Button onClick={submitUpload} disabled={!uploadFile || upload.isPending}>{upload.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Cargar versión</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(reviewTarget)} onOpenChange={open => { if (!open) setReviewTarget(null); }}><DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto bg-white"><DialogHeader><DialogTitle>Revisar {reviewTarget?.label}</DialogTitle><DialogDescription>La decisión queda append-only y no elimina decisiones anteriores.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Decisión</Label><Select value={decision} onValueChange={value => setDecision(value as typeof decision)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="valid">Válido</SelectItem><SelectItem value="rejected">Rechazado</SelectItem><SelectItem value="revoked">Revocar validación</SelectItem></SelectContent></Select></div>{decision === "valid" && <><div className="grid gap-3 sm:grid-cols-2"><div><Label>Válido desde</Label><Input className="mt-1" type="date" value={validFrom} onChange={event => setValidFrom(event.target.value)} /></div><div><Label>Válido hasta</Label><Input className="mt-1" type="date" disabled={openEnded} value={validUntil} onChange={event => setValidUntil(event.target.value)} /></div></div><label className="flex items-center gap-2 text-sm text-slate-700"><Checkbox checked={openEnded} onCheckedChange={value => setOpenEnded(value === true)} /> Vigencia abierta aprobada explícitamente</label></>}{reviewTarget?.code === "costed_pnl" && decision === "valid" && <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-bold text-slate-700">Chequeo obligatorio de costeo</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{COSTING_CHECKS.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs text-slate-600"><Checkbox checked={costingChecks[key]} onCheckedChange={value => setCostingChecks(current => ({ ...current, [key]: value === true }))} /> {label}</label>)}</div></fieldset>}<div><Label>Fundamento</Label><Textarea className="mt-1" value={reason} onChange={event => setReason(event.target.value)} placeholder={decision === "valid" ? "Observaciones de la revisión (opcional)" : "Motivo obligatorio del rechazo o revocación"} /></div></div><DialogFooter><Button variant="outline" onClick={() => setReviewTarget(null)}>Cancelar</Button><Button onClick={submitDecision} disabled={!decisionReady || decide.isPending}>{decide.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Registrar decisión</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(archiveTarget)} onOpenChange={open => { if (!open) setArchiveTarget(null); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle>Archivar versión</DialogTitle><DialogDescription>El archivo seguirá visible en el historial, pero dejará de ser evidencia activa.</DialogDescription></DialogHeader><div><Label>Motivo</Label><Textarea className="mt-1" value={archiveReason} onChange={event => setArchiveReason(event.target.value)} /></div><DialogFooter><Button variant="outline" onClick={() => setArchiveTarget(null)}>Cancelar</Button><Button variant="destructive" disabled={archiveReason.trim().length < 5 || archive.isPending} onClick={() => archiveTarget && archive.mutate({ artifactId: archiveTarget.id, reason: archiveReason.trim() })}>{archive.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Archive className="mr-2 h-4 w-4" />}Archivar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={Boolean(resolutionTarget)} onOpenChange={open => { if (!open) setResolutionTarget(null); }}><DialogContent className="max-w-lg bg-white"><DialogHeader><DialogTitle>Aplicabilidad · {resolutionTarget?.label}</DialogTitle><DialogDescription>“No aplica” sólo puede usarlo Administración y requiere evidencia validada del mismo expediente.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label>Resolución</Label><Select value={applicability} onValueChange={value => setApplicability(value as typeof applicability)}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="required">Obligatorio</SelectItem><SelectItem value="unconfirmed">Por confirmar</SelectItem>{isAdmin && <SelectItem value="not_applicable">No aplica</SelectItem>}</SelectContent></Select></div>{applicability === "not_applicable" && <div><Label>Evidencia que justifica la excepción</Label><Select value={resolutionEvidenceId} onValueChange={setResolutionEvidenceId}><SelectTrigger className="mt-1"><SelectValue placeholder="Seleccionar versión" /></SelectTrigger><SelectContent>{evidenceOptions.map(artifact => <SelectItem key={artifact.id} value={String(artifact.id)}>v{artifact.version} · {artifact.fileName}</SelectItem>)}</SelectContent></Select></div>}<div><Label>Fundamento</Label><Textarea className="mt-1" value={resolutionReason} onChange={event => setResolutionReason(event.target.value)} placeholder="Mínimo 10 caracteres" /></div></div><DialogFooter><Button variant="outline" onClick={() => setResolutionTarget(null)}>Cancelar</Button><Button disabled={resolutionReason.trim().length < 10 || (applicability === "not_applicable" && !resolutionEvidenceId) || setResolution.isPending} onClick={() => resolutionTarget && setResolution.mutate({ entityType, entityId, requirementCode: resolutionTarget.code as RequirementCode, applicability, reason: resolutionReason.trim(), evidenceArtifactId: resolutionEvidenceId ? Number(resolutionEvidenceId) : null })}>{setResolution.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Guardar resolución</Button></DialogFooter></DialogContent></Dialog>

      {(readiness.data?.blockers.length ?? item.blockers.length) > 0 && <footer className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:px-5"><p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> {readiness.data?.blockers.length ?? item.blockers.length} bloqueador(es) para readiness.</p><p className="mt-1">{readiness.data?.blockers.map(blocker => blocker.label).join(" · ") || item.blockers.map(blocker => blocker.label).join(" · ")}</p><p className="mt-1">El rollout está en observación salvo que la entidad pertenezca a una cohorte `enforce` explícita.</p></footer>}
    </section>
  );
}
