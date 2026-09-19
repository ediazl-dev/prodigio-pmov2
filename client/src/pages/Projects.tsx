/**
 * Portafolio de proyectos.
 *
 * Cambia de tarjetas a tabla densa, y de dos filtros a siete con orden por
 * columna. Los 12 proyectos pasan de ocupar tres pantallas a caber casi en una.
 *
 * Los datos vienen de `projects.executive`, el mismo endpoint agregado que
 * alimenta el panel de control: cada fila trae etapa, plazo de la etapa en
 * curso, PM resuelto, riesgos altos abiertos y monto. Así la lista y el panel
 * no pueden contradecirse.
 *
 * REQUISITO: el kit del panel de control (`manus-kit-dashboard/`) aplicado.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, FolderKanban, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatPmoProjectId } from "@shared/projectIdentity";

import { buildHomeProjectInput, findDuplicateProject, type HomeProjectForm } from "./home/homeProjectCreation";
import { PortfolioFilters } from "./projects/PortfolioFilters";
import { ProjectTable } from "./projects/ProjectTable";
import {
  DEFAULT_SORT,
  EMPTY_FILTERS,
  buildFilterOptions,
  countActiveFilters,
  filterPortfolio,
  sortPortfolio,
  summarizePortfolio,
  type PortfolioRow,
  type SortKey,
} from "./projects/portfolioViewModel";

const PROJECT_TYPES = [
  { value: "apigee", label: "Apigee / API Gateway" },
  { value: "desarrollo", label: "Desarrollo de Software" },
  { value: "integracion", label: "Integración" },
  { value: "data", label: "Data / Analytics" },
  { value: "otro", label: "Otro" },
];

/** Una vez que el proyecto entra en Avance o Cierre, ya no se borra. */
const BLOCKED_STAGES_FOR_DELETE = ["design", "closure"];

