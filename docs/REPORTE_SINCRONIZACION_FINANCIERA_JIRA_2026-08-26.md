# Reporte de sincronización financiera y Jira — 26 de agosto de 2026

## Resultado ejecutivo

La sincronización productiva finalizó con **37 Deals financieros actualizados** y **22 hitos Jira observados** en tres proyectos con fuente ejecutiva aprobada. Jira modificó seis observaciones respecto del estado previamente persistido: cinco en Banco Tanner y una en CloudOps Consalud. No se encontraron claves de issues inexistentes ni errores de API.

| Fuente | Alcance | Resultado | Evidencia |
|---|---:|---|---|
| Google Sheets financiero | 37 Deals | 0 insertados, 37 actualizados | `financial_sync_log.id = 270001`, estado `applied` |
| Jira | 3 proyectos | 22 hitos observados, 6 modificados | Ejecución 2026-08-26 22:43:29–22:43:33 UTC |

## Resultado Jira por proyecto

| Proyecto | Space Jira | Hitos | Modificados | Cumplidos | Vencidos | Pendientes | Sin estado Jira |
|---|---|---:|---:|---:|---:|---:|---:|
| Banco Tanner — Implementación SFA | `PBTISD1` | 10 | 5 | 3 | 4 | 3 | 0 |
| Consalud — Implementación Apigee | `PCIAD4` | 3 | 0 | 0 | 0 | 3 | 0 |
| Consalud — Servicio CloudOps | `PSCSC4S` | 9 | 1 | 4 | 0 | 5 | 0 |

## Incidencia de calidad de datos

El proyecto **180003 — Consalud Implementación Apigee** tiene tres hitos en estado Jira `Pendiente`, pero los issues no contienen `duedate`. El sincronizador preservó el estado y dejó la fecha planificada vacía; no se generaron fechas ficticias.

| Hito | Issue Jira | Nombre | Estado Jira | Fecha planificada |
|---|---|---|---|---|
| M01 | `PCIAD4-11` | H1 - 33.4%: Habilitación de Plataforma | Pendiente | **[PENDIENTE EN JIRA]** |
| M02 | `PCIAD4-12` | H2 - 33.4%: Pipeline de Proxys | Pendiente | **[PENDIENTE EN JIRA]** |
| M03 | `PCIAD4-13` | H3 - 33.4%: Adopción Inicial | Pendiente | **[PENDIENTE EN JIRA]** |

> Para corregir esta incidencia se deben definir las fechas planificadas directamente en Jira. Una nueva sincronización trasladará esos valores al PMO. No corresponde completar estas fechas manualmente en la base PMO sin evidencia de Jira.

## Validaciones

Todos los 22 hitos tienen estado Jira sincronizado. Banco Tanner y CloudOps tienen fecha planificada para todos sus hitos. Consalud Apigee conserva tres fechas planificadas pendientes en la fuente Jira. La ejecución no reportó errores ni issues faltantes.
