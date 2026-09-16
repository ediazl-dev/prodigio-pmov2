import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import type {
  JsmExistingSpacePreflight,
  JsmLinkHealth,
  JsmPreflightStatus,
} from "@shared/jsmExistingSpace";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Link2,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import {
  canConfirmExistingJsmLink,
  getJsmHealthPresentation,
  getJsmPreflightPresentation,
} from "./jsmExistingSpaceUi";

const C = {
  navy: "#0B1A2E",
  accent: "#3B8EE8",
  green: "#059669",
  border: "#E2E8F0",
  textPrimary: "#1E293B",
  textSecondary: "#64748B",
  textMuted: "#94A3B8",
};

type ServiceSnapshot = {
  jsmProjectKey?: string | null;
  jsmProjectId?: string | null;
  jsmProjectName?: string | null;
  jsmServiceDeskId?: string | null;
  jsmLinkSource?: "created" | "linked" | null;
  jsmLinkHealth?: JsmLinkHealth | null;
  jsmAgentUrl?: string | null;
  jsmPortalUrl?: string | null;
  jsmLastVerifiedAt?: Date | string | null;
  jsmLinkedAt?: Date | string | null;
};

type Candidate = {
  id: string;
  projectId: string;
  projectName: string;
  projectKey: string;
  linkedService: {
    id: number;
    serviceName: string;
    clientName: string;
    health: JsmLinkHealth | null;
  } | null;
};

type PreflightResult = {
  runId: string;
  preflight: JsmExistingSpacePreflight;
  reused: boolean;
};

