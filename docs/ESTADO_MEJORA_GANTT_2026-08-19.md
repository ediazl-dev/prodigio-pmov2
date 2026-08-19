# Estado implementación mejora Gantt — 2026-08-19 (actualizado)

## Completado
1. Análisis de captura FireShot (docs/ANALISIS_GANTT_FEEDBACK_2026-08-19.md)
2. Regla de clasificación confirmada por usuario:
   - VENCIDO_SIN_ACTA: fecha Jira pasada sin acta (antes era EN_RIESGO)
   - EN_RIESGO: fecha futura próxima a vencer (<=7 días) O deriva positiva vs. baseline (opción C)
3. Motor cardinal corregido (server/executiveGovernanceEngine.ts):
   - classifyMilestoneTimeline ahora acepta baselineDate y riskWindowDays
   - Clasificación: ACEPTADO / PENDIENTE_ACTA / VENCIDO_SIN_ACTA / EN_RIESGO / COMPROMETIDO / SIN_FECHA_COMPROMETIDA
4. routers.ts actualizado: pasa baselineDate a classifyMilestoneTimeline
5. Pruebas del motor actualizadas: 12/12 pasan
6. TypeScript limpio

## Estado actual del componente Gantt (client/src/pages/stages/ExecutiveDashboardV2.tsx)
- Bloque Gantt: líneas 260-370
- Estructura actual por fila (líneas 312-352):
  - edv2-gantt-label-col: código, nombre (title nativo), peso %
  - edv2-gantt-timeline: rombo baseline (title nativo), franja deriva (title nativo), marcador Jira (title nativo + label de estado)
- Línea de corte: línea 354-356 (dinámica desde cutoff.date)
- Leyenda: líneas 360-367 (6 significados)
- Regla de gobierno: líneas 368-370
- NO tiene tooltips ricos: sólo usa title nativo del navegador
- NO tiene etiquetas de fecha visibles junto a los marcadores
- useState disponible en el componente (línea 3), hay que añadir estado para tooltip activo

## Pendiente (Fase 3) — EN CURSO
- Tooltips ricos por hito: componente accesible con estado useState para tooltip activo
  Contenido: código, nombre, fecha base contractual, fecha programada Jira, deriva en días, estado, peso %, acta
- Etiquetas de fecha visibles: "Base" (rombo) y "Prog." (marcador) con fecha corta dd-mmm

## Pendiente (Fase 4)
- Carga de acta por hito individual: botón "Registrar acta" en cada fila de la tabla de hitos
  que abre el formulario con el hito preseleccionado y bloqueado
  Estado actual: acceptanceFormOpen (línea 120), acceptanceForm (línea 121) con milestoneId

## Pendiente (Fase 5)
- Actualizar pruebas de aceptación del dashboard
- Validar TypeScript, pruebas focales, checkpoint

## Archivos clave
- Componente: client/src/pages/stages/ExecutiveDashboardV2.tsx (bloque Gantt líneas 260-370)
- CSS: client/src/index.css (clases edv2-gantt-*)
- Motor: server/executiveGovernanceEngine.ts
- Router: server/routers.ts (línea ~3903, construcción milestoneEvidence)
- Pruebas motor: server/executiveGovernanceEngine.test.ts
- Pruebas aceptación: server/executiveDashboardV2.acceptance.test.ts

## Datos Tanner
- 10 hitos M01-M10 con baselineDate poblada desde carta Gantt
- Corte del análisis: cutoff.date (dinámico)
- Deriva notable: M03 +108d, M04 +175d, M10 +28d; M05 -39d, M06 -32d (adelanto)
