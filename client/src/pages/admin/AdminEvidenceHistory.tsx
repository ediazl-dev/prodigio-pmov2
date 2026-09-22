import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  FileText,
  Filter,
  FolderOpen,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  C,
  cardStyle,
  footerStyle,
  footerText,
  headerGradient,
  headerKpiCard,
  headerKpiLabel,
  headerKpiValue,
  pageBackground,
  tdStyle,
  thStyle,
} from "./adminStyles";

type EvidenceStatus = "all" | "pending" | "expired" | "attached" | "discarded";
type DocumentType = "all" | "minute" | "acceptance" | "recovery_plan";

const STATUS_LABELS: Record<Exclude<EvidenceStatus, "all">, string> = {
  pending: "Pendiente",
  expired: "Expirado",
  attached: "Adjuntado",
  discarded: "Descartado",
};

const DOCUMENT_LABELS: Record<Exclude<DocumentType, "all">, string> = {
  minute: "Minuta",
  acceptance: "Acta de aceptación",
  recovery_plan: "Plan de recuperación",
};

const STATUS_COLORS: Record<Exclude<EvidenceStatus, "all">, { background: string; color: string; border: string }> = {
  pending: { background: "#FFF7E6", color: "#9A6700", border: "#F3D596" },
  expired: { background: "#FFF0F0", color: C.red, border: "#F0B8B8" },
  attached: { background: "#EAF8F2", color: C.teal, border: "#A7DCCF" },
  discarded: { background: C.g150, color: C.g400, border: C.g300 },
};

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "N/D";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "N/D";
  return date.toLocaleString("es-CL", { dateStyle: "short", timeStyle: "short" });
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/D";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatusBadge({ status }: { status: Exclude<EvidenceStatus, "all"> }) {
  const style = STATUS_COLORS[status];
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      border: `1px solid ${style.border}`,
      background: style.background,
      color: style.color,
      padding: "3px 9px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: ".04em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function AdminEvidenceHistory() {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [status, setStatus] = useState<EvidenceStatus>("pending");
  const [documentType, setDocumentType] = useState<DocumentType>("all");
  const [projectId, setProjectId] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [discardTarget, setDiscardTarget] = useState<any>(null);
  const [discardReason, setDiscardReason] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => setPage(1), [status, documentType, projectId, debouncedSearch]);

  const queryInput = useMemo(() => ({
    page,
    pageSize,
    status,
    ...(documentType !== "all" ? { documentType } : {}),
    ...(projectId !== "all" ? { projectId: Number(projectId) } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [page, pageSize, status, documentType, projectId, debouncedSearch]);

  const utils = trpc.useUtils();
  const listQuery = trpc.executiveEvidenceAdmin.list.useQuery(queryInput, { refetchOnWindowFocus: true });
  const summaryQuery = trpc.executiveEvidenceAdmin.summary.useQuery(undefined, { refetchOnWindowFocus: true });
  const projectsQuery = trpc.executiveEvidenceAdmin.projects.useQuery(undefined, { refetchOnWindowFocus: true });

  const refreshAll = async () => {
    await Promise.all([listQuery.refetch(), summaryQuery.refetch(), projectsQuery.refetch()]);
  };

  const discardMutation = trpc.executiveEvidenceAdmin.discard.useMutation({
    onSuccess: async () => {
      toast.success("Documento pendiente descartado");
      setDiscardTarget(null);
      setDiscardReason("");
      await Promise.all([
        utils.executiveEvidenceAdmin.list.invalidate(),
        utils.executiveEvidenceAdmin.summary.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const restoreMutation = trpc.executiveEvidenceAdmin.restore.useMutation({
    onSuccess: async () => {
      toast.success("Documento restaurado como pendiente");
      await Promise.all([
        utils.executiveEvidenceAdmin.list.invalidate(),
        utils.executiveEvidenceAdmin.summary.invalidate(),
      ]);
    },
    onError: error => toast.error(error.message),
  });

  const items = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const summary = summaryQuery.data;
  const hasFilters = status !== "pending" || documentType !== "all" || projectId !== "all" || search.length > 0;

  const clearFilters = () => {
    setStatus("pending");
    setDocumentType("all");
    setProjectId("all");
    setSearch("");
    setPage(1);
  };

  const submitDiscard = () => {
    if (!discardTarget || discardReason.trim().length < 5) return;
    discardMutation.mutate({ id: discardTarget.id, reason: discardReason.trim() });
  };

  return (
    <div className="w-full max-w-full min-w-0 overflow-hidden" style={pageBackground}>
      <header style={{ ...headerGradient, padding: "30px clamp(18px, 3vw, 36px) 26px" }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span style={{
              background: "rgba(59,142,232,.15)",
              border: "1px solid rgba(59,142,232,.35)",
              borderRadius: 20,
              padding: "3px 12px",
              fontSize: 10,
              fontWeight: 700,
              color: C.accent,
              letterSpacing: ".1em",
              textTransform: "uppercase",
            }}>
              Administración
            </span>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-extrabold text-white sm:text-[26px]">
              <FileClock className="h-6 w-6" style={{ color: C.accent }} /> Historial de evidencia documental
            </h1>
            <p className="mt-1 text-xs text-white/50">
              Monitorea cargas pendientes, adjuntos, expiraciones y descartes sin exponer URLs internas ni contenido de archivos.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={listQuery.isFetching || summaryQuery.isFetching}
            className="border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(listQuery.isFetching || summaryQuery.isFetching) ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[
            { key: "pending" as const, label: "Pendientes vigentes", value: summary?.pending ?? 0, icon: Clock3 },
            { key: "expired" as const, label: "Pendientes expirados", value: summary?.expired ?? 0, icon: AlertTriangle },
            { key: "attached" as const, label: "Adjuntados", value: summary?.attached ?? 0, icon: CheckCircle2 },
            { key: "discarded" as const, label: "Descartados", value: summary?.discarded ?? 0, icon: Trash2 },
            { key: "all" as const, label: "Total histórico", value: summary?.total ?? 0, icon: FileText },
          ].map(card => (
            <button
              key={card.key}
              type="button"
              onClick={() => { setStatus(card.key); setPage(1); }}
              style={{
                ...headerKpiCard,
                textAlign: "left",
                cursor: "pointer",
                outline: status === card.key ? `2px solid ${C.accent}` : "none",
                outlineOffset: 1,
              }}
              aria-pressed={status === card.key}
            >
              <div className="flex items-center justify-between gap-2">
                <div style={headerKpiLabel}>{card.label}</div>
                <card.icon className="h-4 w-4 text-white/40" />
              </div>
              <div style={headerKpiValue}>{card.value}</div>
            </button>
          ))}
        </div>
      </header>

      <main className="flex min-w-0 flex-col gap-5 p-4 sm:p-6 lg:p-8">
        <section style={{ ...cardStyle, padding: "16px 18px" }}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-bold" style={{ color: C.navy }}>
              <Filter className="h-4 w-4" /> Filtros operativos
            </h2>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900">
                <X className="h-3.5 w-3.5" /> Limpiar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Proyecto, archivo o usuario" className="pl-9" />
            </div>
            <Select value={status} onValueChange={value => setStatus(value as EvidenceStatus)}>
              <SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendientes vigentes</SelectItem>
                <SelectItem value="expired">Pendientes expirados</SelectItem>
                <SelectItem value="attached">Adjuntados</SelectItem>
                <SelectItem value="discarded">Descartados</SelectItem>
                <SelectItem value="all">Todos los estados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={documentType} onValueChange={value => setDocumentType(value as DocumentType)}>
              <SelectTrigger><SelectValue placeholder="Tipo documental" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los tipos</SelectItem>
                <SelectItem value="minute">Minutas</SelectItem>
                <SelectItem value="acceptance">Actas de aceptación</SelectItem>
                <SelectItem value="recovery_plan">Planes de recuperación</SelectItem>
              </SelectContent>
            </Select>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Proyecto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proyectos</SelectItem>
                {(projectsQuery.data ?? []).map(project => (
                  <SelectItem key={project.id} value={String(project.id)}>{project.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </section>

        <section style={{ ...cardStyle, overflow: "hidden" }} className="min-w-0 max-w-full">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div>
              <p className="text-sm font-bold" style={{ color: C.navy }}>Documentos</p>
              <p className="text-[11px] text-slate-500">{total} registro{total === 1 ? "" : "s"} para los filtros actuales</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1 || listQuery.isFetching} onClick={() => setPage(current => current - 1)} aria-label="Página anterior">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-24 text-center text-xs text-slate-500">Página {page} de {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages || listQuery.isFetching} onClick={() => setPage(current => current + 1)} aria-label="Página siguiente">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="max-w-full overflow-x-auto">
            <table className="min-w-[1120px] w-full border-collapse">
              <thead>
                <tr>
                  <th style={thStyle}>Carga</th>
                  <th style={thStyle}>Proyecto</th>
                  <th style={thStyle}>Documento</th>
                  <th style={thStyle}>Archivo</th>
                  <th style={thStyle}>Responsable</th>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Trazabilidad</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading && (
                  <tr><td colSpan={8} style={{ ...tdStyle, padding: 0 }}><div className="sticky left-0 flex min-h-44 w-[calc(100vw-64px)] max-w-[1080px] flex-col items-center justify-center text-center"><RefreshCw className="mb-2 h-5 w-5 animate-spin text-slate-400" />Cargando historial...</div></td></tr>
                )}
                {!listQuery.isLoading && listQuery.error && (
                  <tr><td colSpan={8} style={{ ...tdStyle, padding: 0, color: C.red }}><div className="sticky left-0 flex min-h-44 w-[calc(100vw-64px)] max-w-[1080px] items-center justify-center text-center">{listQuery.error.message}</div></td></tr>
                )}
                {!listQuery.isLoading && !listQuery.error && items.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ ...tdStyle, padding: 0 }}>
                      <div className="sticky left-0 flex min-h-52 w-[calc(100vw-64px)] max-w-[1080px] flex-col items-center justify-center px-5 text-center">
                        <FileClock className="mb-3 h-8 w-8 text-slate-300" />
                        <p className="font-semibold text-slate-700">No hay documentos para estos filtros</p>
                        <p className="mt-1 text-xs text-slate-500">Las cargas validadas aparecerán aquí antes y después de ser adjuntadas.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td style={tdStyle}>
                      <div className="font-semibold">{formatDate(item.createdAt)}</div>
                      <div className="mt-1 text-[10px] text-slate-400">Recibo #{item.id}</div>
                    </td>
                    <td style={tdStyle}>
                      <Link href={`/projects/${item.projectId}/executive-dashboard-v2`} className="inline-flex max-w-[230px] items-start gap-1 font-semibold text-sky-700 hover:underline">
                        <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span className="break-words">{item.projectName || `Proyecto ${item.projectId}`}</span>
                      </Link>
                      <div className="mt-1 text-[10px] text-slate-400">PMO-{item.projectId} · baseline #{item.sourceId}</div>
                    </td>
                    <td style={tdStyle}>
                      <div className="font-semibold">{DOCUMENT_LABELS[item.documentType]}</div>
                      {item.attachedEntityId && <div className="mt-1 text-[10px] text-slate-400">Registro #{item.attachedEntityId}</div>}
                    </td>
                    <td style={tdStyle}>
                      <div className="max-w-[210px] break-all font-medium">{item.fileName}</div>
                      <div className="mt-1 text-[10px] text-slate-400">{formatBytes(item.sizeBytes)} · {item.mimeType}</div>
                    </td>
                    <td style={tdStyle}>
                      <div className="font-medium">{item.uploadedByName || `Usuario ${item.uploadedBy}`}</div>
                      {item.discardedByName && <div className="mt-1 text-[10px] text-slate-400">Descartó: {item.discardedByName}</div>}
                    </td>
                    <td style={tdStyle}>
                      <StatusBadge status={item.status} />
                      <div className="mt-2 text-[10px] text-slate-400">
                        {item.status === "pending" && `Vence ${formatDate(item.expiresAt)}`}
                        {item.status === "expired" && `Expiró ${formatDate(item.expiresAt)}`}
                        {item.status === "attached" && `Adjuntado ${formatDate(item.attachedAt)}`}
                        {item.status === "discarded" && `Descartado ${formatDate(item.discardedAt)}`}
                      </div>
                    </td>
                    <td style={tdStyle}>
                      {item.discardReason ? (
                        <p className="max-w-[220px] break-words text-xs text-slate-600">{item.discardReason}</p>
                      ) : (
                        <p className="text-xs text-slate-400">
                          {item.status === "attached" ? "Vinculado al registro formal" : "Sin observaciones"}
                        </p>
                      )}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      {item.canDiscard && (
                        <Button variant="outline" size="sm" onClick={() => { setDiscardTarget(item); setDiscardReason(""); }} className="border-red-200 text-red-700 hover:bg-red-50">
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Descartar
                        </Button>
                      )}
                      {item.canRestore && (
                        <Button variant="outline" size="sm" disabled={restoreMutation.isPending} onClick={() => restoreMutation.mutate({ id: item.id })}>
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Restaurar
                        </Button>
                      )}
                      {!item.canDiscard && !item.canRestore && <span className="text-[10px] text-slate-400">Sin acciones</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      <footer style={footerStyle} className="gap-3">
        <span style={footerText}>Prodigio Tech · Gestión administrativa de evidencia documental</span>
        <span style={footerText}>Actualizado {formatDate(new Date())}</span>
      </footer>

      <Dialog open={Boolean(discardTarget)} onOpenChange={open => { if (!open) { setDiscardTarget(null); setDiscardReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar documento pendiente</DialogTitle>
            <DialogDescription>
              El recibo quedará invalidado y no podrá adjuntarse a un acta, minuta o plan. El archivo no se elimina del storage y la acción quedará auditada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-800">{discardTarget?.fileName}</p>
              <p className="mt-1 text-xs text-slate-500">{discardTarget?.projectName || `Proyecto ${discardTarget?.projectId}`}</p>
            </div>
            <div>
              <label htmlFor="discard-reason" className="mb-1.5 block text-sm font-medium text-slate-700">Razón del descarte</label>
              <Textarea id="discard-reason" value={discardReason} onChange={event => setDiscardReason(event.target.value)} maxLength={500} placeholder="Ej.: archivo duplicado o cargado por error" />
              <p className="mt-1 text-right text-[10px] text-slate-400">{discardReason.trim().length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDiscardTarget(null); setDiscardReason(""); }}>Cancelar</Button>
            <Button variant="destructive" disabled={discardReason.trim().length < 5 || discardMutation.isPending} onClick={submitDiscard}>
              {discardMutation.isPending ? "Descartando..." : "Descartar documento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
