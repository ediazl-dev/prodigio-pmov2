# Avances Jira por hitos y tareas operacionales

## Propósito

La vista **Avance Jira** fue rediseñada para responder tres preguntas distintas sin mezclar sus denominadores: cuánto ha avanzado el proyecto según sus hitos, cuánto trabajo operacional de tareas se ha completado y qué señales requieren atención inmediata. La implementación conserva la evidencia transversal ya certificada para fase, salud, PM, riesgos, finanzas y análisis agéntico.

## Regla de medición

> El avance del proyecto es la cardinalidad de **Hitos PMO cerrados sobre Hitos PMO totales**. El avance de tareas es una lectura operacional secundaria y nunca sustituye al avance del proyecto.

Los cálculos se realizan con un motor puro y determinista. El universo de tareas excluye épicas, hitos, riesgos, cambios de alcance y el marcador técnico `Proyecto PMO - Avance`. Cuando un proyecto no tiene Hitos PMO, el avance se presenta como **N/D** y queda fuera del promedio de cartera. Los proyectos con estado `completado` o `cancelado` quedan fuera del reporte operacional.

## Lista de proyectos

La lista reemplaza las tarjetas por una tabla densa y navegable. Presenta proyecto/cliente/clave Jira, avance por hitos, avance de tareas, próximo hito, trabajo por ejecutar, riesgos, equipo y carga. Incluye búsqueda, filtros por cliente, avance, próximo hito y señales de atención, además de orden por columnas. Los valores ausentes se mantienen como N/D y quedan al final del orden.

En la evidencia productiva del 19 de septiembre de 2026, la lista contiene **8 proyectos abiertos**, **16 de 39 hitos cerrados**, avance agregado **41%** y **3 proyectos sin hitos definidos**. Los cuatro proyectos cerrados existentes no aparecen.

## Detalle de proyecto

El detalle conserva el análisis agéntico, KPI financieros, riesgos, fase Jira, PM, salud, generación PPTX y navegación existente. El avance por hitos queda como métrica primaria; las tareas se muestran de forma secundaria.

Se incorporaron seis paneles:

| Panel | Pregunta que responde |
|---|---|
| Hitos del proyecto | ¿Qué hito habilita cada grupo de tareas y cuál es su estado/fecha? |
| Cobertura de objetivos | ¿Las tareas cubren épicas e hitos declarados? |
| Agenda | ¿Qué tareas están vencidas, próximas o sin fecha? |
| Carga por persona | ¿Cómo se distribuyen tareas, vencimientos y estancamiento? |
| Tareas estancadas | ¿Qué trabajo en curso lleva 14 días o más sin movimiento? |
| Avance por épica | ¿Cuántas tareas hijas están cerradas por épica, sin fabricar porcentajes 0/0? |

Para Tanner, el detalle muestra **80% por hitos (8/10)** y **86% por tareas (115/133)**, conservando Construcción + QA, Eduardo Mercado, 23 riesgos abiertos/12 altos y los componentes agénticos/financieros existentes.

## Verificación de CCLA

El brief sugería que CCLA debía mostrar 8% de tareas. Una lectura Jira GET-only confirmó que los **57 issues** actuales se distribuyen en 24 Stories, 19 Riesgos PMO, 7 Epic, 6 Hito PMO y 1 marcador. Las 24 Stories están en Backlog; los dos issues cerrados son Hitos PMO. Por ello, la aplicación muestra **33% de avance del proyecto (2/6 hitos)** y **0% de tareas (0/24)**. Mostrar 8% habría contradicho la fuente real.

## Seguridad y trazabilidad

Todas las consultas Jira usadas por estas vistas son **GET-only**. El rediseño no crea, edita ni transiciona issues. Tampoco modifica cron jobs, snapshots financieros ni datos PMO. Las señales operacionales se calculan en memoria a partir del reporte Jira; no se persisten como hechos nuevos.

## Certificación

La suite focal aprobó **51 pruebas** y la suite determinista completa aprobó **842 pruebas**, con 19 casos live/opt-in omitidos por diseño. El build productivo finalizó correctamente. `pnpm check` conserva exactamente cinco errores TypeScript heredados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts` por `invitations.estadoSII`; no se agregaron errores nuevos.

La verificación read-only posterior a las pruebas confirmó **12 proyectos** en base de datos (8 abiertos y 4 completados), **12 snapshots Jira para 12 projectId distintos** y **cero nombres de proyecto duplicados**. La suite no dejó fixtures persistentes.

La validación autenticada confirmó la lista y el detalle Tanner en escritorio. El código responsive usa encabezado apilable, KPI 2/3/6 columnas, tarjetas adaptativas, hitos 1/2 columnas y overflow horizontal contenido para la tabla de carga.

## Limitaciones explícitas

La lista y el detalle enriquecido realizan lecturas Jira GET-only y pueden permanecer varios segundos en estado de carga. Los vínculos de tareas con épicas/hitos dependen del campo `parent` de Jira; cuando la jerarquía no está poblada, el sistema informa tareas huérfanas o hitos sin tareas en vez de inventar relaciones.

## Recuperación

El checkpoint funcional previo a la certificación final es `f996f9ce`. El rollback debe hacerse mediante el historial de versiones/checkpoints; no se debe ejecutar `reset`, `rebase` ni sobrescribir refs manualmente.
