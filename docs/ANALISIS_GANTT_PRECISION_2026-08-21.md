# Análisis: Precisión Gantt Dashboard Ejecutivo v2 — hitos vencidos vs línea de corte
Fecha: 2026-08-21

## Problema reportado por el usuario
En el dashboard ejecutivo de Tanner, hitos VENCIDOS aparecen pintados POSTERIOR a la línea de corte (hoy 2026-08-21). Debe ser consistente.

## Datos reales de Tanner (executive_contract_milestones, projectId=180002)
| Hito | baselineDate | jiraDueDate | jiraClosedDate | jiraStatusName | semanticStatus |
|------|-------------|-------------|----------------|----------------|----------------|
| M01 Kick Off | 2026-02-02 | 2026-02-02 | NULL | Cumplido (Entregable) | fulfilled |
| M02 Cierre Diseño | 2026-03-20 | 2026-03-20 | NULL | Cumplido (Entregable) | fulfilled |
| M03 Arquitectura SFA Pre-Prod | 2026-04-10 | 2026-07-27 | NULL | Retrasado | delayed |
| M04 Arquitectura SFA Prod | 2026-04-10 | 2026-10-02 | NULL | Pendiente | pending |
| M05 Cierre Sprint 1 y 2 | 2026-09-11 | 2026-08-03 | NULL | Pendiente | pending |
| M06 Cierre Sprint 3 y 4 | 2026-09-11 | 2026-08-10 | NULL | Pendiente | pending |
| M07 Iniciador de Pagos | 2026-09-11 | 2026-09-03 | NULL | Pendiente | pending |
| M08 Cierre Sprint 6 y 7 | 2026-09-11 | 2026-08-17 | NULL | Pendiente | pending |
| M09 Cierre Sprint 8 y 9 | 2026-09-11 | 2026-08-25 | NULL | Pendiente | pending |
| M10 Cierre y Garantía | 2026-09-11 | 2026-10-09 | NULL | Pendiente | pending |

## Clasificación esperada con hoy=2026-08-21 (classifyMilestoneTimeline)
- M01, M02: ACEPTADO (tienen acta registrada — verificar executive_milestone_acceptances)
- M03 (due 07-27 < hoy): VENCIDO_SIN_ACTA — se pinta en 07-27 (ANTES del corte) ✓ correcto
- M05 (due 08-03 < hoy): VENCIDO_SIN_ACTA — se pinta en 08-03 (ANTES del corte) ✓
- M06 (due 08-10 < hoy): VENCIDO_SIN_ACTA — se pinta en 08-10 (ANTES del corte) ✓
- M08 (due 08-17 < hoy): VENCIDO_SIN_ACTA — se pinta en 08-17 (ANTES del corte) ✓
- M09 (due 08-25 > hoy, baseline 09-11 > due → deriva negativa): EN_RIESGO o COMPROMETIDO
- M07 (due 09-03 > hoy): EN_RIESGO si <= 7 días... no, 13 días → COMPROMETIDO (baseline 09-11 > due, deriva negativa → positiveDrift=false)
- M04 (due 10-02): COMPROMETIDO; M10 (due 10-09): COMPROMETIDO

## Hipótesis del problema visual
1. El marcador del hito (edv2-gantt-marker) se posiciona con `left: jiraPos%` — el PUNTO queda en la fecha correcta, PERO la etiqueta de fecha (edv2-gantt-date-tag prog) y la etiqueta de estado (edv2-gantt-marker-label) se extienden hacia la DERECHA del punto. Para hitos cerca de la línea de corte (ej. M08 en 08-17, corte en 08-21), la etiqueta cruza visualmente la línea → parece que el hito está después del corte.
2. La línea de corte (edv2-gantt-corte) se renderiza AL FINAL del fragmento, después de todas las filas de hitos — puede tener z-index/posicionamiento que la hace ver desplazada.
3. El eje se extiende hasta la fecha máxima (M10: 10-09) → la línea de corte queda al ~65% del ancho. Los meses AGO/SEP/OCT ocupan mucho espacio visual a la derecha.

## Archivos clave
- Frontend Gantt: client/src/pages/stages/ExecutiveDashboardV2.tsx líneas 262-420
  - pos() línea ~283: posición % = ((ts - axisStart) / (spanDays * DAY)) * 96 + 1, clamped 1-98
  - cortePos línea 287
  - Línea de corte render línea 408: <div className="edv2-gantt-corte" style={{ left: cortePos% }}>
  - Marcador hito: <div className={barClass} style={{ left: jiraPos% }}> con date-tag y marker-label
- Clasificador: server/executiveGovernanceEngine.ts líneas 145-215 (classifyMilestoneTimeline)
- Backend milestones: server/routers.ts líneas 3886-3912 (milestoneEvidence con timeline)
- Query frontend: trpc.advance.getExecutiveDashboardV2 (línea 132 del TSX)
- CSS: buscar edv2-gantt-corte, edv2-gantt-marker, edv2-gantt-date-tag en el <style> del mismo archivo (línea ~223)

## Plan de corrección (pendiente de confirmar visualmente)
A. Alinear etiquetas de hitos vencidos hacia la IZQUIERDA del punto cuando el punto está cerca del corte (o siempre para vencidos), para que la etiqueta no cruce la línea de corte.
B. Asegurar que la línea de corte tenga z-index superior y se extienda por TODAS las filas (position absolute en el wrap completo).
C. Opcional: para hitos VENCIDO_SIN_ACTA, pintar además un indicador en la línea de corte (días de atraso acumulado a la fecha de análisis) — refuerza que el atraso se mide AL CORTE, no solo en la fecha de compromiso.
D. Verificar que el eje no se extienda innecesariamente: considerar axisEnd = max(cutoff + margen, fechas futuras reales).

## Estado
- Dashboard v2 no carga en dev (query pesada con Jira) — verificar en producción o con datos cacheados
- TODO.md tiene el ítem registrado
