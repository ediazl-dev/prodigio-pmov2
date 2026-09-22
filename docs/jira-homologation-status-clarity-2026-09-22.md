# Claridad de homologación Jira, finanzas e historial

**Fecha:** 22 de septiembre de 2026  
**Proyecto verificado:** PMO-2670001 — `[PMO] CCLA SRP MVP1 Deal 4728`

## Objetivo

La tarjeta de homologación fue corregida para que funcione como una vista operativa y no como un volcado de registros técnicos. La trazabilidad histórica se conserva completa, pero el cuerpo del detalle muestra únicamente las tres corridas más recientes. El resto se consulta en un diálogo paginado y filtrable.

## Cambios implementados

El vínculo financiero ahora se resuelve con una precedencia única: **campo Deal del proyecto, contrato financiero enlazado y Deal explícito en el nombre**. Un Deal obtenido desde el nombre permite leer las cifras existentes, pero no se presenta como una asociación formal. Esta distinción elimina el falso mensaje “por confirmar” sin ocultar la brecha de gobierno.

La ficha financiera muestra valor contratado, costo utilizado, presupuesto de costo, costo proyectado, capacity proyectada y margen proyectado. Cada cifra conserva moneda UF, fuente y fecha de corte. La interfaz declara expresamente que esas cifras no son facturación SII ni cobros; ambos conceptos permanecen fuera de la tarjeta si no existen facturas o pagos verificables.

Los antiguos chips técnicos fueron sustituidos por **cobertura y acciones pendientes**. Cada brecha informa qué falta, por qué importa, qué acción corresponde y si bloquea la sincronización. Las excepciones ahora se presentan como **casos que requieren revisión**, con “qué ocurrió”, “efecto”, “qué hacer” y condición bloqueante o no bloqueante. La razón técnica original permanece en el read model para auditoría.

El historial principal muestra tres corridas y un resumen por resultado. El diálogo “Ver las N corridas” consulta páginas de diez registros, permite filtrar por origen y resultado, y conserva orden descendente desde la corrida más reciente. La API limita cada página a veinte registros como máximo y sólo expone los contadores de lectura Jira necesarios; no retorna fingerprints ni metadatos internos de la corrida.

## Evidencia verificada

| Caso | Vínculo financiero | Resultado |
|---|---|---|
| CCLA PMO-2670001 | `Deal4728`, detectado en el nombre y coincidente con `financial_data` | Cifras disponibles; se informa que la ficha aún no formaliza el Deal. |
| Tanner PMO-180002 | `Deal1934`, enlazado mediante contrato financiero | Asociación formal; no se genera brecha de formalización financiera. |
| Staffing PMO-510001 | `Deal4687`, detectado en el nombre, sin fila financiera | Valores en `N/D`; no se inventa cero ni se mezcla una línea base con evidencia financiera. |

Para CCLA se verificaron **UF 6.533,3333 contratadas**, **UF 708,98 utilizadas**, **UF 2.255 de presupuesto**, **UF 3.544,90 de costo proyectado**, **UF 1.522,772 de capacity proyectada** y **45,7413% de margen proyectado**, con corte financiero del 22 de septiembre de 2026. También se confirmaron **16 corridas H7**: tres visibles en el cuerpo, diez en la primera página y seis en la segunda. Dos corridas son manuales. Las dos excepciones abiertas corresponden a ítems de backlog sin clave de padre y no bloquean el resto de la sincronización.

## Fuentes y trazabilidad

| Fuente | Uso |
|---|---|
| Captura entregada `FireShotCapture339-Prodigio-PlataformaPMO-[pmo.prodigio.tech].pdf` | Confirmación visual del problema original. |
| Tablas locales `projects`, `financial_data`, `contract`, `jira_project_onboarding`, `jira_entity_mapping`, `jira_import_exception` y `jira_sync_log` | Evidencia determinista del vínculo, cifras, cobertura, excepciones e historial. |
| Vista autenticada de desarrollo `/projects/2670001` | Verificación visual de la tarjeta, modal, filtros y paginación en escritorio y móvil. |
| Sincronización Jira H7 existente | Se mantuvo en modo GET-only; esta mejora no crea, edita ni transiciona issues Jira. |

## Certificación

La suite determinista final aprobó **884 pruebas en 120 archivos**, con **19 pruebas omitidas** por configuración o dependencia externa. El build productivo terminó correctamente. TypeScript conserva exactamente los **cinco errores heredados** ya conocidos, sin errores nuevos. Se verificaron además el historial real en dos páginas, los filtros de origen, la vista de escritorio, la adaptación móvil, `git diff --check` y ausencia de secretos en los archivos modificados.
