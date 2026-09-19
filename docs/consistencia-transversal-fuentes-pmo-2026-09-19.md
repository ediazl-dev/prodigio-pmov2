# Consistencia transversal de fuentes PMO, Jira y finanzas

## Propósito

Esta remediación extiende al resto de la plataforma las reglas implantadas inicialmente en el Portafolio de Proyectos. El objetivo es que cada vista presente **la misma realidad observable**, manteniendo separadas las dimensiones de gestión, operación, contrato y finanzas. La solución no inventa valores: cuando la fuente no existe, está vencida o no contiene el campo requerido, se muestra **N/D**.

## Contrato de evidencia

| Dimensión | Fuente autoritativa | Regla | Prohibición |
|---|---|---|---|
| Ciclo de vida | Proyecto PMO local | `activo`, `pausado`, `completado` o `cancelado` | No derivarlo desde Jira ni desde la planilla financiera |
| Pipeline PMO | Etapas y cierres PMO | Se cuentan sólo cierres con evidencia persistida | La posición del cursor no equivale a etapa cerrada |
| Fase operacional | Snapshot Jira local | Sólo se usa con evidencia `available` o con el campo presente en `partial` | El estado financiero nunca reemplaza la fase Jira |
| Avance e hitos Jira | Snapshot Jira local | TTL de 36 horas; `stale`, `error` y `missing` bloquean métricas | La ausencia no se convierte en cero |
| Salud Jira | Snapshot Jira local | Se presenta separada del ciclo de vida y del gobierno contractual | No se recalcula a partir de presupuesto o actividad |
| Project Manager | PMO local, luego Jira, luego finanzas | La fuente elegida se expone | No se oculta el fallback |
| Riesgos | PMO confirmados; si no existen, snapshot Jira | Los riesgos PMO no confirmados no autorizan escritura Jira | No se auto-confirman riesgos |
| Contratado | `financial_data` por Deal, ficha PMO, hitos en moneda única | Moneda obligatoria; se preserva la fuente | Nunca se suman monedas distintas |
| Facturación | Facturas SII elegibles | Sólo estados emitida/aceptada y saldo observado | Un hito cerrado no equivale a facturación |
| Cumplimiento contractual | Hito y acta de aceptación | Cómputo cardinal; Jira es evidencia operacional secundaria | Un issue cerrado no acredita aceptación cliente |

## Superficies migradas

### Portafolio y vistas de inicio

El Portafolio, la lista de atención y los filtros comparten el read model `ExecutivePortfolio`. Riesgos ausentes se muestran como N/D y permanecen al final del orden. `jiraProjectKey` forma parte de cada fila para resolver otras vistas sin depender de una consulta Jira live.

### Consola de Gobierno

La Consola dejó de inventar estado amarillo, riesgo 50, exposición financiera, fechas y decisiones. Su fallback se construye desde el read model común. Los agregados excluyen valores ausentes y el catálogo de gatillos tiene una única definición compartida.

### Consolidado Financiero

Se eliminaron cifras y proyectos demostrativos, distribuciones fijas y controles de exportación no implementados. El corte diario y mensual se normaliza; facturado usa estados SII elegibles y el aging usa saldo pendiente. Los ceros observados se conservan como cero y la ausencia como N/D.

### Detalle de proyecto y etapas

El detalle vinculado muestra por separado Fase Jira, Pipeline PMO, hitos Jira, PM, riesgos y contratado. Planificación usa subtotales por moneda y bloquea un total único multimoneda. El cierre y el reintento de riesgos Jira procesan sólo riesgos confirmados explícitamente.

### Dashboard vinculado

La carga inicial ya no espera una lectura Jira live. Los KPI principales provienen del snapshot local y separan fase, hitos, pipeline, PM, riesgos, contratado y salud. La sección financiera permanece como contexto financiero y no redefine la fase operacional.

### Dashboard Ejecutivo v2

La consulta dejó de ejecutar Jira live y de actualizar hitos como efecto lateral de una lectura. La evidencia operacional proviene del snapshot local; las observaciones individuales de hitos contractuales provienen de datos persistidos. El encabezado expone disponibilidad, timestamp, fase y salud Jira. Los datos incompletos se muestran como N/D.

### Análisis agéntico

Los generadores `generateLinkedVerdict` y `generatePMAnalysis` consumen el mismo read model. Sus prompts contienen reglas explícitas para no mezclar Pipeline PMO, Fase Jira, Salud Jira, contrato y finanzas, ni transformar N/D en cero o cumplimiento. Cada nuevo análisis persiste disponibilidad y timestamp Jira. Las observaciones legacy sin este contrato dejan de presentarse como vigentes, pero se conservan en historial.

### Reporte Jira

Los KPI transversales priorizan el snapshot PMO y el detalle Jira live queda como evidencia secundaria. Si el detalle live aún no responde, la vista puede construir un resumen desde el snapshot y muestra N/D para épicas, equipo y campos no incluidos. El indicador antes llamado “Facturado” ahora se llama **Hitos cerrados** y declara expresamente que no equivale a facturación.

## Guardrails técnicos

La prueba `crossViewEvidenceGuards.test.ts` impide reintroducir lecturas Jira live o escrituras laterales en `getExecutiveDashboardV2`, exige que los dos análisis IA usen metadatos de procedencia y bloquea la etiqueta “Facturado” basada en hitos. Las pruebas del adapter de evidencia cubren `partial`, `stale` y análisis legacy.

La automatización de snapshots mantiene el job Jira existente; no se creó un cron adicional. Las lecturas automatizadas Jira continúan siendo **GET-only**. Persistir snapshots y auditoría local no modifica Jira.

## Evidencia operativa actual

La cartera certificada contiene 12 proyectos. Once snapshots Jira están en `success` y uno, PAI, permanece `partial` por `JIRA_PROGRESS_ISSUE_MISSING`. Tanner PMO-180002 se resuelve como Construcción + QA, avance Jira 31%, 8/10 hitos, Eduardo Mercado, 23 riesgos abiertos, 12 altos y UF 8.200 desde datos financieros; su Pipeline PMO permanece Análisis y Diseño 0/6, sin confundirlo con la fase Jira.

## Limitaciones explícitas

PAI conserva N/D en los campos no observados. Cuatro proyectos continúan con monto N/D y dos con PM N/D por ausencia real de fuente. El detalle profundo de épicas, equipo, horas e issues del reporte Jira sigue siendo una lectura live opcional; el resumen y los KPI no quedan bloqueados por ella. Regenerar una observación IA es una acción manual y crea una nueva versión revisable; esta remediación no ejecutó el LLM ni validó una observación en nombre del usuario.

## Reversión

Los cambios están separados en checkpoints F0–F4. La reversión debe restaurar el checkpoint inmediatamente anterior al bloque afectado; no se debe hacer `reset`, `rebase`, `push` o recreación de jobs a ciegas. Las tablas, snapshots y documentos históricos no deben borrarse para revertir una presentación.
