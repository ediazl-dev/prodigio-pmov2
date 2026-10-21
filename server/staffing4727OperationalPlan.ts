/**
 * Matriz operacional contractual de Staffing Deal 4727.
 *
 * Este módulo es deliberadamente puro: no consulta la base de datos, Jira ni
 * agenda automatizaciones.  Los 24 controles observados se versionan sin
 * cambiar su identidad; las únicas altas de matriz son las dos definiciones
 * quincenales exigidas por el SoW (12 períodos en total).
 */

export const STAFFING4727_SERVICE_ID = 2070001 as const;
export const STAFFING4727_DEAL_ID = "4727" as const;
export const STAFFING4727_MATRIX_VERSION =
  "staffing4727-operational-v1-2026-10-21" as const;

export type Staffing4727ItemType = "informe_mensual" | "tarea_programada";
export type Staffing4727Source = "existing_control" | "contractual_definition";

export type Staffing4727OperationalItem = {
  /** Existing PMO work-plan id; undefined until the supplemental row is inserted. */
  workPlanId?: number;
  /** Stable key used by the resumable activation script before a DB id exists. */
  stableKey: string;
  source: Staffing4727Source;
  itemType: Staffing4727ItemType;
  title: string;
  description: string;
  clause: string;
  period: string;
  monthNumber: number;
  role: string;
  frequency: "mensual" | "quincenal";
  dueDate: string | null;
  observedDueDate: string | null;
  dueDateClassification: string;
  status: "pendiente";
  sortOrder: number;
};

type ExistingControlSeed = Staffing4727OperationalItem & {
  workPlanId: number;
  stableKey: `control-${number}`;
  source: "existing_control";
};

const PERIODS = [
  {
    monthNumber: 1,
    period: "M01",
    reportObjective: "2026-08-05",
    approvalObjective: "2026-08-10",
  },
  {
    monthNumber: 2,
    period: "M02",
    reportObjective: "2026-09-04",
    approvalObjective: "2026-09-09",
  },
  {
    monthNumber: 3,
    period: "M03",
    reportObjective: "2026-10-06",
    approvalObjective: "2026-10-09",
  },
  {
    monthNumber: 4,
    period: "M04",
    reportObjective: "2026-11-04",
    approvalObjective: "2026-11-09",
  },
  {
    monthNumber: 5,
    period: "M05",
    reportObjective: "2026-12-04",
    approvalObjective: "2026-12-10",
  },
  {
    monthNumber: 6,
    period: "M06",
    reportObjective: "2027-01-06",
    approvalObjective: "2027-01-11",
  },
] as const;

const CONTROL_TEMPLATES = [
  {
    offset: 0,
    itemType: "tarea_programada" as const,
    title: "Consolidar horas y capacidad",
    clause: "SoW 2.2; 2.4; 3",
    role: "Cliente dirige y prioriza; Proveedor registra horas y capacidad para gobierno operativo; persona no individualizada.",
    description: (period: string, objective: string) =>
      `Matriz contractual ${STAFFING4727_MATRIX_VERSION}. Consolidar actividades asignadas por Consalud y horas/capacidad del Arquitecto de Soluciones Senior durante ${period}. SoW 2.2, 2.4 y 3. Rol: Cliente para dirección y priorización; Proveedor para registro y gobierno. La fecha ${objective} es objetivo observado del plan, no evidencia de consumo ni baseline contractual.`,
  },
  {
    offset: 1,
    itemType: "informe_mensual" as const,
    title: "Reporte Mensual de Servicio",
    clause: "SoW 2.2; 5.1",
    role: "Proveedor: Prodigio Tech / Focal Point del servicio; nombre de persona no inferido.",
    description: (period: string, objective: string) =>
      `Matriz contractual ${STAFFING4727_MATRIX_VERSION}. Entregar el Reporte Mensual de Servicio de ${period} con actividades y horas consumidas dentro de los primeros 3 días hábiles del período siguiente. SoW 2.2 y 5.1. Rol: Proveedor / Focal Point, sin asignar una persona. La fecha ${objective} es una fecha objetivo observada; no acredita recepción ni entrega real.`,
  },
  {
    offset: 2,
    itemType: "tarea_programada" as const,
    title: "Revisión y aprobación del reporte",
    clause: "SoW 2.2; 5.2; 6.2",
    role: "Cliente: contraparte por designar; la recepción formal y la aprobación real permanecen pendientes.",
    description: (_period: string, objective: string) =>
      `Matriz contractual ${STAFFING4727_MATRIX_VERSION}. Registrar observaciones o aprobación del Reporte Mensual sólo dentro de 3 días hábiles desde su recepción formal, conforme SoW 2.2, 5.2 y 6.2. Rol: Cliente, contraparte por designar. La recepción formal no está evidenciada; por eso dueDate queda null. ${objective} se conserva sólo como objetivo observado del plan y no prueba recepción, aceptación ni cumplimiento histórico.`,
  },
  {
    offset: 3,
    itemType: "tarea_programada" as const,
    title: "Feedback de servicio",
    clause: "SoW 2.5; 5.2",
    role: "Cliente: contraparte por designar; Proveedor emite la encuesta mensual; nombres no inferidos.",
    description: (period: string, objective: string) =>
      `Matriz contractual ${STAFFING4727_MATRIX_VERSION}. Registrar feedback o respuesta de evaluación mensual del servicio de ${period}, conforme SoW 2.5 y 5.2. Rol: Cliente, contraparte por designar; Proveedor emite la encuesta. Es un control de calidad y mejora continua, no una agenda de soporte. La fecha ${objective} se conserva como objetivo observado y no acredita ejecución ni evidencia pasada.`,
  },
] as const;

