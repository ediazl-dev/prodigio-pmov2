# Estado de implementación del Gantt contractual — Tanner

## Fecha: 2026-08-18

## Base sincronizada
- Checkpoint: `45d3d7a2` (versión en vivo)
- HEAD local == remoto: `45d3d7a`

## Archivos clave
- Componente: `/home/ubuntu/prodigio-pmo/client/src/pages/stages/ExecutiveDashboardV2.tsx`
- Especificación: `/home/ubuntu/prodigio-pmo/docs/GANTT_SPECIFICATION_TANNER.md`
- Diagnóstico: `/home/ubuntu/prodigio-pmo/docs/DIAGNOSTICO_PARIDAD_VISUAL_LINEA_TIEMPO_TANNER_2026-08-18.md`

## Bloque actual a reemplazar (líneas 255-256)
El componente actual muestra una tabla con columnas:
- Hito
- Fecha comprometida (Jira)
- Fecha real (acta)
- Estado
- Variación (días)

## Especificación del Gantt a implementar
Según maqueta HTML líneas 427-486:
- Eje mensual: FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT
- Filas con: código hito, nombre, peso %, barra temporal
- Estados visuales: ok (verde), plan (gris), atraso (rojo), hoy (ámbar), deriva (rojo discontinuo)
- Leyenda con 5 significados
- Línea de corte visible

## Datos disponibles por hito
- `milestone.milestoneCode` (ej. M01)
- `milestone.title`
- `milestone.billingWeight` (peso %)
- `milestone.jiraDueDate` (fecha comprometida)
- `milestone.jiraClosedDate` (fecha cierre Jira)
- `milestone.acceptedAt` (fecha aceptación acta)
- `milestone.timeline.status` (COMPROMETIDO, EN_RIESGO, PENDIENTE_ACTA, VENCIDO_SIN_ACTA, ACEPTADO)
- `milestone.timeline.varianceDays`
- `milestone.timeline.acceptanceWindowDays`

## Pruebas a actualizar
- `/home/ubuntu/prodigio-pmo/server/executiveDashboardV2.acceptance.test.ts` líneas 76-95
- `/home/ubuntu/prodigio-pmo/server/executiveDashboardV2.accessibility.test.ts` líneas 64-70

## Próximos pasos
1. Reemplazar el bloque de tabla por el Gantt visual
2. Actualizar estilos CSS del componente
3. Actualizar pruebas de aceptación
4. Validar con compilación y pruebas
5. Publicar checkpoint
