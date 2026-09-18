# Implementación del Panel de Control Ejecutivo

**Fecha de cierre:** 18 de septiembre de 2026  
**Rama de trabajo:** `feat/panel-control-ejecutivo`  
**Punto de partida:** checkpoint `0a7df6ff`

## Alcance implementado

Se reemplazó el contenido de la ruta `/dashboard` por el Panel de Control Ejecutivo entregado en el paquete de diseño. La integración conserva el layout y la navegación global de Prodigio PMO, y no modifica el Dashboard Ejecutivo V2 de cada proyecto, la Consola de Gobierno ni el módulo de Servicios Recurrentes.

La solución agrega un motor determinista de portafolio, una fuente de datos de solo lectura y el procedimiento protegido `projects.executive`. La interfaz presenta cuatro indicadores de primer orden, una lista de proyectos activos ordenada por urgencia, distribución de activos por etapa, resultados de proyectos cerrados y cuellos de botella del proceso.

## Compatibilidad preservada

| Control | Resultado |
|---|---|
| Identidad de proyecto | Cada fila mantiene visible el código interno `PMO-*`. |
| Duplicidad de nombres | El alta ejecuta el preflight normalizado antes de invocar la mutación y el backend conserva el índice único. |
| Permisos | Sólo `admin` y `pmo` visualizan el alta. `pm` y `consulta` mantienen acceso de lectura al dashboard. |
| Payload de alta | Email y monto vacíos se omiten; la moneda se normaliza y los campos opcionales no se convierten en cadenas vacías. |
| Multimoneda | Los importes se presentan por moneda; UF y USD no se suman. |
| Evidencia faltante | Plazos, importes, promedios y porcentajes no medibles se presentan como `N/D` o “Sin monto”; no se convierten en cero ni en cumplimiento. |
| Riesgos | El indicador considera únicamente riesgos altos, abiertos y confirmados. |
| Plazos extendidos | El consumo se compara con `totalAllowed` de compliance, que ya incorpora extensiones, pausas y feriados. |
| Responsive | Las tablas conservan su densidad mediante scroll interno accesible; los paneles se apilan en móvil. |

## Evidencia con datos reales

La lectura productiva de solo lectura confirmó **17 proyectos**: 13 activos y 4 cerrados. Las 13 etapas activas carecen actualmente de una apertura/plazo medible, por lo que el dashboard muestra explícitamente “13 sin plazo medible” y no afirma que estén al día.

El agregado identifica **6 riesgos altos abiertos confirmados en un proyecto**. En finanzas, el portafolio mantiene UF y USD separados; los proyectos activos no tienen monto contractual en `projects.totalAmount`, por lo que “Contratado en ejecución” se muestra como “Sin monto”. Existen cuatro hitos pendientes vencidos por UF 552, presentados como evidencia de facturación por moneda y no como monto contractual.

En procesos, la etapa Matriz de Riesgos presenta 19,5 días usados contra 15 días efectivos, con base de 5 días y 20 días adicionales distribuidos en dos extensiones. Las extensiones de proyectos o etapas no cerradas se excluyen del conteo de cierres.

## Validación

La matriz focal aprobó 21 pruebas del motor ejecutivo, 7 pruebas de formato, roles y alta, y 4 pruebas de identidad de proyectos. El build productivo finalizó correctamente. TypeScript conserva únicamente los cinco errores heredados ya documentados en `server/jiraMilestoneSync.ts` y `server/routers.ts`; no se añadió ninguna regresión.

La revisión visual se realizó en escritorio 1440×1000 y móvil 390×844. Se verificaron el sidebar único, contraste, IDs PMO, controles de actualización y alta, paneles completos, scroll horizontal interno y ausencia de solapamientos.

## Restricciones respetadas

La implementación no escribió datos en Jira/JSM, no creó ni editó tickets, no modificó estados de proyectos, no alteró datos financieros y no intentó reconciliar montos faltantes. Toda comprobación de datos fue de solo lectura.