const existingControls: ExistingControlSeed[] = PERIODS.flatMap(period =>
  CONTROL_TEMPLATES.map(template => {
    const isApproval = template.offset === 2;
    const observedDueDate = isApproval
      ? period.approvalObjective
      : period.reportObjective;
    const id = 420000 + (period.monthNumber - 1) * 4 + template.offset + 1;
    return {
      workPlanId: id,
      stableKey: `control-${id}` as `control-${number}`,
      source: "existing_control" as const,
      itemType: template.itemType,
      title: `${template.title} · Mes ${period.monthNumber}`,
      description: template.description(period.period, observedDueDate),
      clause: template.clause,
      period: period.period,
      monthNumber: period.monthNumber,
      role: template.role,
      frequency: "mensual" as const,
      // Approval dates are derived from a missing receipt date and must not be used as a baseline.
      dueDate: isApproval ? null : observedDueDate,
      observedDueDate,
      dueDateClassification: isApproval
        ? "aceptación desde recepción formal pendiente; fecha observada conservada sólo como objetivo de plan"
        : "fecha objetivo observada del plan; no acredita entrega, consumo o cumplimiento",
      status: "pendiente" as const,
      sortOrder: (period.monthNumber - 1) * 4 + template.offset,
    };
  })
);

const supplementalDefinitions: Staffing4727OperationalItem[] = [
  {
    stableKey: "definition-1on1-quincenal",
    source: "contractual_definition",
    itemType: "tarea_programada",
    title:
      "Sesión interna 1-on-1 quincenal de seguimiento del talento · M01–M06",
    description: `Definición contractual ${STAFFING4727_MATRIX_VERSION}; stableKey=definition-1on1-quincenal. Sesión interna quincenal de seguimiento del talento durante M01–M06, derivada de la mitigación de desalineación del SoW 3. Rol: Focal Point de Prodigio Tech y talento asignado, sin nombres inventados. Es coordinación interna y nunca un portal de atención al cliente. No se inventa agenda histórica; dueDate queda null.`,
    clause: "SoW 3; mitigación de riesgo de desalineación",
    period: "M01–M06",
    monthNumber: 1,
    role: "Proveedor: Focal Point y talento asignado; persona no individualizada.",
    frequency: "quincenal",
    dueDate: null,
    observedDueDate: null,
    dueDateClassification:
      "cadencia contractual quincenal sin fecha individual histórica",
    status: "pendiente",
    sortOrder: 24,
  },
  {
    stableKey: "definition-burn-rate-quincenal",
    source: "contractual_definition",
    itemType: "tarea_programada",
    title:
      "Monitoreo quincenal de burn-rate y alerta de subutilización · M01–M06",
    description: `Definición contractual ${STAFFING4727_MATRIX_VERSION}; stableKey=definition-burn-rate-quincenal. Monitorear quincenalmente el burn-rate y consumo exacto de horas durante M01–M06; si se observa subutilización, emitir alerta formal a líderes de gestión del Cliente, según SoW 3. Rol: Focal Point de Prodigio Tech; líderes del Cliente sin nombres inferidos. No se inventa agenda histórica; dueDate queda null.`,
    clause: "SoW 3; mitigación de riesgo de subutilización",
    period: "M01–M06",
    monthNumber: 1,
    role: "Proveedor: Focal Point; alerta formal al Cliente, sin responsables nominales inventados.",
    frequency: "quincenal",
    dueDate: null,
    observedDueDate: null,
    dueDateClassification:
      "cadencia contractual quincenal sin fecha individual histórica",
    status: "pendiente",
    sortOrder: 25,
  },
];

