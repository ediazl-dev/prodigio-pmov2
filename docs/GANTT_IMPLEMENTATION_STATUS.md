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

---

## Cierre de implementación — 2026-08-18 (checkpoint 62c4947a)

| Fase | Estado | Artefacto verificable |
|---|---|---|
| 1. Extracción del bloque anterior | ✅ | `/tmp/gantt_old.txt` (2705 chars, MD5 verificado) |
| 2. Generación del nuevo bloque | ✅ | `/tmp/gantt_new.txt` (4686 chars) |
| 3. Reemplazo quirúrgico | ✅ | `ExecutiveDashboardV2.tsx` líneas 256-337 con `edv2-gantt-wrap` |
| 4. Validación TypeScript | ✅ | `tsc --noEmit` limpio tras corregir 6 errores de tipos implícitos (`.getTime()`, `Date \| null`) |
| 5. Checkpoint publicado | ✅ | `62c4947a` (auto-publicado a producción) |

### Trabajo adicional ejecutado en el cierre
- Sistema de clases `edv2-gantt-*` (33 reglas) añadido a `client/src/index.css` con paleta grafito/papel/teal, estados ok/atraso/hoy/plan, barra de deriva rayada, línea de corte y leyenda; incluye adaptación responsive y `prefers-reduced-motion`.
- Pruebas de aceptación actualizadas a la nueva estructura del Gantt (título "baseline vs. real", clases del wrap/leyenda, campos `jiraDueDate`/`jiraClosedDate`/`acceptedAt`).
- Validación: 30 pruebas focales aprobadas (5 archivos), TypeScript limpio, ruta `/projects/180002/executive-dashboard-v2` responde HTTP 200 y el CSS servido incluye las 17 clases `edv2-gantt-*`.

### Nota sobre el bucle detectado y resuelto
Durante la Fase 4 se detectó un bucle de 10+ iteraciones con la herramienta de parches (archivo grande truncado en caché → desajuste de versión). Se resolvió cambiando a scripts Python de reemplazo directo por strings, conforme a la estrategia anti-loop: cada acción produce un artefacto verificable.
