# Migración del vínculo JSM de Camanchaca a CAMANSOP01

**Fecha:** 22 de septiembre de 2026  
**Servicio PMO:** `2100001` — Deal 2383_Soporte y Evolutivo Camanchaca  
**Decisión de autoridad:** Aiza confirmó que `CAMANSOP01` contiene la verdad operacional.

## Resultado ejecutivo

El servicio recurrente de Camanchaca quedó vinculado localmente en PMO al Space JSM oficial **CAMANSOP01**, Project ID `13011` y Service Desk ID `331`. El vínculo anterior **CAMANSOP02**, Project ID `13080` y Service Desk ID `365`, se conserva intacto en Jira/JSM como antecedente histórico, pero dejó de alimentar el estado vigente del servicio en PMO.

La operación no creó, editó, eliminó ni transicionó tickets en Jira/JSM. Las únicas consultas externas fueron lecturas de identidad, permisos, catálogo de tipos, issues y SLA. Los cambios se limitaron a la base PMO, sus respaldos, auditoría, corridas de vínculo y snapshots locales.

## Validación previa

El preflight GET-only confirmó que CAMANSOP01:

| Control | Resultado |
|---|---|
| Project ID | `13011` |
| Service Desk ID | `331` |
| Tipo de proyecto | `service_desk` |
| Archivado | No |
| Permiso de lectura | Disponible |
| Permiso de creación | Disponible; no utilizado durante esta migración |
| Vinculado a otro servicio PMO | No |
| Estado del preflight | `ready` |

Antes del cambio, las 27 actividades del plan PMO apuntaban a issues `CAMANSOP02-*`. La comparación de títulos encontró 27 coincidencias exactas contra CAMANSOP02 y ninguna coincidencia exacta contra CAMANSOP01. Por esta razón se archivaron las asociaciones antiguas y **no se realizó remapeo automático**.

## Respaldos

Se crearon tablas físicas antes de modificar el vínculo:

| Respaldo | Filas |
|---|---:|
| `backup_cam_jsm_service_20260922_truth` | 1 |
| `backup_cam_jsm_workplan_20260922_truth` | 27 |
| `backup_cam_jsm_billing_20260922_truth` | 6 |
| `backup_cam_jsm_mappings_20260922_truth` | 2 |
| `backup_cam_jsm_linkruns_20260922_truth` | 6 |
| `backup_cam_jsm_syncruns_20260922_truth` | 1 |
| `backup_cam_jsm_snapshots_20260922_truth` | 1 |
| `backup_cam_jsm_audit_20260922_truth` | 45 |

Los respaldos no deben eliminarse mientras CAMANSOP01 permanezca en observación inicial.

## Cambios locales aplicados

La transacción local realizó las siguientes operaciones:

1. Eliminó de la vista operacional las 27 referencias `jiraIssueKey` hacia CAMANSOP02, preservándolas íntegramente en el respaldo del plan de trabajo.
2. Marcó como `superseded` los dos mapeos de tipos asociados al Space anterior.
3. Actualizó el servicio a `jsmProjectKey = CAMANSOP01`, `jsmProjectId = 13011` y `jsmServiceDeskId = 331`.
4. Registró una corrida local `camanchaca-authority-switch-20260922-link` con estado `linked`.
5. Registró auditoría `jsm_authoritative_space_migration` para el servicio `2100001`.
6. Revalidó el vínculo mediante GET-only y registró la corrida `camanchaca-authority-switch-20260922-revalidate` con estado `ready`.
7. Generó un snapshot manual local desde CAMANSOP01.

La etapa del servicio se preservó como **JSM Setup en progreso**. No se cerró ninguna etapa automáticamente.

## Evidencia posterior

| Control | Resultado |
|---|---|
| Fuente vigente PMO | `CAMANSOP01` / Project `13011` / Desk `331` |
| Issues leídos desde CAMANSOP01 | 39 |
| Issues abiertos | 16 |
| Críticos abiertos | 0 |
| Estado del snapshot | `partial` |
| Código de parcialidad | `JSM_SLA_PARTIAL` |
| Snapshot nuevo | `60001` |
| Issues existentes en CAMANSOP02 | 27, preservados sin modificación |
| Actividades PMO vinculadas automáticamente | 0 de 27 |
| Hitos de facturación vinculados automáticamente | 0 de 6 |
| Pendientes visibles en JSM Setup | 33 |

El estado `partial` no implica que el vínculo sea incorrecto. Significa que fue posible leer los 39 issues, pero no todas las solicitudes entregaron métricas SLA a la identidad técnica. Los conteos de incidentes son utilizables; los porcentajes SLA faltantes deben continuar como **N/D**.

## Estado operativo y siguiente decisión

CAMANSOP01 ya es la fuente operacional del dashboard y del snapshot recurrente. La pantalla JSM Setup muestra 33 elementos PMO pendientes porque no existe una correspondencia determinista entre esos elementos y los issues históricos del Space oficial.

No se deben seleccionar mappings y confirmar una sincronización masiva sin una decisión explícita: esa acción podría crear tickets duplicados dentro de CAMANSOP01. El trabajo pendiente correcto es una conciliación manual o asistida, con aprobación individual de correspondencias. Los elementos sin equivalencia deben permanecer sin `jiraIssueKey`.

## Rollback

Un rollback requiere autorización administrativa explícita. El procedimiento seguro es:

1. Pausar temporalmente el refresco y cualquier sincronización JSM del servicio `2100001`.
2. Restaurar los campos `jsm*` de `recurring_services` desde `backup_cam_jsm_service_20260922_truth`.
3. Restaurar `jiraIssueKey` por `id` desde `backup_cam_jsm_workplan_20260922_truth`.
4. Restaurar los estados y valores de mappings desde `backup_cam_jsm_mappings_20260922_truth`.
5. Revalidar CAMANSOP02 mediante GET-only y generar un snapshot nuevo.
6. Conservar las corridas, snapshots y auditorías de la migración; no borrarlas, porque forman parte de la trazabilidad administrativa.

Este rollback no debe eliminar CAMANSOP01 ni CAMANSOP02, ni modificar tickets externos.