const readinessControls: Staffing4727OperationalItem[] = [
  [
    "READINESS-OC",
    "Recepción de Orden de Compra antes del inicio",
    "SoW 2.4",
    "Preinicio",
    "Cliente o partes según SoW; persona no confirmada.",
    "La OC debe recibirse antes del inicio; estado pendiente y dueDate null, sin inventar fecha ni acreditar cumplimiento pasado.",
  ],
  [
    "READINESS-FIRMA",
    "Firma digital Adobe Sign de ambas partes",
    "SoW 1; 4.3; 7",
    "Preinicio",
    "Cliente o partes según SoW; personas y fechas no confirmadas.",
    "Formalizar el SoW mediante firmas electrónicas cruzadas y vinculantes. Los campos de firma no tienen fecha; dueDate null y no se acredita firma histórica.",
  ],
  [
    "READINESS-INICIO",
    "Fijar fecha oficial de inicio",
    "SoW 1",
    "Vigencia",
    "Cliente o partes según SoW; fecha real no confirmada.",
    "Fijar el inicio oficial conforme a OC y firma completada. Las fechas PMO observadas no son baseline contractual; dueDate null.",
  ],
  [
    "READINESS-ACCESOS",
    "Ambientes, credenciales, VPN, repositorios y herramientas disponibles",
    "SoW 2.4; 3",
    "Preinicio/primer día",
    "Cliente o partes según SoW; persona no confirmada.",
    "Verificar ambientes, accesos, credenciales, VPN, repositorios y herramientas, con aprovisionamiento/pruebas al menos 5 días hábiles antes del inicio oficial. Evidencia pendiente; dueDate null.",
  ],
  [
    "READINESS-CONTRAPARTES",
    "Designar Líder Técnico y Responsable del Contrato",
    "SoW 2.5",
    "Vigencia",
    "Cliente o partes según SoW; nombres no confirmados.",
    "Designar las contrapartes efectivas para dirección técnica y gestión contractual. Los nombres de firmas no prueban designación; dueDate null.",
  ],
].map(([stableKey, title, clause, period, role, description], index) => ({
  stableKey,
  source: "contractual_definition" as const,
  itemType: "tarea_programada" as const,
  title,
  description: `${description} Matriz contractual ${STAFFING4727_MATRIX_VERSION}; stableKey=${stableKey}. Este control es condicional al SoW y permanece pendiente hasta contar con evidencia.`,
  clause,
  period,
  monthNumber: 1,
  role,
  frequency: "mensual" as const,
  dueDate: null,
  observedDueDate: null,
  dueDateClassification:
    "condicionado por evidencia SoW pendiente; sin fecha inventada",
  status: "pendiente" as const,
  sortOrder: 26 + index,
}));

const supplementalOperationalItems = [
  ...supplementalDefinitions,
  ...readinessControls,
];

/**
 * Retorna la matriz canónica. El argumento opcional permite a la capa de
 * activación asociar los ids que la base de datos haya generado para las dos
 * definiciones nuevas sin que este módulo conozca Drizzle.
 */
export function buildStaffing4727OperationalPlan(
  supplementalIds: Partial<Record<string, number>> = {}
): Staffing4727OperationalItem[] {
  return [
    ...existingControls.map(item => ({ ...item })),
    ...supplementalOperationalItems.map(item => ({
      ...item,
      workPlanId: supplementalIds[item.stableKey],
    })),
  ];
}

export const STAFFING4727_EXISTING_CONTROL_IDS = existingControls.map(
  item => item.workPlanId
) as readonly number[];
export const STAFFING4727_SUPPLEMENTAL_KEYS = supplementalOperationalItems.map(
  item => item.stableKey
) as readonly string[];
export const STAFFING4727_OPERATIONAL_PLAN_SIZE =
  existingControls.length + supplementalOperationalItems.length;

export function isApprovalControl(
  item: Pick<Staffing4727OperationalItem, "stableKey">
): boolean {
  return (
    item.stableKey === "control-420003" ||
    item.stableKey === "control-420007" ||
    item.stableKey === "control-420011" ||
    item.stableKey === "control-420015" ||
    item.stableKey === "control-420019" ||
    item.stableKey === "control-420023"
  );
}

export function isSupplementalDefinition(
  item: Pick<Staffing4727OperationalItem, "source">
): boolean {
  return item.source === "contractual_definition";
}
