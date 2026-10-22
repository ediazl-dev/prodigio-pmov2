/**
 * NEXOS_SFA_Multitenant (proyecto interno 4470001)
 *
 * Pure, non-persistent mapping of the 18 risks from nexos-internal-audit.json.
 * The workbook/manifest is the plan source of truth: 19 activities and gates
 * G1, Infra, G2 and G3. This module deliberately does not call DB or Jira,
 * close stages, save issues, or confirm risks.
 */

export const NEXOS_INTERNAL_PROJECT_ID = 4470001 as const;
export const NEXOS_INTERNAL_RISK_COUNT = 18 as const;

export type NexosInternalRiskInput = {
  id: number;
  projectId: number;
  riskCode: string;
  description: string;
  category: string;
  type: string;
  probability: string;
  impact: string;
  mitigation: string;
  owner: string;
  contingency: string | null;
  dueDate: string | null;
  estimatedCost?: number | null;
  cost?: number | null;
  status: string;
  confirmed: boolean;
  [field: string]: unknown;
};

export type NexosInternalRiskPatch = {
  id: number;
  projectId: typeof NEXOS_INTERNAL_PROJECT_ID;
  riskCode: string;
  description: string;
  mitigation: string;
  contingency: string;
};

const RISK_IDENTITIES = [
  [600003, "R001"], [600004, "R002"], [600005, "R003"],
  [600006, "R004"], [600007, "R005"], [600008, "R006"],
  [600009, "R007"], [600010, "R008"], [600011, "R009"],
  [600012, "R010"], [600013, "R011"], [600014, "R012"],
  [600015, "R013"], [600016, "R014"], [600017, "R015"],
  [600018, "R016"], [600019, "R017"], [600020, "R018"],
] as const;

/**
 * Draft-only corrections. Every entry targets an existing audit row; no new
 * risk, owner, cost, due date, status, or confirmation is introduced here.
 */
