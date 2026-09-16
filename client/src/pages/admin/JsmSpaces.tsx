import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Headphones,
  Link2,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import {
  canManageExistingJsmSpace,
  getJsmHealthPresentation,
} from "@/pages/recurring/jsmExistingSpaceUi";
import {
  C,
  cardStyle,
  footerStyle,
  footerText,
  headerGradient,
  headerKpiCard,
  headerKpiLabel,
  headerKpiValue,
} from "./adminStyles";

type LinkFilter = "all" | "linked" | "available";
type HealthFilter = "all" | "pending" | "healthy" | "warning" | "blocked";
type OriginFilter = "all" | "created" | "linked" | "legacy";
type JsmInventoryItem =
  RouterOutputs["recurringServices"]["listExistingJsmSpaces"]["items"][number];

const PAGE_SIZE = 20;

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Sin verificación";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin verificación";
  return date.toLocaleString("es-CL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function originLabel(origin: string | null) {
  if (origin === "created") return "Creado desde PMO";
  if (origin === "linked") return "Vinculado existente";
  if (origin === "legacy") return "Vínculo heredado";
  return "Disponible";
}

function JsmSpaceCard({
  space,
  canManage,
  onRevalidate,
  revalidatingId,
}: {
  space: JsmInventoryItem;
  canManage: boolean;
  onRevalidate: (serviceId: number) => void;
  revalidatingId: number | null;
}) {
  const [, setLocation] = useLocation();
  const linkedService = space.linkedService;
  const linked = Boolean(linkedService);
  const health = getJsmHealthPresentation(linkedService?.health);

  return (
    <article
      style={{
        ...cardStyle,
        borderLeft: `4px solid ${linked ? health.foreground : C.g300}`,
        padding: "18px 20px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 10,
              background: linked ? health.background : C.g100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {linked ? (
              <Link2 className="h-5 w-5" style={{ color: health.foreground }} />
            ) : (
              <Unlink className="h-5 w-5" style={{ color: C.g400 }} />
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: C.navy,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {space.projectName}
            </h2>
            <p style={{ fontSize: 11, color: C.g400, marginTop: 3 }}>
              {space.projectKey} · Project ID {space.projectId} · Service Desk ID {space.id}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 9px",
              borderRadius: 12,
              color: linked ? health.foreground : C.g400,
              background: linked ? health.background : C.g100,
            }}
          >
            {linked ? health.label : "Disponible"}
          </span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 9px",
              borderRadius: 12,
              color: linked ? "#7C3AED" : C.g400,
              background: linked ? "rgba(124,58,237,.10)" : C.g100,
            }}
          >
            {originLabel(space.linkOrigin)}
          </span>
        </div>
      </div>

      {linkedService ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          <div style={{ background: C.g100, borderRadius: 9, padding: "10px 12px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.g400, textTransform: "uppercase" }}>
              Servicio recurrente
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 3 }}>
              {linkedService.serviceName}
            </p>
            <p style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>
              {linkedService.clientName} · {linkedService.currentStage}
            </p>
          </div>
          <div style={{ background: C.g100, borderRadius: 9, padding: "10px 12px" }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: C.g400, textTransform: "uppercase" }}>
              Última verificación
            </p>
            <p style={{ fontSize: 12, fontWeight: 700, color: C.navy, marginTop: 3 }}>
              {formatDate(linkedService.lastVerifiedAt)}
            </p>
            <p style={{ fontSize: 10, color: C.g400, marginTop: 2 }}>
              Vinculado: {formatDate(linkedService.linkedAt)}
            </p>
          </div>
        </div>
      ) : (
        <div
          style={{
            marginTop: 16,
            padding: "10px 12px",
            borderRadius: 9,
            background: C.g100,
            color: C.g400,
            fontSize: 11,
          }}
        >
          Este Space no está asociado a ningún servicio recurrente. La vinculación se inicia desde la etapa JSM Setup del servicio correspondiente.
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginTop: 14,
          paddingTop: 14,
          borderTop: `1px solid ${C.g200}`,
        }}
      >
        <a href={space.agentUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 bg-white text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> Vista agentes
          </Button>
        </a>
        <a href={space.portalUrl} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="gap-1.5 bg-white text-xs">
            <ExternalLink className="h-3.5 w-3.5" /> Portal clientes
          </Button>
        </a>
        {linkedService && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 bg-white text-xs"
            onClick={() =>
              setLocation(`/recurring-services/${linkedService.id}/jsm-setup`)
            }
          >
            <Headphones className="h-3.5 w-3.5" /> Ver servicio
          </Button>
        )}
        {linkedService && canManage && (
          <Button
            size="sm"
            className="gap-1.5 text-xs"
            style={{ marginLeft: "auto", background: C.accent, color: "#fff" }}
            disabled={revalidatingId === linkedService.id}
            onClick={() => onRevalidate(linkedService.id)}
          >
            {revalidatingId === linkedService.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ShieldCheck className="h-3.5 w-3.5" />
            )}
            Revalidar
          </Button>
        )}
      </div>
    </article>
  );
}

