# Certificación J7 — Vinculación de Spaces JSM existentes

**Fecha:** 16 de septiembre de 2026  
**Sistema:** Prodigio PMO Platform  
**Alcance:** backlog J0–J7 para vincular un Jira Service Management Service Desk existente a un servicio recurrente.

## 1. Dictamen

La implementación cumple el contrato aprobado: permite descubrir y diagnosticar Service Desks con operaciones de solo lectura, asociar su identidad al servicio recurrente exclusivamente en PMO, configurar mappings explícitos y ejecutar una sincronización posterior solo mediante dry-run y confirmación vigente.

> La certificación no modificó Jira/JSM, no vinculó ningún Space productivo, no importó tickets y no cerró etapas automáticamente.

## 2. Cobertura funcional

| Fase | Capacidad certificada                                                     |
| ---- | ------------------------------------------------------------------------- |
| J0   | Contrato, cardinalidad, permisos y límites de seguridad                   |
| J1   | Identidad dual, origen, salud, corridas, mappings e índices únicos        |
| J2   | Catálogo paginado y preflight GET-only                                    |
| J3   | API, persistencia, vínculo idempotente, revalidación y desvinculación     |
| J4   | Mappings explícitos, dry-run, stale detection y sincronización confirmada |
| J5   | Flujo Crear/Vincular en JSM Setup                                         |
| J6   | Inventario Administración > Spaces JSM                                    |
| J7   | Matriz integral, validación visual y manual operativo                     |

## 3. Resultados de pruebas

| Capa              | Resultado                                                         |
| ----------------- | ----------------------------------------------------------------- |
| Unitarias/focales | 5 archivos, 33 pruebas aprobadas y 1 opt-in omitida por defecto   |
| Persistentes      | J1, J3 y J4 aprobadas contra la base real con fixtures aislados   |
| Live read-only    | Catálogo/preflight y contexto de sync aprobados mediante GET-only |
| SQL posterior     | Cero fixtures y cero vínculos JSM huérfanos                       |
| Producción        | Build Vite/ESBuild exitoso                                        |
| TypeScript        | Cero errores nuevos; cinco errores históricos documentados        |

## 4. Seguridad operacional

| Control                               | Estado certificado                                  |
| ------------------------------------- | --------------------------------------------------- |
| Asociación por título                 | Prohibida                                           |
| Identidad del vínculo                 | Project key + Jira Project ID + JSM Service Desk ID |
| Space ocupado por otro servicio       | Bloqueado                                           |
| Servicio ya vinculado a otro Space    | Bloqueado                                           |
| Preflight vencido o alterado          | Bloqueado por fingerprint                           |
| Repetición de una operación           | Idempotente                                         |
| Creación de issues antes de confirmar | Prohibida                                           |
| Fallback a tipo `Task`                | Eliminado del flujo seguro                          |
| Desvinculación con `jiraIssueKey`     | Bloqueada                                           |
| Autocierre de `jira_setup`            | Prohibido                                           |
| Escritura Admin/PMO                   | Permitida según operación explícita                 |
| PM/consulta                           | Solo lectura                                        |

## 5. Validación visual

JSM Setup fue revisado con un servicio sin vínculo y conserva una elección explícita entre **Crear nuevo Space** y **Vincular Space existente**. El inventario administrativo fue revisado con el catálogo real de 15 Service Desks y muestra filtros, métricas, estado de vínculo, salud, origen, acceso al servicio y enlaces separados para agentes y clientes.

Las vistas se verificaron en escritorio a 1440 × 1000 px y en móvil a 390 × 844 px. Los filtros se apilan, las tarjetas permanecen legibles y no se observó scroll horizontal funcionalmente bloqueante.

## 6. Restricciones conocidas

El proyecto mantiene cinco deudas TypeScript históricas ajenas a JSM: cuatro en `server/jiraMilestoneSync.ts` y una en `server/routers.ts`. Se conservaron como deuda preexistente para no mezclar alcances en el checkpoint final.

No se ejecutó un piloto de asociación productiva. Esa acción debe realizarse posteriormente con un servicio y Service Desk expresamente autorizados, siguiendo el manual operativo y verificando el resultado del preflight antes de confirmar.

## 7. Documentos de referencia

- `docs/BACKLOG_VINCULACION_SPACES_JSM_EXISTENTES_2026-09-16.md`
- `docs/IMPLEMENTACION_VINCULACION_JSM_EXISTENTE_LOG.md`
- `docs/MANUAL_OPERATIVO_VINCULACION_SPACES_JSM_EXISTENTES_2026-09-16.md`
- `docs/research/ATLASSIAN_JSM_EXISTING_SPACE_LINKING_2026-09-16.md`