export default function Projects() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data, isLoading, error, refetch } = trpc.projects.executive.useQuery(undefined, { staleTime: 60_000 });

  const role = user?.role ?? "consulta";
  const canCreate = ["admin", "pmo"].includes(role);
  const isAdmin = role === "admin";

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HomeProjectForm>({
    projectName: "",
    clientName: "",
    clientEmail: "",
    projectType: "desarrollo",
    totalAmount: "",
    currency: "USD",
  });
  const [deleteTarget, setDeleteTarget] = useState<PortfolioRow | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: created => {
      toast.success("Proyecto creado exitosamente");
      setOpen(false);
      setForm({ projectName: "", clientName: "", clientEmail: "", projectType: "desarrollo", totalAmount: "", currency: "USD" });
      refetch();
      navigate(`/projects/${created.id}/sow`);
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  const deleteMutation = trpc.jira.deleteProject.useMutation({
    onSuccess: result => {
      toast.success(result.message);
      setDeleteTarget(null);
      setDeleteConfirmText("");
      refetch();
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  const refreshJiraMutation = trpc.projects.refreshJiraPortfolioSnapshots.useMutation({
    onSuccess: async result => {
      await refetch();
      const degraded = result.partialCount + result.errorCount;
      if (degraded > 0) {
        toast.warning(`Jira actualizado con ${degraded} proyecto(s) sin evidencia completa`);
      } else {
        toast.success(`Jira actualizado para ${result.successCount} proyecto(s)`);
      }
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  const allRows = data?.portfolio ?? [];
  const options = useMemo(() => buildFilterOptions(allRows), [allRows]);
  const visible = useMemo(() => sortPortfolio(filterPortfolio(allRows, filters), sort), [allRows, filters, sort]);
  const summary = useMemo(() => summarizePortfolio(visible, allRows), [visible, allRows]);

  const handleSort = (key: SortKey) => {
    setSort(current =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  const handleCreate = () => {
    const input = buildHomeProjectInput(form);
    if (!input) {
      toast.error("Nombre del proyecto y cliente son requeridos");
      return;
    }
    const duplicate = findDuplicateProject(
      allRows.map(row => ({ id: row.projectId, projectName: row.projectName })),
      input.projectName,
    );
    if (duplicate) {
      toast.error(`Ya existe ${formatPmoProjectId(duplicate.id)} con ese nombre. Abre ese proyecto en vez de crear otro.`);
      return;
    }
    createMutation.mutate(input);
  };

  const closeDeleteDialog = () => {
    setDeleteTarget(null);
    setDeleteConfirmText("");
  };

  if (isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center">
        <div className="text-center">
          <Loader2 size={30} className="mx-auto animate-spin text-[#E91E8C]" />
          <p className="mt-3 text-sm font-semibold text-slate-600">Cargando el portafolio…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> No fue posible cargar el portafolio
        </div>
        <p className="mt-2 text-sm">{error?.message ?? "La lectura consolidada no está disponible."}</p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-full min-w-0 space-y-3.5 overflow-hidden pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span className="absolute left-0 top-0 h-full w-[5px] bg-[#E91E8C]" aria-hidden="true" />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              PMO Proyectos · Prodigio Tech
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.02em] sm:text-[25px]">Portafolio de proyectos</h1>
            <p className="mt-1 text-xs text-slate-300">
              {data.headline.totalProjects} registrados · {data.headline.active} activos ·{" "}
              {data.headline.closed} cerrados
              {data.headline.paused > 0 ? ` · ${data.headline.paused} pausados` : ""}
              {data.headline.stagesOverdue > 0 ? ` · ${data.headline.stagesOverdue} con la etapa vencida` : ""}
            </p>
          </div>

          {canCreate && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={refreshJiraMutation.isPending}
                onClick={() => refreshJiraMutation.mutate()}
                className="h-[38px] shrink-0 border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <RefreshCw size={15} className={`mr-1.5 ${refreshJiraMutation.isPending ? "animate-spin" : ""}`} />
                Actualizar Jira
              </Button>
              <Button onClick={() => setOpen(true)} className="h-[38px] shrink-0 bg-[#C91879] text-white hover:bg-[#A9145F]">
                <Plus size={15} className="mr-1.5" />
                Nuevo proyecto
              </Button>
            </div>
          )}
        </div>
      </section>

      <PortfolioFilters
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
        options={options}
        summary={summary}
      />

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-16 text-center">
          <Search className="mx-auto text-slate-300" size={36} />
          <p className="mt-3 font-bold text-slate-800">No hay proyectos para estos filtros</p>
          {countActiveFilters(filters) > 0 && (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-2 text-sm font-bold text-[#175CD3]"
            >
              Restablecer filtros
            </button>
          )}
        </div>
      ) : (
        <ProjectTable
          rows={visible}
          sort={sort}
          onSortChange={handleSort}
          canDelete={row => isAdmin && !BLOCKED_STAGES_FOR_DELETE.includes(row.stageId)}
          onDelete={row => {
            setDeleteTarget(row);
            setDeleteConfirmText("");
          }}
        />
      )}

      <footer className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <FolderKanban size={13} className="text-slate-400" /> Prodigio Tech · Confidencial
        </span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span>Plazos en días hábiles, descontando feriados, pausas y extensiones registradas</span>
        <div className="flex-grow" />
        <span>
          {summary.count} de {summary.total} proyectos ·{" "}
          {new Date(data.cutOffDate.length === 10 ? `${data.cutOffDate}T12:00:00` : data.cutOffDate).toLocaleDateString(
            "es-CL",
            { day: "2-digit", month: "long", year: "numeric" },
          )}
        </span>
      </footer>

      {/* Crear proyecto */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo proyecto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="projectName">Nombre del proyecto</Label>
              <Input
                id="projectName"
                value={form.projectName}
                onChange={event => setForm({ ...form, projectName: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientName">Cliente</Label>
              <Input
                id="clientName"
                value={form.clientName}
                onChange={event => setForm({ ...form, clientName: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Email del cliente</Label>
              <Input
                id="clientEmail"
                type="email"
                value={form.clientEmail}
                onChange={event => setForm({ ...form, clientEmail: event.target.value })}
              />
            </div>
            <div>
              <Label>Tipo de proyecto</Label>
              <Select
                value={form.projectType}
                onValueChange={value =>
                  setForm({ ...form, projectType: value as HomeProjectForm["projectType"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="totalAmount">Monto total</Label>
                <Input
                  id="totalAmount"
                  value={form.totalAmount}
                  onChange={event => setForm({ ...form, totalAmount: event.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
                <Select value={form.currency} onValueChange={value => setForm({ ...form, currency: value })}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="UF">UF</SelectItem>
                    <SelectItem value="CLP">CLP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full bg-[#C91879] text-white hover:bg-[#A9145F]"
            >
              {createMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
              Crear proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Eliminar proyecto */}
      <Dialog open={deleteTarget !== null} onOpenChange={value => !value && closeDeleteDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#B42318]">
              <AlertTriangle size={18} /> Eliminar proyecto
            </DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                Vas a eliminar <b className="text-slate-950">{deleteTarget.projectName}</b> de{" "}
                {deleteTarget.clientName}. La acción no se puede deshacer.
              </p>
              <div>
                <Label htmlFor="deleteConfirm">
                  Escribe <b>ELIMINAR</b> para confirmar
                </Label>
                <Input
                  id="deleteConfirm"
                  value={deleteConfirmText}
                  onChange={event => setDeleteConfirmText(event.target.value)}
                  placeholder="ELIMINAR"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={closeDeleteDialog} className="flex-grow">
                  Cancelar
                </Button>
                <Button
                  onClick={() => deleteMutation.mutate({ projectId: deleteTarget.projectId })}
                  disabled={deleteConfirmText !== "ELIMINAR" || deleteMutation.isPending}
                  className="flex-grow bg-[#B42318] text-white hover:bg-[#912018]"
                >
                  {deleteMutation.isPending && <Loader2 size={16} className="mr-2 animate-spin" />}
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