export default function JsmSpacesPage() {
  const { user } = useAuth();
  const canManage = canManageExistingJsmSpace(user?.role);
  const [search, setSearch] = useState("");
  const [linkStatus, setLinkStatus] = useState<LinkFilter>("all");
  const [health, setHealth] = useState<HealthFilter>("all");
  const [origin, setOrigin] = useState<OriginFilter>("all");
  const [page, setPage] = useState(1);
  const [revalidatingId, setRevalidatingId] = useState<number | null>(null);

  const queryInput = useMemo(
    () => ({
      search: search.trim() || undefined,
      page,
      pageSize: PAGE_SIZE,
      linkStatus,
      health,
      origin,
    }),
    [search, page, linkStatus, health, origin]
  );
  const inventory = trpc.recurringServices.listExistingJsmSpaces.useQuery(queryInput, {
    retry: false,
  });
  const revalidate = trpc.recurringServices.revalidateExistingJsmSpace.useMutation({
    onMutate: input => setRevalidatingId(input.serviceId),
    onSuccess: async result => {
      toast.success(`Space revalidado: ${result.preflight.snapshot.projectKey}`);
      await inventory.refetch();
    },
    onError: error => toast.error(error.message),
    onSettled: () => setRevalidatingId(null),
  });

  const setFilter = <T,>(setter: (value: T) => void, value: T) => {
    setter(value);
    setPage(1);
  };
  const stats = inventory.data?.stats;
  const totalPages = Math.max(1, Math.ceil((inventory.data?.total ?? 0) / PAGE_SIZE));

  return (
    <div style={{ background: C.g100, fontFamily: "'Poppins', sans-serif", color: C.navy, minHeight: "100vh" }}>
      <header className="px-4 py-6 sm:px-6 lg:px-9" style={headerGradient}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <span
              style={{
                background: "rgba(233,30,140,.12)",
                border: "1px solid rgba(233,30,140,.35)",
                borderRadius: 20,
                padding: "3px 12px",
                fontSize: 10,
                fontWeight: 700,
                color: C.accent,
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              Administración
            </span>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <Headphones className="h-6 w-6" style={{ color: C.accent }} /> Spaces JSM
            </h1>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,.58)", marginTop: 4 }}>
              Inventario de Service Desks y sus vínculos con servicios recurrentes PMO
            </p>
          </div>
          <Button
            onClick={() => inventory.refetch()}
            disabled={inventory.isFetching}
            variant="outline"
            style={{ alignSelf: "flex-start", background: "rgba(255,255,255,.1)", color: "#fff", borderColor: "rgba(255,255,255,.18)" }}
          >
            <RefreshCw className={`h-4 w-4 ${inventory.isFetching ? "animate-spin" : ""}`} />
            Actualizar inventario
          </Button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(125px, 1fr))", gap: 10, marginTop: 20 }}>
          {[
            { label: "Service Desks", value: stats?.total ?? 0 },
            { label: "Vinculados", value: stats?.linked ?? 0 },
            { label: "Disponibles", value: stats?.available ?? 0 },
            { label: "Saludable", value: stats?.healthy ?? 0 },
            { label: "Requiere atención", value: (stats?.warning ?? 0) + (stats?.blocked ?? 0) },
          ].map(kpi => (
            <div key={kpi.label} style={headerKpiCard}>
              <div style={headerKpiLabel}>{kpi.label}</div>
              <div style={headerKpiValue}>{kpi.value}</div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex flex-col gap-[18px] px-4 py-6 sm:px-6 lg:px-9">
        <section style={{ ...cardStyle, padding: 16 }} aria-label="Filtros de Spaces JSM">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(220px,2fr)_repeat(3,minmax(150px,1fr))]">
            <label style={{ position: "relative" }}>
              <Search className="h-4 w-4" style={{ position: "absolute", left: 12, top: 11, color: C.g400 }} />
              <input
                value={search}
                onChange={event => setFilter(setSearch, event.target.value)}
                placeholder="Buscar por nombre, key, IDs, servicio o cliente"
                aria-label="Buscar Spaces JSM"
                style={{ width: "100%", minHeight: 38, padding: "8px 10px 8px 36px", borderRadius: 8, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, fontSize: 12 }}
              />
            </label>
            <select
              value={linkStatus}
              onChange={event => setFilter(setLinkStatus, event.target.value as LinkFilter)}
              aria-label="Filtrar por vínculo"
              style={{ minHeight: 38, borderRadius: 8, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, padding: "0 10px", fontSize: 12 }}
            >
              <option value="all">Todos los vínculos</option>
              <option value="linked">Vinculados</option>
              <option value="available">Disponibles</option>
            </select>
            <select
              value={health}
              onChange={event => setFilter(setHealth, event.target.value as HealthFilter)}
              aria-label="Filtrar por salud"
              style={{ minHeight: 38, borderRadius: 8, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, padding: "0 10px", fontSize: 12 }}
            >
              <option value="all">Todas las condiciones</option>
              <option value="healthy">Saludable</option>
              <option value="warning">Advertencia</option>
              <option value="blocked">Bloqueado</option>
              <option value="pending">Pendiente</option>
            </select>
            <select
              value={origin}
              onChange={event => setFilter(setOrigin, event.target.value as OriginFilter)}
              aria-label="Filtrar por origen"
              style={{ minHeight: 38, borderRadius: 8, border: `1px solid ${C.g200}`, background: "#fff", color: C.navy, padding: "0 10px", fontSize: 12 }}
            >
              <option value="all">Todos los orígenes</option>
              <option value="created">Creados desde PMO</option>
              <option value="linked">Vinculados existentes</option>
              <option value="legacy">Vínculos heredados</option>
            </select>
          </div>
        </section>

        {inventory.isLoading ? (
          <div style={{ textAlign: "center", padding: "56px 0", color: C.g400 }}>
            <Loader2 className="h-7 w-7 animate-spin" style={{ margin: "0 auto 10px" }} />
            <p style={{ fontSize: 13 }}>Consultando el catálogo JSM...</p>
          </div>
        ) : inventory.isError ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <AlertCircle className="h-8 w-8" style={{ margin: "0 auto 10px", color: C.red }} />
            <p style={{ fontSize: 14, fontWeight: 800 }}>No fue posible cargar los Spaces JSM</p>
            <p style={{ fontSize: 12, color: C.g400, margin: "6px auto 14px", maxWidth: 620 }}>
              {inventory.error.message}
            </p>
            <Button variant="outline" onClick={() => inventory.refetch()} className="bg-white">
              <RefreshCw className="h-4 w-4" /> Reintentar
            </Button>
          </div>
        ) : !inventory.data?.items.length ? (
          <div style={{ ...cardStyle, textAlign: "center", padding: "48px 24px" }}>
            <CheckCircle2 className="h-8 w-8" style={{ margin: "0 auto 10px", color: C.g300 }} />
            <p style={{ fontSize: 14, fontWeight: 800 }}>No hay resultados</p>
            <p style={{ fontSize: 12, color: C.g400, marginTop: 5 }}>
              Ajusta la búsqueda o los filtros para consultar otro segmento del inventario.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            {inventory.data.items.map(space => (
              <JsmSpaceCard
                key={`${space.projectId}:${space.id}`}
                space={space}
                canManage={canManage}
                revalidatingId={revalidatingId}
                onRevalidate={serviceId => revalidate.mutate({ serviceId })}
              />
            ))}
          </div>
        )}

        {!inventory.isLoading && !inventory.isError && (inventory.data?.total ?? 0) > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ fontSize: 11, color: C.g400 }}>
              Página {page} de {totalPages} · {inventory.data?.total ?? 0} resultado(s)
            </p>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="outline" size="sm" className="bg-white" disabled={page <= 1 || inventory.isFetching} onClick={() => setPage(current => Math.max(1, current - 1))}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button variant="outline" size="sm" className="bg-white" disabled={!inventory.data?.hasMore || inventory.isFetching} onClick={() => setPage(current => current + 1)}>
                Siguiente <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {!canManage && (
          <div style={{ fontSize: 11, color: C.g400, display: "flex", gap: 7, alignItems: "center" }}>
            <ShieldCheck className="h-4 w-4" /> Tu rol dispone de acceso de solo lectura al inventario.
          </div>
        )}
      </main>

      <footer style={footerStyle}>
        <span style={footerText}>Prodigio PMO — Spaces JSM</span>
        <span style={footerText}>Catálogo consultado en modo lectura</span>
      </footer>
    </div>
  );
}
