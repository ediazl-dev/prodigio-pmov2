import type {
  JsmLinkHealth,
  JsmPreflightStatus,
} from "@shared/jsmExistingSpace";

export type JsmUiRole = "admin" | "pmo" | "pm" | "consulta" | string;

export function canManageExistingJsmSpace(role?: JsmUiRole | null) {
  return role === "admin" || role === "pmo";
}

const PREFLIGHT_PRESENTATION: Record<
  JsmPreflightStatus,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  ready: { label: "Listo para vincular", tone: "success" },
  already_linked_same_service: {
    label: "Ya vinculado a este servicio",
    tone: "success",
  },
  linked_to_other_service: {
    label: "Vinculado a otro servicio",
    tone: "danger",
  },
  not_service_desk: { label: "No es un Service Desk", tone: "danger" },
  service_desk_not_accessible: {
    label: "Service Desk no accesible",
    tone: "danger",
  },
  missing_create_issue_permission: {
    label: "Sin permiso para crear issues",
    tone: "danger",
  },
  missing_issue_type_mapping: {
    label: "Mappings pendientes",
    tone: "warning",
  },
  archived_or_inactive: {
    label: "Proyecto archivado o inactivo",
    tone: "danger",
  },
  identity_changed: {
    label: "Identidad Jira cambió",
    tone: "danger",
  },
  error: { label: "Error de inspección", tone: "danger" },
};

const HEALTH_PRESENTATION: Record<
  JsmLinkHealth,
  { label: string; foreground: string; background: string; border: string }
> = {
  pending: {
    label: "Pendiente de validar",
    foreground: "#92400E",
    background: "#FFFBEB",
    border: "#FDE68A",
  },
  healthy: {
    label: "Saludable",
    foreground: "#166534",
    background: "#F0FDF4",
    border: "#BBF7D0",
  },
  warning: {
    label: "Con advertencias",
    foreground: "#92400E",
    background: "#FFFBEB",
    border: "#FDE68A",
  },
  blocked: {
    label: "Bloqueado",
    foreground: "#991B1B",
    background: "#FEF2F2",
    border: "#FECACA",
  },
};

export function getJsmPreflightPresentation(status: JsmPreflightStatus) {
  return PREFLIGHT_PRESENTATION[status];
}

export function getJsmHealthPresentation(health?: JsmLinkHealth | null) {
  return HEALTH_PRESENTATION[health ?? "pending"];
}

export function canConfirmExistingJsmLink(input: {
  canManage: boolean;
  runId?: string | null;
  canLink?: boolean;
  isPending?: boolean;
}) {
  return Boolean(
    input.canManage && input.runId && input.canLink && !input.isPending
  );
}