export const NEXOS_INTERNAL_RISK_PATCHES: readonly NexosInternalRiskPatch[] = [
  {
    id: 600003, projectId: 4470001, riskCode: "R001",
    description: "El alcance ya cuenta con un plan interno cargado de 19 actividades y cuatro gates (G1, Infra, G2 y G3), pero la especificación multitenant y sus criterios de aceptación aún requieren revisión humana. El riesgo es que se avance con definiciones incompletas y se genere retrabajo entre el mapeo de la spec, la infraestructura de cinco tenants y las olas de despliegue.",
    mitigation: "Preventiva: usar A01 para mapear cada definición multitenant a la spec base; completar A02 con resolución por realm/issuer, tenant-id, aislamiento Bridge/Silo, secretos, telemetría y auditoría segregada; someter A03 a revisión humana en G1 y usar A10/G2 para validar el backlog antes de las olas. Indicador: definición o criterio de aceptación sin evidencia en la matriz de mapeo o en la spec versionada.",
    contingency: "Si G1 o G2 queda pendiente, mantener bloqueadas las actividades dependientes, registrar la brecha en la matriz y reordenar únicamente actividades del plan vigente hasta obtener la revisión correspondiente; no tratar la planificación como alcance aprobado ni iniciar trabajo fuera de las 19 actividades.",
  },
  {
    id: 600004, projectId: 4470001, riskCode: "R002",
    description: "Persisten ambigüedades funcionales y no funcionales que deben resolverse en la spec multitenant y en las specs de Trust, Consent, Connect, Monitor y Admin. El plan sí contiene actividades de especificación y backlog, pero sus entregables están pendientes, por lo que una historia incompleta puede afectar aislamiento, RBAC, auditoría o rendimiento.",
    mitigation: "Preventiva: completar A02, A08 y A09 con criterios verificables por módulo, incluyendo tenant-id, aislamiento, secretos, telemetría, auditoría y RBAC cross-tenant; revisar humanamente en A03/G1 y consolidar las tareas en A10/G2. Indicador: requisito sin criterio de aceptación, dependencia o evidencia de prueba asociada.",
    contingency: "Si una definición llega ambigua, devolverla a la revisión humana y mantenerla fuera de la ola correspondiente hasta que exista criterio y evidencia trazable; registrar el impacto en el backlog vigente sin crear una actividad adicional ni afirmar aprobación.",
  },
  {
    id: 600005, projectId: 4470001, riskCode: "R003",
    description: "El plan explicita dependencias de identidad, gateway, red, certificados, datos de prueba y ambientes integrados (D-04, D-05, D-06, D-11 y D-12), pero su disponibilidad aún no está evidenciada. La falta o demora de estos accesos puede bloquear el plano compartido, el aprovisionamiento de tenants y las pruebas de aislamiento.",
    mitigation: "Preventiva: levantar en A01/A04 la matriz de accesos y dependencias; verificar certificados y material criptográfico antes de A06/A07, y validar los insumos D-11/D-12 antes de las pruebas A12 y A15-A17. Indicador: prerrequisito crítico sin evidencia de disponibilidad o responsable en la matriz.",
    contingency: "Si un prerrequisito no está disponible, pausar la actividad dependiente, documentar el bloqueo y ejecutar sólo trabajo no bloqueado del plan; no sustituir certificados, identidad ni controles de aislamiento por accesos no verificados.",
  },
  {
    id: 600006, projectId: 4470001, riskCode: "R004",
    description: "La complejidad multitenant está concretada en cinco tenants IPI y dos patrones: Bridge con esquemas/RLS y Silo con base de datos, Key Vault y node pool dedicados. El riesgo residual es una decisión de aislamiento o una parametrización IaC incorrecta que produzca fuga de datos, conectividad cruzada, sobrecarga o retrabajo.",
    mitigation: "Preventiva: completar A02 y A04 con decisiones trazables de tenancy; desplegar el plano compartido en A05, los tenants Bridge/Silo en A06 y la réplica Silo en A07; exigir revisión humana en G1 y evidencia de no conectividad en Infra. Indicador: brecha de aislamiento abierta o smoke test fallido.",
    contingency: "Si falla una prueba de aislamiento, detener la ola afectada, aislar el tenant involucrado, corregir spec/IaC y repetir las pruebas negativas antes de continuar; no declarar el gate cumplido ni ampliar el despliegue mientras exista una brecha.",
  },
  {
    id: 600007, projectId: 4470001, riskCode: "R005",
    description: "El plan asigna responsables operativos a las actividades, pero no tiene aprobadores informados para G1, Infra, G2 y G3. La ausencia de una autoridad de decisión explícita puede bloquear la revisión humana de la spec, el avance de infraestructura y el go/no-go interno.",
    mitigation: "Preventiva: documentar en A01 y A03 la matriz de decisión y la evidencia requerida; vincular los responsables ya definidos en el workbook con cada revisión de G1, Infra, G2 y G3, sin alterar el owner de la fila. Indicador: gate pendiente sin decisión o evidencia trazable.",
    contingency: "Si no existe decisión para un gate, conservarlo pendiente, registrar la decisión faltante y escalar por la gobernanza interna existente; no suplir la aprobación con una confirmación automática ni avanzar las actividades que dependan de ella.",
  },
  {
    id: 600008, projectId: 4470001, riskCode: "R006",
    description: "La ejecución depende de revisiones humanas de la spec, de la infraestructura y de las pruebas: G1 exige revisión de la spec, Infra evidencia no conectividad, G2 revisa el backlog y G3 consolida pruebas y hallazgos. La falta de participación oportuna puede detener las olas aunque existan actividades planificadas.",
    mitigation: "Preventiva: calendarizar revisiones de A03, A07, A10 y A19 con checklist y evidencia; mantener trazabilidad entre hallazgos y la decisión del gate. Indicador: revisión pendiente, evidencia incompleta o respuesta fuera de la ventana acordada para un gate.",
    contingency: "Si una revisión no ocurre, mantener el gate pendiente, registrar la ausencia y priorizar trabajo no dependiente; no convertir el silencio en aprobación ni desplegar la siguiente ola por defecto.",
  },
  {
    id: 600009, projectId: 4470001, riskCode: "R007",
    description: "Las dependencias técnicas ya aparecen en el plan: identidad, gateway, red, certificados, contratos API, broker de eventos, observabilidad y ambientes de prueba. El riesgo residual es que un componente o proveedor no esté disponible o sea incompatible con el aislamiento de los cinco tenants.",
    mitigation: "Preventiva: mantener una matriz de dependencias para A04-A07 y A13-A17, verificando contratos API, broker, observabilidad y certificados antes de cada ola; incluir pruebas negativas por realm y silo. Indicador: dependencia crítica sin evidencia, contrato o prueba asociada.",
    contingency: "Si una dependencia falla, registrar el bloqueo, reprogramar la actividad afectada dentro de la secuencia existente y usar sólo componentes o fixtures previamente aislados y autorizados para pruebas; no omitir una prueba de segregación para sostener una fecha.",
  },
  {
    id: 600010, projectId: 4470001, riskCode: "R008",
    description: "El plan sí contempla pruebas por ola y una prueba integral: FAPI y negativas por realm en A12, E2E y negativas cruzadas en A15, RBAC y dashboards sin fuga en A16, y rendimiento con cinco tenants en A17. El riesgo es ejecutar una ola sin cobertura o evidencia suficiente para G3.",
    mitigation: "Preventiva: convertir los entregables A12, A15, A16 y A17 en casos reproducibles con resultados por tenant, realm, silo y RBAC; consolidar hallazgos en A18 y exigirlos para G3. Indicador: caso negativo, evidencia de rendimiento o validación RBAC faltante.",
    contingency: "Si una prueba falla o queda sin evidencia, bloquear el avance del gate y de la siguiente actividad dependiente, corregir el hallazgo mediante A18 y repetir la prueba; no presentar el resultado como aceptación o cierre.",
  },
  {
    id: 600011, projectId: 4470001, riskCode: "R009",
    description: "La deuda técnica ya no se explica por ausencia de un entregable en el plan, pero puede acumularse al implementar la spec multitenant, las olas y los controles de aislamiento. El riesgo es trasladar decisiones incompletas a mantenimiento, hardening o las specs as-built.",
    mitigation: "Preventiva: fijar criterios de calidad y trazabilidad en A02/A03, revisar IaC y segregación en A04-A07, y mantener hallazgos, deuda y evidencias para A18. Indicador: decisión técnica sin justificación, hallazgo repetido o componente sin correspondencia en la spec as-built.",
    contingency: "Si aparece deuda que amenaza aislamiento, seguridad o rendimiento, priorizar su corrección en A18 y mantener la evidencia abierta hasta validación; diferir sólo lo no crítico dentro de la secuencia existente y no ocultar el hallazgo como completado.",
  },
  {
    id: 600012, projectId: 4470001, riskCode: "R010",
    description: "El plan define un plano compartido, tenants Bridge/Silo, ambientes integrados y QA, pero aún debe demostrarse que son replicables y representativos para las cinco configuraciones IPI. La diferencia entre ambientes puede ocultar fugas, errores de RBAC o problemas de rendimiento.",
    mitigation: "Preventiva: verificar en A05-A07 la parametrización por tenant y registrar configuración; preparar D-12 para A15-A17 y comprobar que las pruebas cubren Bridge, Silo y el plano compartido. Indicador: ambiente o tenant sin datos de prueba, configuración comparable o evidencia de segregación.",
    contingency: "Si un ambiente no es reproducible, detener la prueba dependiente, documentar la diferencia y corregir la parametrización IaC o el fixture aislado antes de continuar; no usar un ambiente no comparable como evidencia de G3.",
  },
  {
    id: 600013, projectId: 4470001, riskCode: "R011",
    description: "El workbook define actividades, owners, dependencias y gates, pero no deja cerrados los canales de decisión ni el formato de registro de acuerdos. Esto puede producir instrucciones contradictorias durante la revisión de la spec, la infraestructura, las olas y el go/no-go.",
    mitigation: "Preventiva: usar A01/A03 para fijar matriz de decisiones, registro de cambios y evidencia; referenciar el mismo registro en G1, Infra, G2 y G3. Indicador: decisión sin registro, evidencia o responsable de seguimiento.",
    contingency: "Si aparecen instrucciones contradictorias, pausar la actividad afectada, consolidar una decisión en el registro interno y actualizar la evidencia del gate correspondiente; no continuar por una instrucción informal no trazable.",
  },
  {
    id: 600014, projectId: 4470001, riskCode: "R012",
    description: "Los gates G1, Infra, G2 y G3 tienen criterios y evidencias, pero no tienen fecha real ni aprobador informado y el plan no define un SLA de decisión. Una revisión tardía puede bloquear el camino entre spec, infraestructura, backlog, olas y QA.",
    mitigation: "Preventiva: acordar una ventana de revisión para A03, A07, A10 y A19 y registrar resultado, evidencia y pendientes por gate; usar la matriz de dependencias para anticipar el impacto. Indicador: gate pendiente más allá de su día planificado o sin respuesta trazable.",
    contingency: "Si un gate supera su ventana, mantenerlo pendiente, escalar por la gobernanza interna y reordenar actividades no dependientes; no ejecutar una ola ni marcar aceptación para compensar el retraso.",
  },
  {
    id: 600015, projectId: 4470001, riskCode: "R013",
    description: "El proyecto interno se ejecuta en olas (Trust, Consent/Connect y Monitor/Admin) sobre una base multitenant común. Un cambio de prioridad puede interrumpir la secuencia, reducir la capacidad disponible o dejar una combinación de módulos sin las pruebas de aislamiento requeridas.",
    mitigation: "Preventiva: usar A10/G2 para ordenar el backlog por dependencia y A11-A17 para mantener trazabilidad de cada ola y sus pruebas; revisar el impacto sobre cinco tenants, RBAC y rendimiento antes de reordenar. Indicador: actividad priorizada sin dependencia resuelta o ola sin cobertura de pruebas.",
    contingency: "Si cambia la prioridad, re-secuenciar sólo actividades del plan vigente, conservar las pruebas negativas y registrar el impacto de capacidad; no eliminar controles de aislamiento ni declarar completada una ola parcialmente ejecutada.",
  },
  {
    id: 600016, projectId: 4470001, riskCode: "R014",
    description: "El plan nombra owners para las 19 actividades, pero no documenta backups ni cobertura de capacidad para roles críticos. Una ausencia puede detener la revisión humana, la parametrización IaC, las pruebas o la sincronización de specs as-built.",
    mitigation: "Preventiva: incorporar una matriz de cobertura y transferencia en A01/A10, manteniendo los owners del workbook; revisar cobertura antes de A04-A07, las olas y A18-A19. Indicador: actividad crítica sin cobertura o conocimiento mínimo documentado.",
    contingency: "Si falta cobertura, pausar la actividad crítica, registrar la brecha y reordenar tareas no dependientes hasta documentar la transferencia; no inventar un owner ni marcar la actividad como ejecutada.",
  },
  {
    id: 600017, projectId: 4470001, riskCode: "R015",
    description: "El plan enumera componentes con impacto potencial de costo y capacidad —AKS, APIM, Redis, Service Bus/Event Hub, observabilidad, bases y recursos Silo dedicados—, pero no trae una línea base de costos ni consumo por tenant. La incertidumbre puede forzar rediseño o limitar la capacidad de cinco tenants.",
    mitigation: "Preventiva: levantar en A04-A07 los supuestos de capacidad y costo de plano compartido, Bridge y Silo; contrastarlos con A17 y con la decisión G2 antes de comprometer la secuencia técnica. Indicador: componente o tenant sin supuesto de capacidad/costo o sin criterio de escalamiento.",
    contingency: "Si la capacidad o el costo exceden los supuestos internos, documentar el escenario, ajustar la parametrización o la secuencia dentro del plan y someter la decisión a revisión humana; no asignar costo cero ni introducir servicios no descritos como hechos.",
  },
  {
    id: 600018, projectId: 4470001, riskCode: "R016",
    description: "El plan ahora hace visibles 19 actividades, dependencias y cuatro gates, pero la cadena puede seguir teniendo cuellos de botella: spec y G1, certificados e Infra, backlog y G2, y pruebas integrales antes de G3. Un recurso o prerrequisito único puede retrasar varias olas.",
    mitigation: "Preventiva: mantener la matriz de dependencias de A01-A19, identificar tareas críticas y revisar el estado en cada gate; proteger especialmente D-06, D-11 y D-12 y las evidencias de aislamiento. Indicador: dependencia crítica sin evidencia o actividad de camino crítico sin cobertura.",
    contingency: "Si se identifica un cuello de botella, registrar el impacto y reordenar actividades paralelas no dependientes dentro de los 15 días del plan; mantener pendientes las actividades bloqueadas y no ocultar un retraso cambiando su estado.",
  },
  {
    id: 600019, projectId: 4470001, riskCode: "R017",
    description: "La aceptación interna no debe depender de una firma no programada: A19 y G3 requieren reportes de pruebas integrales, hallazgos críticos cerrados, specs as-built, runbook y una decisión go/no-go. El riesgo es tratar evidencia incompleta como aceptación o cierre del trabajo.",
    mitigation: "Preventiva: preparar desde A12-A18 el paquete de evidencias, trazabilidad de hallazgos y criterios de G3; usar A19 para revisar runbook, ascenso Bridge→Silo y decisión go/no-go. Indicador: evidencia crítica o decisión pendiente al llegar al día planificado de G3.",
    contingency: "Si la evidencia o el go/no-go están incompletos, conservar G3 pendiente, registrar las brechas y completar la evidencia dentro de la secuencia autorizada; no representar el trabajo como aceptado, cerrado o aprobado.",
  },
  {
    id: 600020, projectId: 4470001, riskCode: "R018",
    description: "El plan asigna owners, pero no contiene una matriz de FTE, capacidad ni cobertura para sostener specs, infraestructura, cinco tenants, olas y testing. La falta de capacidad real puede provocar ejecución parcial, acumulación de defectos o presión para omitir controles.",
    mitigation: "Preventiva: completar en A01/A10 una matriz de capacidad por actividad, ola y tenant; contrastarla con la carga de A12 y A15-A17 y con el hardening A18, sin cambiar los owners del audit. Indicador: actividad crítica sin capacidad disponible o pruebas reducidas por falta de cobertura.",
    contingency: "Si la capacidad resulta insuficiente, re-secuenciar actividades no dependientes y hacer visible la brecha antes de la siguiente ola; conservar las pruebas de aislamiento, RBAC y rendimiento, sin crear owners ficticios ni asumir costo cero.",
  },
] as const;

