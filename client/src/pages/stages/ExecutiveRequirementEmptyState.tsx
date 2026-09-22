type GovernanceGapTone = "critical" | "warning" | "neutral";

type GovernanceGapInput = {
  governanceState: string | null | undefined;
  pendingMilestones: number;
  highOpenRisks: number | null;
  activeTriggers: number;
};

type RequirementHeaderInput = {
  governanceState: string | null | undefined;
  totalRequirements: number;
  openRequirements: number;
};

export function buildExecutiveRequirementGapPresentation(input: GovernanceGapInput) {
  const state = String(input.governanceState ?? "POR_CONFIRMAR").toUpperCase();
  const tone: GovernanceGapTone = ["CRITICO", "ROJO"].includes(state)
    ? "critical"
    : ["NARANJO", "AMARILLO"].includes(state)
      ? "warning"
      : "neutral";
  const stateLabel = state === "CRITICO" ? "CRÍTICO" : state.replaceAll("_", " ");
  const signals: string[] = [];

  if (input.pendingMilestones > 0) {
    signals.push(`${input.pendingMilestones} hito(s) contractual(es) pendiente(s) o demorado(s)`);
  }
  if (input.highOpenRisks != null && input.highOpenRisks > 0) {
    signals.push(`${input.highOpenRisks} riesgo(s) alto(s) abierto(s) en Jira`);
  }
  if (input.activeTriggers > 0) {
    signals.push(`${input.activeTriggers} gatillo(s) ejecutivo(s) activo(s)`);
  }

  if (tone === "critical") {
    return {
      tone,
      badge: "BRECHA DE GOBIERNO",
      title: "Brecha de gobierno — sin exigencias formalizadas",
      message: `El proyecto está en estado ${stateLabel}, pero todavía no existen obligaciones de comité registradas con responsable, fecha límite y criterio verificable de cierre. Esto no significa que el proyecto esté conforme.`,
      signals,
    };
  }

  if (tone === "warning") {
    return {
      tone,
      badge: "REVISIÓN PENDIENTE",
      title: "Revisión de gobierno pendiente",
      message: `El proyecto está en estado ${stateLabel} y aún no existen exigencias de comité formalizadas. Debe revisarse si las señales observadas requieren una obligación ejecutiva con dueño, plazo y criterio de cierre.`,
      signals,
    };
  }

  return {
    tone,
    badge: "0 FORMALIZADAS",
    title: "Sin exigencias de comité formalizadas",
    message: "No existen obligaciones extraordinarias de comité registradas para este corte. Este dato no acredita cumplimiento ni reemplaza la revisión de hitos, riesgos, backlog o compromisos.",
    signals,
  };
}

export function getExecutiveRequirementsHeaderTag(input: RequirementHeaderInput) {
  if (input.totalRequirements === 0) {
    return buildExecutiveRequirementGapPresentation({
      governanceState: input.governanceState,
      pendingMilestones: 0,
      highOpenRisks: null,
      activeTriggers: 0,
    }).badge;
  }
  if (input.openRequirements > 0) return `${input.openRequirements} abierta(s)`;
  const terminalRequirements = Math.max(0, input.totalRequirements - input.openRequirements);
  return `${terminalRequirements} cerrada(s) · 0 abiertas`;
}

