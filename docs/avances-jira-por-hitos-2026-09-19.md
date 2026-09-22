# Avances Jira alineado con el Portafolio de Proyectos

## Propósito

La vista **Avance Jira** utiliza ahora el mismo universo y el mismo read model certificado que **PMO Proyectos → Portafolio**. El objetivo es evitar que dos pantallas presenten cifras distintas para un mismo proyecto y, al mismo tiempo, conservar el detalle operacional que sólo existe en Jira.

> **Regla transversal:** el Portafolio gobierna ciclo de vida, fase Jira, avance Jira reportado, salud, PM, hitos y riesgos. La lectura Jira live agrega tareas, agenda, cobertura, carga y estancamiento, pero nunca reemplaza un dato ausente del snapshot.

## Causa raíz corregida

La versión anterior de Avance Jira construía su universo directamente desde Spaces Jira y proyectos abiertos. Excluía los cuatro proyectos completados y mostraba como avance principal el porcentaje de hitos cerrados; la captura revisada incluso correspondía a una versión anterior basada en porcentaje de issues. El Portafolio, en cambio, mostraba los doce proyectos y usaba el campo operacional reportado en el snapshot Jira para **Avance Jira**. Por ello, Tanner podía aparecer como 74% en la vista antigua, 80% por hitos en el rediseño inicial y 31% en el Portafolio, aunque cada porcentaje midiera una dimensión distinta.

La corrección elimina esa ambigüedad. La lista presenta columnas separadas para **Avance Jira**, **Hitos** y **Tareas live**, y mantiene visible el ciclo de vida administrativo. Los porcentajes dejan de competir entre sí.

## Fuente de cada dimensión

| Dimensión | Fuente autoritativa | Regla de ausencia |
|---|---|---|
| Universo de proyectos | Read model del Portafolio PMO | Se muestran activos, pausados, completados y cancelados |
| Ciclo de vida | Proyecto PMO | Nunca se infiere desde Jira |
| Fase Jira | Snapshot Jira local certificado | N/D si la evidencia no es utilizable |
| Pipeline PMO | Etapas locales PMO | Se mantiene separado de la fase Jira |
| Avance Jira | Campo de avance reportado del snapshot | N/D; no se sustituye por hitos o issues |
| Salud ejecutiva | Snapshot Jira | N/D si no existe evidencia |
| PM | Precedencia PMO local → Jira → finanzas | N/D si no existe ninguna fuente |
| Hitos | Snapshot Jira | N/D si no hay hitos medibles |
| Riesgos | Matriz PMO confirmada → snapshot Jira | N/D si no existe evidencia |
| Tareas, agenda, cobertura y carga | Lectura Jira GET-only live | N/D si la lectura live no está disponible |

## Lista consolidada

La lista muestra **12 de 12 proyectos**, coincidiendo con Portafolio: **8 activos y 4 completados**. El filtro de ciclo de vida permite revisar ambos grupos sin retirar registros de la fuente. La tabla incluye proyecto e ID PMO, ciclo de vida y salud, fase Jira y pipeline PMO, avance Jira, hitos, tareas live, próximo hito, riesgos y PM.

La evidencia autenticada del 19 de septiembre de 2026 mostró un promedio simple de **42% de avance Jira reportado**, **27 de 51 hitos cerrados** y **379 de 532 tareas live cerradas**. Estos tres indicadores tienen denominadores distintos y se presentan separados.

## Casos de control

| Proyecto | Avance Jira | Hitos | Tareas live | Salud / evidencia | Resultado |
|---|---:|---:|---:|---|---|
| Tanner `PBTISD1` | 31% | 8/10 (80%) | 115/133 (86%) | Rojo / Crítico | Coincide con Portafolio; PM Eduardo Mercado, 23 riesgos/12 altos y pipeline PMO 4/6 |
| CCLA `PMOCCLSRPM` | 0% | 2/6 (33%) | 0/24 (0%) | Salud N/D | Las 24 Stories siguen en Backlog; no se inventa el 8% del brief |
| PAI `PAI` | N/D | N/D | 26/32 (81%) | Evidencia parcial | La tarea live no reemplaza avance, fase, salud o PM faltantes |
| MaxAgro `PMOMAXASSD` | 75% | 4/4 (100%) | 61/68 (90%) | Completado / Verde | Permanece visible como proyecto completado |

## Detalle de proyecto

El detalle mantiene análisis agéntico, información financiera, riesgos, generación PPTX y paneles de hitos, agenda, cobertura, tareas estancadas, carga y épicas. El encabezado y el strip de KPI se alinearon con Portafolio y separan seis dimensiones: **Avance Jira**, **Hitos**, **Tareas live**, **PM**, **Riesgos** y **Equipo**.

Para Tanner, el detalle muestra ciclo de vida activo, fase Construcción + QA, avance Jira 31%, 8/10 hitos, 115/133 tareas, Eduardo Mercado, 23 riesgos abiertos/12 altos y equipo de 10 responsables con tareas.

El pipeline PMO se obtiene de `project_stages`, no de la posición Jira ni de la existencia de aperturas de plazo. Tanner muestra **Avance Proyecto · 4/6 etapas completadas**. La configuración asigna 10 días hábiles a Avance Proyecto, pero `stage_openings` no contiene una apertura para ese proyecto; por eso se informa **Sin apertura PMO · plazo configurado 10 días hábiles** y los días consumidos permanecen en `N/D`.

## Rendimiento y seguridad

Todas las operaciones Jira utilizadas por la lista y el detalle son **GET-only**. No se crean, editan ni transicionan issues. El servidor reutiliza durante 60 segundos las lecturas GET-only y comparte solicitudes concurrentes entre lista y detalle. El cache es únicamente en memoria, no persiste hechos, no cambia snapshots y elimina inmediatamente una entrada cuando la lectura falla.

## Certificación

La suite focal aprobó **86 pruebas** y la suite determinista completa aprobó **847 pruebas**, con 19 pruebas live/opt-in omitidas por diseño. El build productivo finalizó correctamente. `pnpm check` conserva exactamente cinco errores TypeScript heredados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts` por `invitations.estadoSII`; no se agregaron errores nuevos.

La verificación read-only posterior a la suite confirmó **12 proyectos** —8 activos y 4 completados—, **12 snapshots para 12 projectId distintos**, 11 snapshots `success`, uno `partial` y cero nombres duplicados. La validación visual autenticada se realizó en escritorio y en viewport móvil 390×844. La tabla móvil mantiene overflow horizontal propio y el detalle apila los seis KPI en dos columnas.

## Limitaciones explícitas

La agenda, cobertura, carga y tareas estancadas dependen de una lectura Jira live y pueden tardar algunos segundos en la primera carga. El cache corto reduce recargas consecutivas, pero no convierte esos datos en evidencia persistida. Los vínculos de tareas con épicas e hitos dependen del campo `parent`; cuando la jerarquía no está poblada, el sistema informa tareas huérfanas o hitos sin tareas en lugar de inventar relaciones.

## Recuperación

El checkpoint funcional de esta corrección es `ff3a8eaf`. La recuperación debe hacerse desde el historial de versiones/checkpoints. No se debe ejecutar `reset`, `rebase` ni sobrescribir refs manualmente.
