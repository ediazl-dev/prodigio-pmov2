# Bitácora de implementación — Vinculación de Spaces JSM existentes

**Inicio:** 16 de septiembre de 2026  
**Autor:** Manus AI  
**Proyecto:** Prodigio PMO Platform

## J0 — Contrato canónico y alcance operativo

**Estado:** completado.

La implementación seguirá una relación uno-a-uno entre un servicio recurrente y un Space JSM. La identidad se compone del `projectId` de Jira y el `serviceDeskId` de JSM; `projectKey` y `projectName` se conservarán como referencias operativas revalidables.

La primera versión permitirá descubrir, diagnosticar y vincular un Space JSM existente. La vinculación persistirá únicamente datos en PMO y no importará tickets, no creará issues, no modificará configuración del Space y no cerrará automáticamente la etapa `jira_setup`.

Los roles `admin` y `pmo` podrán vincular, revalidar o desvincular cuando se cumplan las reglas de integridad. Los roles `pm` y `consulta` tendrán acceso de lectura. Una desvinculación quedará bloqueada mientras existan actividades o facturaciones con `jiraIssueKey` asociado.

El preflight será de solo lectura y tendrá estados explícitos para candidato válido, vínculo idempotente, conflicto con otro servicio, proyecto no JSM, falta de acceso, incompatibilidad de issue types, identidad modificada y error técnico.

### Gate R0

| Control | Resultado |
|---|---|
| Base | `a04a993` |
| Rama | `main` |
| Alineamiento `user_github/main` | `0/0`, sin divergencia |
| Árbol antes de J0 | Solo `todo.md`, correspondiente al backlog aprobado |
| Escrituras Jira/JSM | Ninguna |
| Bloque actual | J0 exclusivamente |

### Criterios de salida J0

| Criterio | Resultado |
|---|---|
| Cardinalidad uno-a-uno | Confirmada |
| Importación automática de tickets | Fuera de alcance |
| Cierre automático de JSM Setup | Prohibido |
| Política de desvinculación | Bloqueada con issues asociados |
| Fuente de verdad externa | API de Service Desks + proyecto Jira |
| Autorización para ejecutar J1–J7 | Recibida del usuario |

## Próximo bloque

J1 implementará exclusivamente el modelo de datos e integridad: origen del vínculo, snapshot de nombre, URLs diferenciadas, metadatos de verificación, mapeos de issue types y corridas de preflight. La migración será aditiva y se revisará antes de aplicarla.