export function ExecutiveRequirementsStatusBanner({
  governanceState,
  totalRequirements,
  openRequirements,
  pendingMilestones,
  highOpenRisks,
  activeTriggers,
}: GovernanceGapInput & { totalRequirements: number; openRequirements: number }) {
  if (totalRequirements > 0) {
    return <div className="edv2-sla">
      <strong>{openRequirements} abierta(s)</strong>
      <p>{openRequirements > 0
        ? <><b>Exigencias ejecutivas activas.</b> Requieren dueño, fecha límite, criterio de aceptación y evidencia de cierre.</>
        : <><b>Sin exigencias abiertas.</b> Existen {totalRequirements} registro(s) terminal(es); esto no acredita por sí solo la conformidad del proyecto.</>}</p>
    </div>;
  }

  const presentation = buildExecutiveRequirementGapPresentation({
    governanceState,
    pendingMilestones,
    highOpenRisks,
    activeTriggers,
  });
  const critical = presentation.tone === "critical";
  const border = critical ? "#E5484D" : presentation.tone === "warning" ? "#F5A524" : "#7E8896";
  const background = critical ? "rgba(229,72,77,.14)" : presentation.tone === "warning" ? "rgba(245,165,36,.10)" : "rgba(126,136,150,.10)";

  return <div className="edv2-sla" role={critical ? "alert" : "status"} style={{ borderColor: border, borderLeftColor: border, background }}>
    <strong style={{ color: border }}>{presentation.badge}</strong>
    <p><b>{presentation.title}.</b> {presentation.message}{presentation.signals.length > 0 ? <> Señales observadas: {presentation.signals.join(" · ")}.</> : null} <a href="#exigencias" style={{ color: "#FFFFFF", fontWeight: 700 }}>Revisar en Exigencias</a></p>
  </div>;
}

export function ExecutiveRequirementEmptyState({
  governanceState,
  pendingMilestones,
  highOpenRisks,
  activeTriggers,
  canManage,
  onOpenRequirementForm,
}: GovernanceGapInput & {
  canManage: boolean;
  onOpenRequirementForm: () => void;
}) {
  const presentation = buildExecutiveRequirementGapPresentation({
    governanceState,
    pendingMilestones,
    highOpenRisks,
    activeTriggers,
  });
  const palette = presentation.tone === "critical"
    ? { border: "#E5484D", background: "#FEF1F2", badge: "#A8272B" }
    : presentation.tone === "warning"
      ? { border: "#F5A524", background: "#FFF8E8", badge: "#875B09" }
      : { border: "#7E8896", background: "#F6F8FA", badge: "#5A6472" };

  return <div
    role={presentation.tone === "critical" ? "alert" : "status"}
    style={{ borderLeft: `4px solid ${palette.border}`, background: palette.background, padding: 18, color: "#0D1117" }}
  >
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <div>
        <b style={{ display: "block", fontSize: 14 }}>{presentation.title}</b>
        <p style={{ margin: "7px 0 0", fontSize: 12, lineHeight: 1.55, color: "#5A6472" }}>{presentation.message}</p>
      </div>
      <span style={{ border: `1px solid ${palette.border}`, borderRadius: 999, padding: "4px 8px", color: palette.badge, fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 800, letterSpacing: ".08em" }}>{presentation.badge}</span>
    </div>
    {presentation.signals.length > 0
      ? <p style={{ margin: "12px 0 0", fontSize: 11.5, lineHeight: 1.5 }}><b>Señales que requieren revisión:</b> {presentation.signals.join(" · ")}.</p>
      : <p style={{ margin: "12px 0 0", fontSize: 11.5, lineHeight: 1.5 }}><b>Revisión necesaria:</b> la ausencia de exigencias no debe interpretarse como ausencia de exposición.</p>}
    <p style={{ margin: "8px 0 0", fontSize: 11, lineHeight: 1.5, color: "#5A6472" }}><b>Alcance del contador:</b> sólo incluye decisiones de comité persistidas; no incluye hitos contractuales, riesgos, backlog, issues Jira ni compromisos.</p>
    {canManage
      ? <button type="button" onClick={onOpenRequirementForm} style={{ marginTop: 13, background: "#0D1117", color: "white", border: 0, borderRadius: 6, padding: "8px 11px", cursor: "pointer", fontWeight: 700 }}>Revisar y formalizar exigencia</button>
      : <p style={{ margin: "10px 0 0", fontSize: 11, color: "#5A6472" }}>La formalización corresponde a un usuario Admin o PMO y requiere una decisión humana de comité.</p>}
  </div>;
}
