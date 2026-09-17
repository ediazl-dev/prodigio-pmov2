# Diagnóstico — vínculo JSM de Camanchaca

## Evidencia recibida

La captura del 17 de septiembre de 2026 muestra el servicio **Deal 2383_Soporte y Evolutivo Camanchaca** en la etapa **JSM Setup**. La interfaz presenta la plataforma **Prodigio (JSM)** y el proyecto `CAMANSOP02`.

El mismo panel identifica el registro como **origen pendiente de homologar** y estado **Pendiente de validar**. Muestra `projectKey = CAMANSOP02`, `projectId = 13080`, `serviceDeskId = Pendiente` y `última verificación = Aún no registrada`. Un aviso indica que el registro debe completar Project ID y Service Desk ID mediante revisión administrativa antes de poder revalidarse.

Por tanto, la evidencia demuestra que existe un proyecto Jira visible y con issues asociados, pero no demuestra todavía un vínculo JSM confirmado para lectura de solicitudes y ciclos SLA. La investigación debe determinar si el `serviceDeskId` puede recuperarse mediante la revalidación GET-only o si el registro productivo quedó incompleto durante una migración anterior.

## Verificación técnica

La base productiva confirma que el servicio `2100001` está activo y conserva `jsmProjectKey = CAMANSOP02` y `jsmProjectId = 13080`, pero tiene `jsmServiceDeskId`, `jsmLinkHealth`, `jsmLastVerifiedAt` y `jsmLinkedAt` en `NULL`. Por esa razón el runner D9 lo clasifica correctamente como `jsm_not_configured`, aun cuando la pantalla pueda listar los 27 issues Jira ya creados.

La consulta oficial GET-only a Jira/JSM confirmó que `CAMANSOP02` sí es un proyecto de tipo `service_desk`, no está archivado y corresponde de forma única al Service Desk `365`. La identidad técnica tiene permisos `BROWSE_PROJECTS` y `CREATE_ISSUES`. En consecuencia, la causa raíz no es que Camanchaca carezca de JSM: es un **registro legado incompleto en PMO**, creado antes de persistir los metadatos de vínculo homologado.

La acción de **Revalidar vínculo** no puede reparar este caso porque el backend exige de antemano `jsmProjectId` y `jsmServiceDeskId`; además, la interfaz la deshabilita cuando esos campos no están completos. La reparación segura es ejecutar el flujo existente de preflight GET-only usando Service Desk `365` y luego confirmar localmente el vínculo para completar nombre, URLs, origen, salud y marcas de tiempo. Esta operación no crea ni modifica tickets en Jira/JSM.

## Resultado de la reparación y lectura operacional

El preflight oficial identificó el Service Desk `365` y permitió confirmar localmente el vínculo. El registro productivo quedó con `jsmLinkSource = linked`, `jsmLinkHealth = warning`, `jsmProjectId = 13080`, `jsmProjectKey = CAMANSOP02` y `jsmServiceDeskId = 365`. La actualización posterior procesó Camanchaca como servicio elegible y recuperó 27 solicitudes, de las cuales 18 están abiertas y ninguna tiene prioridad crítica.

El endpoint GET `/rest/servicedeskapi/request/CAMANSOP02-1/sla` respondió HTTP 403 con el mensaje oficial `You do not have permission to fetch the list of SLA custom fields`. El mismo resultado afecta las 27 solicitudes: los incidentes son legibles, pero la identidad técnica no puede leer sus ciclos SLA. Por tanto, la presentación correcta es **incidentes disponibles + SLA N/D + estado parcial**, no error total. Esta evidencia motivó una regresión para conservar los incidentes cuando todos los SLA son inaccesibles.

## Certificación de la corrección

Antes de modificar el vínculo se crearon cinco respaldos físicos: `backup_camanchaca_service_20260917`, `backup_camanchaca_jsm_issue_mappings_20260917`, `backup_camanchaca_jsm_link_runs_20260917`, `backup_camanchaca_jsm_snapshots_20260917` y `backup_camanchaca_jsm_sync_runs_20260917`.

| Control | Resultado |
|---|---|
| Vínculo JSM local | Confirmado con proyecto `13080`, key `CAMANSOP02` y Service Desk `365` |
| Escrituras en Jira/JSM | Ninguna; consultas externas en modo lectura |
| Solicitudes encontradas | 27 |
| Solicitudes abiertas | 18 |
| Incidentes críticos abiertos | 0 |
| Lectura SLA | N/D por HTTP 403 de permisos |
| Estado del snapshot | `partial` |
| Persistencia idempotente | 1 snapshot; la segunda interpretación reutilizó el ID `30001` |
| Pruebas focales | 21/21 aprobadas |
| Build | Exitoso |
| Revisión visual | Torre V2 muestra 27 incidentes, 18 abiertos y SLA N/D |

Se ajustó la semántica del recolector para que una lectura exitosa de incidentes con SLA inaccesible sea `partial`, reservando `error` para fallos que impiden recuperar el conjunto de incidentes. La persistencia por fingerprint mantiene una sola fila y permite actualizar únicamente `status`, `errorCode` y `errorMessage` cuando cambia la interpretación, sin alterar la fecha de captura ni duplicar snapshots.

El vínculo se conserva con salud `warning` porque la cuenta técnica aún no puede leer los campos SLA. Para obtener porcentajes de primera respuesta y resolución, un administrador de Jira debe otorgar a esa identidad permiso para consultar los campos SLA de las solicitudes de `CAMANSOP02`. Mientras ese permiso no exista, la Torre muestra N/D de forma explícita.

### Rollback

Si fuera necesario revertir la reparación, primero se debe pausar cualquier actualización JSM, restaurar exclusivamente los campos `jsm*` del servicio `2100001` desde `backup_camanchaca_service_20260917` y retirar el snapshot/auditorías posteriores a la reparación sólo con autorización. Las tablas de respaldo no deben eliminarse durante el rollback.
