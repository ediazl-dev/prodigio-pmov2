/**
 * Panel de control ejecutivo.
 *
 * Orden de bloques:
 *   1. Titular: cartera y lo que está fuera de plazo
 *   2. Cuatro cifras de primer orden: plazo, dinero, cumplimiento, riesgos
 *   3. Proyectos activos por urgencia (antes «Proyectos Recientes», por fecha)
 *   4. Activos | Cerrados, lado a lado
 *   5. Dónde se atasca el proceso
 *
 * Lo que se va: los cuatro contadores planos (total/activos/completados/usuarios)
 * y el banner promocional de PMO Agéntica, cuya acción vive en «Nuevo proyecto».
 *
 * Todo sale de `trpc.projects.executive`, un solo query agregado.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Loader2, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { formatPmoProjectId } from "@shared/projectIdentity";

import { AttentionList } from "./home/AttentionList";
import { ActivePanel, ClosedPanel } from "./home/PortfolioPanels";
import { ProcessBottlenecks } from "./home/ProcessBottlenecks";
import {
  TONE,
  buildHeadlineCards,
  longDate,
} from "./home/executiveDashboardFormat";
import {
  buildHomeProjectInput,
  canCreateProjectsFromHome,
  findDuplicateProject,
  type HomeProjectForm,
} from "./home/homeProjectCreation";

const PROJECT_TYPES = [
  { value: "apigee", label: "Apigee / API Gateway" },
  { value: "desarrollo", label: "Desarrollo de Software" },
  { value: "integracion", label: "Integración" },
  { value: "data", label: "Data / Analytics" },
  { value: "otro", label: "Otro" },
] as const;

const CURRENCIES = ["USD", "UF", "UYU", "ARS", "EUR"] as const;
export default function Home() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = user?.role ?? "consulta";
  const canCreate = canCreateProjectsFromHome(role);
  const { data, isLoading, error, refetch, isFetching } =
    trpc.projects.executive.useQuery(undefined, {
      staleTime: 60_000,
    });
  const { data: projects = [], refetch: refetchProjects } =
    trpc.projects.list.useQuery(undefined, {
      enabled: canCreate,
    });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<HomeProjectForm>({
    projectName: "",
    clientName: "",
    clientEmail: "",
    projectType: "desarrollo",
    totalAmount: "",
    currency: "USD",
  });

  const createMutation = trpc.projects.create.useMutation({
    onSuccess: created => {
      toast.success("Proyecto creado. Iniciando SoW…");
      setOpen(false);
      setForm({
        projectName: "",
        clientName: "",
        clientEmail: "",
        projectType: "desarrollo",
        totalAmount: "",
        currency: "USD",
      });
      void Promise.all([refetch(), refetchProjects()]);
      navigate(`/projects/${created.id}/sow`);
    },
    onError: mutationError => toast.error(mutationError.message),
  });

  const handleCreate = () => {
    const input = buildHomeProjectInput(form);
    if (!input) {
      toast.error("Nombre del proyecto y cliente son requeridos");
      return;
    }
    const duplicate = findDuplicateProject(projects, input.projectName);
    if (duplicate) {
      toast.error(
        `Ya existe ${formatPmoProjectId(duplicate.id)} con ese nombre. Abre ese proyecto en vez de crear otro.`
      );
      return;
    }
    createMutation.mutate(input);
  };

  if (isLoading) {
    return (
      <div
        className="grid min-h-[50vh] place-items-center"
        role="status"
        aria-live="polite"
      >
        <div className="text-center">
          <Loader2 size={30} className="mx-auto animate-spin text-[#E91E8C]" />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            Consolidando la cartera…
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900"
        role="alert"
      >
        <div className="flex items-center gap-2 font-bold">
          <AlertTriangle size={18} /> No fue posible cargar el panel de control
        </div>
        <p className="mt-2 text-sm">
          {error?.message ?? "La lectura consolidada no está disponible."}
        </p>
        <Button className="mt-4" variant="outline" onClick={() => refetch()}>
          Reintentar
        </Button>
      </div>
    );
  }

  const cards = buildHeadlineCards(data);
  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-4 pb-8">
      {/* 1 · Titular */}
      <section className="relative overflow-hidden rounded-2xl bg-[#0A1628] px-5 py-4 text-white shadow-[0_18px_50px_rgba(10,22,40,0.18)] sm:px-6">
        <span
          className="absolute left-0 top-0 h-full w-[5px] bg-[#E91E8C]"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Panel de control · Prodigio Tech
            </p>
            <h1 className="mt-1.5 text-2xl font-black tracking-[-0.02em] sm:text-[25px]">
              {data.headline.totalProjects} proyectos en cartera
              {data.headline.stagesOverdue > 0
                ? `, ${data.headline.stagesOverdue} fuera de plazo`
                : data.headline.stagesUnmeasured > 0
                  ? `, ${data.headline.stagesUnmeasured} sin plazo medible`
                  : ", ninguno fuera de plazo"}
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              {firstName ? `${firstName} · ` : ""}
              {data.headline.active} activos · {data.headline.closed} cerrados
              {data.headline.paused > 0
                ? ` · ${data.headline.paused} pausados`
                : ""}{" "}
              · {data.headline.people} personas · datos al{" "}
              {longDate(data.cutOffDate)}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-[38px] border-white/20 bg-white/[0.07] text-white hover:bg-white/15 hover:text-white"
            >
              <RefreshCw
                size={15}
                className={isFetching ? "mr-2 animate-spin" : "mr-2"}
              />
              Actualizar
            </Button>
            {canCreate && (
              <Button
                onClick={() => setOpen(true)}
                className="h-[38px] bg-[#C91879] text-white hover:bg-[#A9145F]"
              >
                <Plus size={15} className="mr-1.5" />
                Nuevo proyecto
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* 2 · Cifras de primer orden */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(card => {
          const tone = TONE[card.tone];
          const accented = card.tone === "alert" || card.tone === "warn";
          return (
            <article
              key={card.key}
              className="flex min-h-[116px] flex-col justify-between rounded-2xl border bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.04)]"
              style={{
                borderColor: accented ? tone.border : "#E2E8F0",
                borderLeftWidth: accented ? 4 : 1,
                borderLeftColor: accented ? tone.text : "#E2E8F0",
              }}
            >
              <p
                className="text-[10px] font-bold uppercase tracking-[0.12em]"
                style={{ color: accented ? tone.text : "#475569" }}
              >
                {card.eyebrow}
              </p>
              <div className="flex flex-wrap items-baseline gap-2">
                <span
                  className="font-mono text-[26px] font-black leading-none tracking-tight"
                  style={{
                    color: card.tone === "calm" ? "#0F172A" : tone.text,
                  }}
                >
                  {card.value}
                </span>
                {card.suffix && (
                  <span className="text-[12px] text-slate-600">
                    {card.suffix}
                  </span>
                )}
              </div>
              <p className="text-[11px] leading-4 text-slate-600">
                {card.detail}
              </p>
            </article>
          );
        })}
      </section>

      {/* 3 · Activos por urgencia */}
      <AttentionList rows={data.attention} />

      {/* 4 · Activos | Cerrados */}
      <section className="grid gap-3.5 xl:grid-cols-2">
        <ActivePanel portfolio={data} />
        <ClosedPanel portfolio={data} />
      </section>

      {/* 5 · Dónde se atasca el proceso */}
      <ProcessBottlenecks
        rows={data.bottlenecks}
        totalClosedStages={data.compliance.total}
      />

      <footer className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[11px] text-slate-600">
        <span>Prodigio Tech · Confidencial</span>
        <span className="hidden h-5 w-px bg-slate-200 sm:block" />
        <span>
          Plazos en días hábiles, descontando feriados, pausas y extensiones
          registradas
        </span>
        <div className="flex-grow" />
        <span>Datos al {longDate(data.cutOffDate)}</span>
      </footer>

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
                onChange={event =>
                  setForm({ ...form, projectName: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="clientName">Cliente</Label>
              <Input
                id="clientName"
                value={form.clientName}
                onChange={event =>
                  setForm({ ...form, clientName: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="clientEmail">Email del cliente</Label>
              <Input
                id="clientEmail"
                type="email"
                value={form.clientEmail}
                onChange={event =>
                  setForm({ ...form, clientEmail: event.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="projectType">Tipo de proyecto</Label>
              <Select
                value={form.projectType}
                onValueChange={value =>
                  setForm({
                    ...form,
                    projectType: value as HomeProjectForm["projectType"],
                  })
                }
              >
                <SelectTrigger id="projectType">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="totalAmount">Monto total</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  min="0"
                  step="any"
                  value={form.totalAmount}
                  onChange={event =>
                    setForm({ ...form, totalAmount: event.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="currency">Moneda</Label>
                <Select
                  value={form.currency}
                  onValueChange={value => setForm({ ...form, currency: value })}
                >
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(currency => (
                      <SelectItem key={currency} value={currency}>
                        {currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="w-full bg-[#C91879] text-white hover:bg-[#A9145F]"
            >
              {createMutation.isPending && (
                <Loader2 size={16} className="mr-2 animate-spin" />
              )}
              Crear proyecto
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