const PATCH_BY_CODE = new Map(NEXOS_INTERNAL_RISK_PATCHES.map((patch) => [patch.riskCode, patch]));

function assertExpectedRiskSet(risks: readonly NexosInternalRiskInput[]): void {
  if (risks.length !== NEXOS_INTERNAL_RISK_COUNT) {
    throw new Error(`Se esperaban ${NEXOS_INTERNAL_RISK_COUNT} riesgos existentes`);
  }
  const seen = new Set<string>();
  for (const risk of risks) {
    const expected = RISK_IDENTITIES.find(([id, code]) => id === risk.id && code === risk.riskCode);
    if (!expected || risk.projectId !== NEXOS_INTERNAL_PROJECT_ID || seen.has(risk.riskCode)) {
      throw new Error(`Conjunto de riesgos NEXOS inválido: ${risk.id}/${risk.riskCode}`);
    }
    seen.add(risk.riskCode);
  }
}

/** Pure map: returns new rows and leaves the audit input untouched. */
export function mapNexosInternalRiskPlan<T extends NexosInternalRiskInput>(risks: readonly T[]): T[] {
  assertExpectedRiskSet(risks);
  return risks.map((risk) => {
    const patch = PATCH_BY_CODE.get(risk.riskCode);
    if (!patch) throw new Error(`No existe patch para ${risk.riskCode}`);
    return {
      ...risk,
      // Only these three mutable risk-text fields are corrected.
      description: patch.description,
      mitigation: patch.mitigation,
      contingency: patch.contingency,
    } as T;
  });
}

/** Flat patch payload for a parent caller that will show drafts in Jira. */
export function getNexosInternalRiskPatches(): readonly NexosInternalRiskPatch[] {
  return NEXOS_INTERNAL_RISK_PATCHES;
}
