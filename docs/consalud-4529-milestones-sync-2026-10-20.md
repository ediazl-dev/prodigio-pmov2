# Consalud Apigee Deal 4529 — sincronización de hitos

## Alcance autorizado y fuentes

Usuario: «actualiza y sincroniza», 20 de octubre de 2026. Se actualizó sólo PMO-180003, `[PMO Consalud] Implementación Apigee - Deal 4529`, desde el Space Jira `PCIAD4`. Todas las llamadas externas fueron consultas a Jira (POST de búsqueda de sólo lectura); no hubo creación, edición, transición ni eliminación de issues.

Antes de la operación, la fuente ejecutiva 30001 (`jira-v1`, `baseline-jira-PCIAD4`) tenía tres hitos, porcentajes de 33,33 y fecha de observación del 19 de septiembre. Sus fechas operativas y bases contractuales estaban nulas. Jira ya tenía cuatro hitos con fecha y distribución actualizada.

## Resultado persistido

| Código PMO | ID PMO | Jira | Peso observado Jira | Fecha programada | Estado Jira |
|---|---:|---|---:|---|---|
| M00 / H0 | 1530001 | PCIAD4-49 | 28 % | 2026-10-13 | Cumplido (Entregable) |
| M01 / H1 | 30001 | PCIAD4-11 | 22 % | 2026-11-19 | Pendiente |
| M02 / H2 | 30002 | PCIAD4-12 | 36 % | 2027-01-05 | Pendiente |
| M03 / H3 | 30003 | PCIAD4-13 | 14 % | 2027-02-01 | Pendiente |

Observación PMO de los cuatro hitos: `2026-10-20T19:15:35Z` (16:15 en Chile). Se preservaron los IDs de M01–M03, se incorporó sólo M00 y se conservaron las bases contractuales nulas, la fuente aprobada preexistente, la ficha de proyecto, las actas y los registros de facturación. No se generó una nueva aprobación contractual.

Los pesos son **observaciones de Jira autorizadas para actualizar el modelo operativo**. Su suma es 100 %. Los importes del read model, derivados de venta UF × peso, son referenciales: UF 308 / 242 / 396 / 154. No se interpretó el texto «OC 14.054 + IVA» como importe ni moneda, no se modificó el total de venta ni la planilla histórica y no se convirtió moneda.

Una lectura GET-only posterior encontró el campo explícito `Estado de Facturación` de H0 en `✅ Facturado`; por eso el panel operacional informa H0 facturado **según Jira**, con monto referencial UF 308. H1–H3 siguen N/D. No se creó factura en PMO ni se infirió emisión por el estado Cumplido. H0 no tiene `resolutiondate`; su fecha de cierre sigue N/D. No hay actas de aceptación registradas para estos cuatro hitos; el avance cardinal documentado no se elevó por Jira.

## Respaldo y controles

Directorio privado: `/home/ubuntu/backups/prodigio-pmo/2026-10-20-consalud-4529-milestones/`.

- `before.json` y `before.json.sha256`, SHA-256 `221933935d2a1db736434340670c5015614c44ad2e6659036b83b0b9e47cc044`.
- `after.json`; archivos modo 0600, directorio 0700.
- Huella de estado PMO y respuesta Jira comprobadas antes de la transacción; proyecto y fuente bloqueados durante la escritura.
- Un registro de auditoría `sync_consalud_4529_milestones` con evidencia anterior, plan, pesos, conteos y límites.
- Verificación posterior de tablas inmutables e idempotencia: segunda ejecución `already_synchronized`, sin otra escritura.

El script `scripts/syncConsalud4529Milestones.ts` está acotado a proyecto 180003, fuente 30001, Space PCIAD4 y el inventario de cuatro claves. Ante cambio de inventario, checksum o estado concurrente, falla cerrado. `server/jiraProjectMilestoneRefresh.ts` aporta el plan puro, parsing decimal y validación de sumas; no crea baseline, factura ni acta.

## Presentación corregida

El Dashboard Ejecutivo V2 usa una tabla reusable `ExecutiveMilestoneEvidenceTable`: título neutral **Calendario y evidencia por hito**, columnas independientes de base contractual, fecha programada Jira, cierre Jira, aceptación y acta; estado Jira legible y clave; última observación con hora de Chile. Para fuentes `baseline-jira-*` se rotulan importes referenciales. Una aceptación visible exige estado accepted, fecha y URL de acta. Se conservó el formulario de registro por hito, roles y métricas cardinales.

El hero y el Gantt ya no afirman que la fecha Jira sea automáticamente la fecha contractual. La tabla tiene scroll interno para mantener legibles sus nueve columnas. El Gantt sigue marcando H0 pasado sin acta como señal de gobierno de aceptación; H1–H3 permanecen planificados, no vencidos por falta de acta.

## Certificación

Build productivo exitoso. Suite determinista: **1.132 pruebas aprobadas, 20 omitidas; 158 archivos aprobados, 17 omitidos**. La prueba live de Banco Central `server/ufService.test.ts` se excluyó de esta certificación interna. TypeScript mantiene exactamente cinco errores heredados (cuatro `server/jiraMilestoneSync.ts`, uno `estadoSII` en `server/routers.ts`), sin nuevos errores. Diff sin problemas de whitespace; revisión de secretos sin hallazgos.

Preview autenticada verificada: cuatro filas con fechas, estados, referencias monetarias y timestamp de observación; página sin overflow global y tabla con scroll interno. También se comprobó carga desktop de Tanner y shell móvil de Consalud. No se presenta la carga del shell móvil como inspección visual completa de la tabla.

Checkpoint del bloque de datos: `786f1714`. La publicación del ajuste visual sigue el checkpoint final de WebDev; no es una nueva programación automática. Esta operación fue una **sincronización puntual** y no modificó tareas diarias ni onboarding.
