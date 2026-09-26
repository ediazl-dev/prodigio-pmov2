# Baseline documental D0

**Fecha:** 25-sep-2026  
**Base:** `bec4f06a`  
**Modo:** consultas de solo lectura; no se modificaron datos.

## Universo operativo

| Entidad | Abiertos | Históricos |
|---|---:|---:|
| Proyectos PMO | 8 activos | 4 completados |
| Servicios recurrentes | 3 activos | 0 |

No existen proyectos o servicios pausados/cancelados en el corte observado.

## Fuentes documentales disponibles

| Fuente | Registros | Entidades | Observación |
|---|---:|---:|---|
| SoW nativo aprobado | 11 | 11 | Existe además 8 borradores |
| Gantt cargada | 3 | 1 | Varias versiones para una entidad |
| SoW vinculado | 6 | 6 | Documento de proyecto Jira vinculado |
| Gantt vinculado | 6 | 5 | Un proyecto tiene más de un documento |
| Baseline ejecutivo aprobado | 4 | 4 | Fuente contractual versionada |
| Hitos contractuales | 28 | 4 | Ninguno trae `jiraClosedDate` materializado en esta tabla |
| Actas aceptadas | 13 | 2 | Deben vincularse por hito; no se infieren desde Jira |
| Minutas recibidas | 20 | 1 | Ninguna está marcada como revisada en este corte |
| Planes de recuperación borrador | 2 | 1 | No acreditan plan vigente |
| Recibos de carga | 7 | 1 | 2 pendientes y 5 adjuntados |
| Documentos de servicios | 12 | 3 | Contrato, SoW, propuesta y plan para cada servicio |
| Controles documentales de servicios | 0 | 0 | La validez queda `Por confirmar`, no cumplida |
| Reportes periódicos de servicios | 0 | 0 | No se inventarán períodos ni entregas |

## Calidad y trazabilidad

- Los cinco recibos `attached` tienen `attachedEntityType` y `attachedEntityId` completos.
- Existen dos grupos de recibos con el mismo hash; se preservan hasta revisar si corresponden a usos legítimos del mismo archivo.
- No hay duplicados de documentos de servicios por servicio, tipo y nombre.
- No hay huérfanos en Gantt, documentos vinculados, hitos, actas, minutas, planes, recibos, documentos de servicios o reportes periódicos.
- Existen 16 registros históricos de `sow_documents` cuyo `projectId` ya no existe. No se borran ni se presentan como proyectos; se contabilizarán como alerta de calidad `Evidencia sin entidad vigente`.

## Casos de validación

| Caso | Ciclo esperado | Tipo |
|---|---|---|
| Tanner PMO-180002 | Abierto | Proyecto vinculado |
| CCLA PMO-2670001 | Abierto | Proyecto vinculado |
| Staffing PMO-510001 | Abierto | Proyecto vinculado |
| Ruta Pass PMO-210001 | Histórico | Proyecto vinculado |
| MaxAgro PMO-300001 | Histórico | Proyecto nativo |
| Caja Los Andes PMO-330001 | Histórico | Proyecto nativo |
| Camanchaca servicio 2100001 | Abierto | Servicio recurrente |

## Baseline técnico

El checkpoint base registra 924 pruebas deterministas aprobadas, 19 omitidas, build exitoso y cinco errores TypeScript heredados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts`. El nuevo módulo no debe aumentar esta deuda.

## Guardrails

- Lecturas documentales y Jira/JSM permanecen sin escrituras externas.
- Un recibo de carga no equivale a evidencia válida.
- Un cierre Jira no equivale a aceptación contractual.
- Documentos de servicios sin control de validación se muestran como `Presente, pendiente de validación`.
- Los registros huérfanos se reportan como calidad de datos; no se eliminan ni se asignan a otra entidad.