function formatDate(value?: Date | string | null) {
  if (!value) return "Aún no registrada";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";
  return date.toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusColors(tone: "success" | "warning" | "danger") {
  if (tone === "success")
    return { background: "#F0FDF4", border: "#BBF7D0", color: "#166534" };
  if (tone === "warning")
    return { background: "#FFFBEB", border: "#FDE68A", color: "#92400E" };
  return { background: "#FEF2F2", border: "#FECACA", color: "#991B1B" };
}

export function RSExistingJsmLinkPanel({
  serviceId,
  service,
  isActive,
  canManage,
  onCreateNew,
}: {
  serviceId: number;
  service: ServiceSnapshot;
  isActive: boolean;
  canManage: boolean;
  onCreateNew: () => void;
}) {
  const utils = trpc.useUtils();
  const [mode, setMode] = useState<"create" | "link" | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);
  const [showUnlink, setShowUnlink] = useState(false);
  const [unlinkReason, setUnlinkReason] = useState("");

  const linkStateQuery =
    trpc.recurringServices.getExistingJsmLinkState.useQuery(
      { serviceId, limit: 10 },
      { enabled: true }
    );
  const catalogQuery = trpc.recurringServices.listExistingJsmSpaces.useQuery(
    {
      search: deferredSearch.trim() || undefined,
      page: 1,
      pageSize: 25,
    },
    { enabled: mode === "link" && canManage }
  );

  const invalidateLinkQueries = async () => {
    await Promise.all([
      utils.recurringServices.getById.invalidate({ id: serviceId }),
      utils.recurringServices.getExistingJsmLinkState.invalidate({
        serviceId,
        limit: 10,
      }),
      utils.recurringServices.listExistingJsmSpaces.invalidate(),
      utils.recurringServices.getJsmSyncConfiguration.invalidate(),
      utils.recurringServices.getJiraIssuesSummary.invalidate({ serviceId }),
    ]);
  };

  const preflightMutation =
    trpc.recurringServices.preflightExistingJsmSpace.useMutation({
      onSuccess: result => {
        setPreflight(result as PreflightResult);
        if (result.preflight.canLink) {
          toast.success("Preflight completado sin modificar Jira/JSM.");
        } else {
          toast.error("El Space tiene bloqueos que impiden vincularlo.");
        }
      },
      onError: error => toast.error(error.message),
    });

  const linkMutation = trpc.recurringServices.linkExistingJsmSpace.useMutation({
    onSuccess: async result => {
      toast.success(
        result.reused
          ? "El Space ya estaba vinculado a este servicio."
          : "Space JSM vinculado al servicio recurrente."
      );
      setSelected(null);
      setPreflight(null);
      setMode(null);
      await invalidateLinkQueries();
    },
    onError: error => toast.error(error.message),
  });

  const revalidateMutation =
    trpc.recurringServices.revalidateExistingJsmSpace.useMutation({
      onSuccess: async result => {
        toast[result.preflight.canLink ? "success" : "error"](
          result.preflight.canLink
            ? "Vínculo JSM revalidado mediante lecturas seguras."
            : "La revalidación detectó bloqueos."
        );
        await invalidateLinkQueries();
      },
      onError: error => toast.error(error.message),
    });

  const unlinkMutation =
    trpc.recurringServices.unlinkExistingJsmSpace.useMutation({
      onSuccess: async () => {
        toast.success("Space JSM desvinculado del servicio recurrente.");
        setShowUnlink(false);
        setUnlinkReason("");
        setMode(null);
        await invalidateLinkQueries();
      },
      onError: error => toast.error(error.message),
    });

  const link = linkStateQuery.data?.link;
  const hasLink = Boolean(
    link?.projectKey ||
      link?.projectId ||
      link?.serviceDeskId ||
      service.jsmProjectKey ||
      service.jsmProjectId ||
      service.jsmServiceDeskId
  );
  const effectiveLink = {
    source: link?.source ?? service.jsmLinkSource,
    projectId: link?.projectId ?? service.jsmProjectId,
    projectKey: link?.projectKey ?? service.jsmProjectKey,
    projectName: link?.projectName ?? service.jsmProjectName,
    serviceDeskId: link?.serviceDeskId ?? service.jsmServiceDeskId,
    agentUrl: link?.agentUrl ?? service.jsmAgentUrl,
    portalUrl: link?.portalUrl ?? service.jsmPortalUrl,
    health: (link?.health ??
      service.jsmLinkHealth ??
      "pending") as JsmLinkHealth,
    lastVerifiedAt: link?.lastVerifiedAt ?? service.jsmLastVerifiedAt,
    linkedAt: link?.linkedAt ?? service.jsmLinkedAt,
  };
  const health = getJsmHealthPresentation(effectiveLink.health);

  const selectCandidate = (candidate: Candidate) => {
    setSelected(candidate);
    setPreflight(null);
  };

  const resetLinkFlow = () => {
    setSelected(null);
    setPreflight(null);
    setSearch("");
  };

  if (hasLink) {
    const canRevalidate = Boolean(
      effectiveLink.projectId && effectiveLink.serviceDeskId
    );
    return (
      <section
        aria-labelledby="jsm-link-title"
        style={{
          background: "#fff",
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          padding: "20px 24px",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 16,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: ".12em",
                color: C.textMuted,
                textTransform: "uppercase",
              }}
            >
              Space JSM asociado
            </p>
            <h3
              id="jsm-link-title"
              style={{
                marginTop: 4,
                fontSize: 17,
                fontWeight: 800,
                color: C.navy,
              }}
            >
              {effectiveLink.projectName || effectiveLink.projectKey}
            </h3>
            <p style={{ marginTop: 3, fontSize: 12, color: C.textSecondary }}>
              {effectiveLink.source === "created"
                ? "Creado desde PMO"
                : effectiveLink.source === "linked"
                  ? "Vinculado desde un Service Desk existente"
                  : "Registro heredado · origen pendiente de homologar"}
            </p>
          </div>
          <span
            style={{
              padding: "5px 10px",
              borderRadius: 999,
              border: `1px solid ${health.border}`,
              background: health.background,
              color: health.foreground,
              fontSize: 10,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            {health.label}
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          {[
            ["Project key", effectiveLink.projectKey || "No disponible"],
            ["Project ID", effectiveLink.projectId || "No disponible"],
            ["Service Desk ID", effectiveLink.serviceDeskId || "Pendiente"],
            ["Última verificación", formatDate(effectiveLink.lastVerifiedAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              style={{
                borderRadius: 9,
                border: `1px solid ${C.border}`,
                background: "#F8FAFC",
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 9,
                  color: C.textMuted,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: ".08em",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 12,
                  color: C.textPrimary,
                  fontWeight: 650,
                  overflowWrap: "anywhere",
                }}
              >
                {String(value)}
              </div>
            </div>
          ))}
        </div>

        {!canRevalidate && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 9,
              border: "1px solid #FDE68A",
              background: "#FFFBEB",
              color: "#92400E",
              fontSize: 11,
            }}
          >
            El registro necesita completar Project ID y Service Desk ID mediante
            una revisión administrativa antes de poder revalidarse.
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            marginTop: 16,
          }}
        >
          {effectiveLink.agentUrl && (
            <Button asChild size="sm" variant="outline">
              <a
                href={effectiveLink.agentUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} className="mr-1" /> Vista de agentes
              </a>
            </Button>
          )}
          {effectiveLink.portalUrl && (
            <Button asChild size="sm" variant="outline">
              <a
                href={effectiveLink.portalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={14} className="mr-1" /> Portal clientes
              </a>
            </Button>
          )}
          {canManage && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => revalidateMutation.mutate({ serviceId })}
                disabled={revalidateMutation.isPending || !canRevalidate}
              >
                {revalidateMutation.isPending ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <RefreshCw size={14} className="mr-1" />
                )}
                Revalidar vínculo
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowUnlink(true)}
                style={{ color: "#B91C1C", borderColor: "#FCA5A5" }}
              >
                <Unlink size={14} className="mr-1" /> Desvincular
              </Button>
            </>
          )}
        </div>

        {!canManage && (
          <p
            style={{
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              color: C.textSecondary,
            }}
          >
            <Lock size={13} /> Acceso de solo lectura. Admin y PMO pueden
            revalidar o desvincular.
          </p>
        )}

        <Dialog open={showUnlink} onOpenChange={setShowUnlink}>
          <DialogContent className="max-w-lg bg-white">
            <DialogHeader>
              <DialogTitle>Desvincular Space JSM</DialogTitle>
              <DialogDescription>
                Esta acción solo elimina el vínculo en PMO. No modifica ni
                elimina el proyecto, Service Desk o tickets en Jira/JSM.
              </DialogDescription>
            </DialogHeader>
            <div style={{ display: "grid", gap: 12 }}>
              <div
                style={{
                  borderRadius: 9,
                  border: "1px solid #FECACA",
                  background: "#FEF2F2",
                  padding: "10px 12px",
                  color: "#991B1B",
                  fontSize: 11,
                }}
              >
                Si existen actividades o mensualidades con `jiraIssueKey`, la
                operación será bloqueada para preservar la trazabilidad.
              </div>
              <div>
                <Label htmlFor="jsm-unlink-reason">Motivo obligatorio</Label>
                <textarea
                  id="jsm-unlink-reason"
                  value={unlinkReason}
                  onChange={event => setUnlinkReason(event.target.value)}
                  placeholder="Explique por qué debe retirarse este vínculo (mínimo 10 caracteres)."
                  rows={4}
                  style={{
                    marginTop: 5,
                    width: "100%",
                    resize: "vertical",
                    borderRadius: 8,
                    border: `1px solid ${C.border}`,
                    padding: "9px 10px",
                    fontSize: 12,
                    color: C.textPrimary,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <Button
                  variant="outline"
                  onClick={() => setShowUnlink(false)}
                  disabled={unlinkMutation.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() =>
                    unlinkMutation.mutate({
                      serviceId,
                      reason: unlinkReason.trim(),
                    })
                  }
                  disabled={
                    unlinkMutation.isPending || unlinkReason.trim().length < 10
                  }
                  style={{ background: "#B91C1C", color: "#fff" }}
                >
                  {unlinkMutation.isPending ? (
                    <Loader2 size={14} className="mr-1 animate-spin" />
                  ) : (
                    <Unlink size={14} className="mr-1" />
                  )}
                  Confirmar desvinculación
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="jsm-space-mode-title"
      style={{
        background: "#fff",
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        padding: "20px 24px",
        marginBottom: 16,
      }}
    >
      <div>
        <h3
          id="jsm-space-mode-title"
          style={{ fontSize: 14, fontWeight: 800, color: C.navy }}
        >
          Configurar Space JSM
        </h3>
        <p style={{ marginTop: 4, fontSize: 12, color: C.textSecondary }}>
          Elija entre crear un Space nuevo o asociar un Service Desk que ya
          existe. Seleccionar una opción no ejecuta cambios.
        </p>
      </div>

      {!canManage ? (
        <div
          style={{
            marginTop: 14,
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            padding: "12px 14px",
            borderRadius: 9,
            border: `1px solid ${C.border}`,
            background: "#F8FAFC",
            color: C.textSecondary,
            fontSize: 12,
          }}
        >
          <Lock size={16} style={{ flexShrink: 0 }} />
          <span>
            Acceso de solo lectura. Un usuario Admin o PMO debe crear o vincular
            el Space JSM.
          </span>
        </div>
      ) : !isActive ? (
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: 9,
            border: "1px solid #FDE68A",
            background: "#FFFBEB",
            color: "#92400E",
            fontSize: 12,
          }}
        >
          La etapa JSM Setup no está en progreso. La configuración permanece en
          modo de consulta.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
              gap: 12,
              marginTop: 16,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setMode("create");
                resetLinkFlow();
              }}
              aria-pressed={mode === "create"}
              style={{
                textAlign: "left",
                borderRadius: 10,
                border: `2px solid ${mode === "create" ? C.accent : C.border}`,
                background: mode === "create" ? "#EFF6FF" : "#fff",
                padding: 16,
                cursor: "pointer",
              }}
            >
              <Plus size={18} color={C.accent} />
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.textPrimary,
                }}
              >
                Crear nuevo Space
              </div>
              <div
                style={{ marginTop: 3, fontSize: 11, color: C.textSecondary }}
              >
                Crear un proyecto nuevo en el tenant JSM de Prodigio.
              </div>
            </button>
            <button
              type="button"
              onClick={() => setMode("link")}
              aria-pressed={mode === "link"}
              style={{
                textAlign: "left",
                borderRadius: 10,
                border: `2px solid ${mode === "link" ? "#7C3AED" : C.border}`,
                background: mode === "link" ? "#F5F3FF" : "#fff",
                padding: 16,
                cursor: "pointer",
              }}
            >
              <Link2 size={18} color="#7C3AED" />
              <div
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.textPrimary,
                }}
              >
                Vincular Space existente
              </div>
              <div
                style={{ marginTop: 3, fontSize: 11, color: C.textSecondary }}
              >
                Buscar y diagnosticar un Service Desk sin modificar Jira/JSM.
              </div>
            </button>
          </div>

          {mode === "create" && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 10,
                border: "1px solid #BFDBFE",
                background: "#EFF6FF",
                padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: 12, color: "#1E3A8A" }}>
                La creación sí realizará una escritura en Jira/JSM. Revise el
                nombre y la clave antes de confirmar en el diálogo siguiente.
              </p>
              <Button
                size="sm"
                onClick={onCreateNew}
                style={{ marginTop: 10, background: C.accent, color: "#fff" }}
              >
                <Plus size={14} className="mr-1" /> Abrir creación de Space
              </Button>
            </div>
          )}

          {mode === "link" && (
            <div style={{ marginTop: 16 }}>
              <div style={{ position: "relative" }}>
                <Search
                  size={15}
                  color={C.textMuted}
                  style={{
                    position: "absolute",
                    left: 11,
                    top: "50%",
                    transform: "translateY(-50%)",
                  }}
                />
                <Input
                  value={search}
                  onChange={event => {
                    setSearch(event.target.value);
                    setSelected(null);
                    setPreflight(null);
                  }}
                  placeholder="Buscar por nombre, key, Project ID o Service Desk ID"
                  aria-label="Buscar Spaces JSM existentes"
                  style={{ paddingLeft: 34 }}
                />
              </div>

              <div
                style={{
                  marginTop: 10,
                  maxHeight: 300,
                  overflowY: "auto",
                  display: "grid",
                  gap: 7,
                }}
              >
                {catalogQuery.isLoading ? (
                  <div
                    style={{
                      padding: 28,
                      textAlign: "center",
                      color: C.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    <Loader2 size={18} className="mr-2 inline animate-spin" />
                    Consultando Service Desks mediante lectura segura…
                  </div>
                ) : catalogQuery.error ? (
                  <div
                    role="alert"
                    style={{
                      borderRadius: 9,
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      padding: "12px 14px",
                      color: "#991B1B",
                      fontSize: 12,
                    }}
                  >
                    <div>{catalogQuery.error.message}</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => catalogQuery.refetch()}
                      style={{ marginTop: 8 }}
                    >
                      <RefreshCw size={13} className="mr-1" /> Reintentar
                    </Button>
                  </div>
                ) : !catalogQuery.data?.items.length ? (
                  <div
                    style={{
                      padding: 28,
                      textAlign: "center",
                      borderRadius: 9,
                      border: `1px dashed ${C.border}`,
                      color: C.textSecondary,
                      fontSize: 12,
                    }}
                  >
                    No se encontraron Service Desks para esta búsqueda.
                  </div>
                ) : (
                  catalogQuery.data.items.map(candidate => {
                    const item = candidate as Candidate;
                    const isSelected = selected?.id === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => selectCandidate(item)}
                        aria-pressed={isSelected}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          width: "100%",
                          textAlign: "left",
                          borderRadius: 9,
                          border: `1px solid ${
                            isSelected ? "#A78BFA" : C.border
                          }`,
                          background: isSelected ? "#F5F3FF" : "#fff",
                          padding: "10px 12px",
                          cursor: "pointer",
                        }}
                      >
                        <span
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 8,
                            background: "#EDE9FE",
                            color: "#6D28D9",
                            display: "grid",
                            placeItems: "center",
                            fontSize: 11,
                            fontWeight: 800,
                          }}
                        >
                          {item.projectKey.slice(0, 2)}
                        </span>
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 12,
                              fontWeight: 750,
                              color: C.textPrimary,
                            }}
                          >
                            {item.projectName}
                          </span>
                          <span
                            style={{
                              display: "block",
                              marginTop: 2,
                              fontSize: 10,
                              color: C.textSecondary,
                            }}
                          >
                            {item.projectKey} · Project {item.projectId} · Desk{" "}
                            {item.id}
                          </span>
                        </span>
                        {item.linkedService && (
                          <span
                            style={{
                              maxWidth: 210,
                              borderRadius: 999,
                              background: "#FEF2F2",
                              color: "#991B1B",
                              padding: "4px 8px",
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            Vinculado a {item.linkedService.serviceName}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {selected && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    border: "1px solid #DDD6FE",
                    background: "#FAFAFF",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 800,
                          color: C.textPrimary,
                        }}
                      >
                        {selected.projectName}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontSize: 10,
                          color: C.textSecondary,
                        }}
                      >
                        {selected.projectKey} · Service Desk {selected.id}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        preflightMutation.mutate({
                          serviceId,
                          serviceDeskId: selected.id,
                        })
                      }
                      disabled={preflightMutation.isPending}
                    >
                      {preflightMutation.isPending ? (
                        <Loader2 size={14} className="mr-1 animate-spin" />
                      ) : (
                        <ShieldCheck size={14} className="mr-1" />
                      )}
                      Ejecutar preflight
                    </Button>
                  </div>

                  {preflight && <PreflightSummary preflight={preflight} />}

                  {preflight && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        marginTop: 12,
                        paddingTop: 12,
                        borderTop: `1px solid ${C.border}`,
                        flexWrap: "wrap",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          color: C.textSecondary,
                          maxWidth: 480,
                        }}
                      >
                        Confirmar volverá a leer Jira/JSM. Solo se guardará el
                        vínculo en PMO si el diagnóstico no cambió; no se
                        importarán tickets ni se cerrará la etapa.
                      </p>
                      <Button
                        size="sm"
                        onClick={() =>
                          linkMutation.mutate({
                            serviceId,
                            preflightRunId: preflight.runId,
                          })
                        }
                        disabled={
                          !canConfirmExistingJsmLink({
                            canManage,
                            runId: preflight.runId,
                            canLink: preflight.preflight.canLink,
                            isPending: linkMutation.isPending,
                          })
                        }
                        style={{
                          background: preflight.preflight.canLink
                            ? "#7C3AED"
                            : "#CBD5E1",
                          color: "#fff",
                        }}
                      >
                        {linkMutation.isPending ? (
                          <Loader2 size={14} className="mr-1 animate-spin" />
                        ) : (
                          <Link2 size={14} className="mr-1" />
                        )}
                        Confirmar vínculo
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PreflightSummary({ preflight }: { preflight: PreflightResult }) {
  const presentation = getJsmPreflightPresentation(
    preflight.preflight.status as JsmPreflightStatus
  );
  const colors = statusColors(presentation.tone);
  const snapshot = preflight.preflight.snapshot;
  return (
    <div style={{ marginTop: 12 }} aria-live="polite">
      <div
        style={{
          borderRadius: 9,
          border: `1px solid ${colors.border}`,
          background: colors.background,
          padding: "10px 12px",
          color: colors.color,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            fontSize: 12,
            fontWeight: 800,
          }}
        >
          {preflight.preflight.canLink ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {presentation.label}
          {preflight.reused && (
            <span style={{ marginLeft: "auto", fontSize: 9 }}>
              DIAGNÓSTICO REUTILIZADO
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: 8,
          marginTop: 9,
        }}
      >
        {[
          ["Tipo de proyecto", snapshot.projectTypeKey],
          ["Navegar", snapshot.canBrowseProject ? "Permitido" : "Bloqueado"],
          [
            "Crear issues",
            snapshot.canCreateIssues ? "Permitido" : "Bloqueado",
          ],
          ["Tipos disponibles", String(snapshot.issueTypes.length)],
        ].map(([label, value]) => (
          <div
            key={label}
            style={{
              border: `1px solid ${C.border}`,
              borderRadius: 8,
              background: "#fff",
              padding: "8px 10px",
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: ".06em",
                color: C.textMuted,
              }}
            >
              {label}
            </div>
            <div
              style={{
                marginTop: 3,
                fontSize: 11,
                fontWeight: 650,
                color: C.textPrimary,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {preflight.preflight.blockers.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: 9,
            borderRadius: 8,
            border: "1px solid #FECACA",
            background: "#FEF2F2",
            color: "#991B1B",
            padding: "9px 11px",
            fontSize: 11,
          }}
        >
          <strong>Bloqueos</strong>
          {preflight.preflight.blockers.map(blocker => (
            <div key={blocker} style={{ marginTop: 3 }}>
              • {blocker}
            </div>
          ))}
        </div>
      )}
      {preflight.preflight.warnings.length > 0 && (
        <div
          style={{
            marginTop: 9,
            borderRadius: 8,
            border: "1px solid #FDE68A",
            background: "#FFFBEB",
            color: "#92400E",
            padding: "9px 11px",
            fontSize: 11,
          }}
        >
          <strong>Advertencias</strong>
          {preflight.preflight.warnings.map(warning => (
            <div key={warning} style={{ marginTop: 3 }}>
              • {warning}
            </div>
          ))}
        </div>
      )}
      <div
        style={{
          marginTop: 9,
          display: "flex",
          gap: 6,
          alignItems: "center",
          color: "#475569",
          fontSize: 10,
        }}
      >
        <ShieldCheck size={13} color={C.green} /> Preflight GET-only · no se
        modificó Jira/JSM · corrida {preflight.runId}
      </div>
    </div>
  );
}
