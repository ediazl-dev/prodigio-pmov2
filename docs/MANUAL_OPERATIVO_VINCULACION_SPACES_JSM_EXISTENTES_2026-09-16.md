# Manual operativo: vinculación segura de Spaces JSM existentes

**Versión:** 1.0  
**Fecha:** 16 de septiembre de 2026  
**Audiencia:** Administración, PMO, Project Managers y usuarios de consulta  
**Preparado por:** Manus AI para Prodigio Tech  
**Clasificación:** Uso interno

---

## Propósito

Este manual explica cómo incorporar a un servicio recurrente de Prodigio PMO un **Space de Jira Service Management que ya existe**, sin recrearlo, renombrarlo ni modificar su configuración durante el diagnóstico o la vinculación. También describe cómo configurar los tipos de issue, revisar un dry-run, confirmar una sincronización y mantener o retirar el vínculo de forma controlada.[1]

> **Principio rector:** un contrato corresponde a un único Space JSM y cada servicio recurrente puede mantener como máximo un vínculo activo. La identidad se valida con `projectId` y `serviceDeskId`; el nombre es informativo y nunca se usa para vincular automáticamente.[1]

## Alcance y límites de seguridad

El proceso separa deliberadamente la **asociación** de la **sincronización**. Buscar, ejecutar preflight, confirmar el vínculo y revalidar solo consultan Jira/JSM y actualizan metadatos dentro de Prodigio. La creación de issues ocurre únicamente después de configurar mappings, ejecutar un dry-run y confirmar expresamente esa corrida.

| Operación                |      ¿Lee Jira/JSM? |            ¿Escribe Jira/JSM? |      ¿Actualiza PMO? | ¿Cierra etapa? |
| ------------------------ | ------------------: | ----------------------------: | -------------------: | -------------: |
| Buscar Spaces            |                  Sí |                            No |                   No |             No |
| Ejecutar preflight       |                  Sí |                            No | Sí, registra corrida |             No |
| Vincular Space existente |        Sí, revalida |                            No |                   Sí |             No |
| Revalidar vínculo        |                  Sí |                            No |                   Sí |             No |
| Guardar mappings         |    Sí, valida tipos |                            No |                   Sí |             No |
| Ejecutar dry-run         |                  Sí |                            No |    Sí, registra plan |             No |
| Confirmar sincronización | Sí, valida vigencia | **Sí, crea issues faltantes** |                   Sí |             No |
| Asociar issue existente  |                  Sí |                            No |                   Sí |             No |
| Desvincular              |                  No |                            No |                   Sí |             No |

No se importan tickets existentes automáticamente, no se asocian issues por coincidencia de título y ningún paso completa `jira_setup` sin una acción separada del usuario.[1]

## Roles y permisos

| Rol      | Ver inventario y estado | Buscar y ejecutar preflight | Vincular, mapear, sincronizar, revalidar o desvincular |
| -------- | ----------------------: | --------------------------: | -----------------------------------------------------: |
| Admin    |                      Sí |                          Sí |                                                     Sí |
| PMO      |                      Sí |                          Sí |                                                     Sí |
| PM       |                      Sí |                          No |                                                     No |
| Consulta |                      Sí |                          No |                                                     No |

PM y consulta acceden a las mismas evidencias operativas en modo de solo lectura. Si un control de modificación no aparece, confirme primero el rol del usuario; no cambie datos directamente en la base para eludir el permiso.

## Índice operativo

1. Verificar prerrequisitos.
2. Consultar el inventario de Spaces JSM.
3. Abrir JSM Setup del servicio recurrente.
4. Elegir crear o vincular.
5. Buscar y seleccionar un Space existente.
6. Ejecutar y revisar el preflight.
7. Confirmar el vínculo.
8. Configurar mappings de issue types.
9. Ejecutar el dry-run.
10. Confirmar la sincronización.
11. Asociar manualmente un issue existente.
12. Cerrar JSM Setup.
13. Revalidar o desvincular.
14. Resolver errores frecuentes.

---

# 1. Verificar prerrequisitos

Antes de iniciar, confirme que existe un servicio recurrente en Prodigio, que su plataforma JSM será **Prodigio** y que la cuenta técnica posee permisos de lectura y creación de issues en el Space candidato. El preflight comprueba estos permisos; no los otorga ni cambia la configuración Jira.

| Requisito                     | Evidencia esperada                                         | Si falta                                          |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Servicio recurrente existente | Aparece en **Servicios Recurrentes**                       | Complete primero Inicialización y Plan de Trabajo |
| Space JSM real                | Es visible en la API de Service Desks                      | Solicite acceso a la cuenta técnica               |
| Proyecto tipo JSM             | `projectTypeKey = service_desk`                            | No use un proyecto Jira Business                  |
| Identidad libre               | Project ID y Service Desk ID no pertenecen a otro servicio | Revise el servicio propietario informado          |
| Rol operativo                 | Admin o PMO                                                | Solicite el rol correspondiente                   |

> **Caso de seguridad conocido:** `PSCSC4S` corresponde a un proyecto Jira de tipo `business` ya vinculado por el flujo PMO. No debe seleccionarse, convertirse ni utilizarse como Space JSM.

# 2. Consultar Administración > Spaces JSM

Abra **Administración → Spaces JSM** en la barra lateral. Esta vista consulta el catálogo real y lo cruza con los vínculos almacenados en Prodigio. Use **Actualizar** para repetir la lectura cuando necesite información reciente.

Puede buscar por nombre, project key, Project ID, Service Desk ID, cliente o servicio recurrente. Los filtros permiten distinguir Spaces vinculados/disponibles, su salud y su origen.

| Indicador          | Interpretación                                |
| ------------------ | --------------------------------------------- |
| Total              | Service Desks visibles para la cuenta técnica |
| Vinculados         | Spaces asociados a un servicio recurrente     |
| Disponibles        | Spaces sin propietario local                  |
| Saludables         | Vínculos que aprobaron la última verificación |
| Requieren atención | Vínculos `warning`, `blocked` o `pending`     |

Desde una tarjeta vinculada puede abrir el servicio recurrente, la vista de agentes o el portal de clientes. Admin/PMO también pueden revalidar cuando existe un Service Desk ID completo.

# 3. Abrir JSM Setup

Ingrese a **Servicios Recurrentes**, abra el servicio correcto y seleccione la etapa **JSM Setup**. Revise el encabezado del servicio antes de continuar, especialmente cliente, nombre y plataforma.

El pipeline recurrente conserva cinco etapas independientes:

`Inicialización → Plan de Trabajo → JSM Setup → Ejecución → Cierre`

Vincular un Space o sincronizar issues no avanza la etapa automáticamente.

# 4. Elegir Crear o Vincular

Si el servicio todavía no tiene un vínculo, la pantalla presenta dos alternativas:

| Alternativa              | Cuándo usarla                           | Efecto externo                               |
| ------------------------ | --------------------------------------- | -------------------------------------------- |
| Crear nuevo Space        | El contrato aún no dispone de JSM       | Crea un proyecto JSM después de confirmación |
| Vincular Space existente | El contrato ya opera en un Service Desk | No modifica Jira/JSM                         |

Seleccionar una tarjeta solo cambia el modo de trabajo. Ninguna operación comienza hasta pulsar el botón correspondiente.

# 5. Buscar y seleccionar un Space existente

Seleccione **Vincular Space existente** y escriba al menos parte del nombre, key o identificador. Revise cuidadosamente cada resultado y elija uno solo.

No continúe si el resultado aparece como **Vinculado** a otro servicio. Tampoco utilice similitud de nombres como evidencia: confirme project key, Project ID y Service Desk ID.

Al cambiar la selección o la búsqueda, cualquier preflight anterior queda descartado en la interfaz. Debe ejecutar uno nuevo para el candidato actual.

# 6. Ejecutar y revisar el preflight

Pulse **Ejecutar preflight**. El diagnóstico realiza solo operaciones GET y registra una corrida auditable en PMO. Revise el estado, los permisos, la identidad, los issue types y todos los mensajes antes de confirmar.

| Estado                            | Significado                                   | Acción                                    |
| --------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `ready`                           | Candidato válido y disponible                 | Puede confirmar                           |
| `already_linked_same_service`     | El mismo vínculo ya existe                    | Puede confirmar de forma idempotente      |
| `linked_to_other_service`         | La identidad pertenece a otro servicio        | No continúe; abra el servicio propietario |
| `not_service_desk`                | El proyecto Jira no es JSM                    | Seleccione otro Space                     |
| `service_desk_not_accessible`     | Falta acceso de lectura                       | Corrija permisos en Jira y repita         |
| `missing_create_issue_permission` | Falta permiso para crear issues               | Corrija permisos antes de sincronizar     |
| `archived_or_inactive`            | El proyecto no está operativo                 | Regularice el Space o seleccione otro     |
| `identity_changed`                | El proyecto ya no coincide con el diagnóstico | Ejecute un preflight nuevo                |
| `missing_issue_type_mapping`      | Un mapping guardado dejó de ser válido        | Reconfigure mappings                      |

Las advertencias no se ocultan. Un Space válido puede advertir que aún faltan mappings; esto permite vincularlo, pero no sincronizar issues.

# 7. Confirmar el vínculo

Cuando el preflight permita continuar, pulse **Vincular este Space**. El servidor vuelve a consultar Jira/JSM y compara el diagnóstico actual con la corrida aprobada. Si cambió la identidad, los permisos o la configuración, la operación se rechaza como preflight obsoleto y deberá diagnosticar nuevamente.

Una confirmación exitosa guarda en Prodigio:

| Campo                    | Uso                                                 |
| ------------------------ | --------------------------------------------------- |
| Project key e ID         | Identidad del proyecto Jira subyacente              |
| Service Desk ID          | Identidad JSM                                       |
| Nombre                   | Etiqueta informativa, no clave de asociación        |
| URL de agentes           | Acceso operativo interno                            |
| URL de portal            | Acceso de clientes                                  |
| Origen                   | `linked` para Space existente; `created` para nuevo |
| Salud y verificación     | Resultado y fecha de la última validación           |
| Actor y fecha de vínculo | Trazabilidad administrativa                         |

> **Resultado esperado:** el Space queda asociado localmente al servicio; Jira/JSM permanece sin cambios y no se importa ningún ticket.

# 8. Configurar mappings de issue types

Después de vincular, configure los tipos que Prodigio utilizará para cada categoría aplicable:

| Categoría PMO   | Contenido                      | Mapping requerido                      |
| --------------- | ------------------------------ | -------------------------------------- |
| Plan de trabajo | Actividades operativas         | Issue type no-subtask del proyecto JSM |
| Facturación     | Mensualidades o hitos de cobro | Issue type no-subtask del proyecto JSM |

La lista proviene del proyecto Jira real. No escriba nombres libres ni presuponga que existe `Task`. Si una categoría tiene elementos, su mapping es obligatorio para generar un dry-run válido.

Pulse **Guardar mappings**. El servidor vuelve a verificar que los IDs seleccionados siguen disponibles y guarda sus nombres canónicos.

# 9. Ejecutar el dry-run

Pulse **Ejecutar dry-run**. Este paso consulta Jira, revisa cada actividad y mensualidad, y genera un plan sin crear issues.

| Clasificación    | Interpretación                                    |
| ---------------- | ------------------------------------------------- |
| `create`         | El elemento está listo para crear un issue nuevo  |
| `already_linked` | Ya posee una clave Jira válida y coherente        |
| `blocked`        | Existe una inconsistencia que requiere resolución |

Si Prodigio detecta en Jira la etiqueta técnica de un elemento sin vínculo local, lo bloquea y solicita una asociación manual. No enlaza por título ni adopta automáticamente el issue encontrado.

# 10. Confirmar la sincronización

Revise el resumen y confirme solo si el dry-run no tiene bloqueos. La confirmación recalcula el fingerprint; si cambió el plan de trabajo, la facturación, los mappings o las asociaciones, se rechaza la corrida como obsoleta.

Pulse **Confirmar sincronización** una sola vez. La corrida se reclama atómicamente para evitar ejecuciones simultáneas. A partir de este punto sí se crean en Jira los issues clasificados como `create`, usando el `issueTypeId` explícito de cada categoría.

Una corrida puede terminar:

| Estado    | Significado                                                       |
| --------- | ----------------------------------------------------------------- |
| `applied` | Todos los elementos planificados quedaron creados o ya vinculados |
| `partial` | Hubo fallos individuales; revise el detalle antes de reintentar   |
| `stale`   | El estado cambió desde el dry-run; genere uno nuevo               |
| `blocked` | El plan contiene conflictos pendientes                            |

Un reintento no debe duplicar elementos ya asociados. Revise siempre el historial antes de generar otro dry-run.

# 11. Asociar manualmente un issue existente

Use esta opción únicamente cuando el dry-run detecte un issue ya existente para el elemento técnico. Ingrese la **clave Jira exacta**. El sistema valida que el issue pertenezca al proyecto vinculado, tenga el tipo configurado para la categoría y no esté asociado a otra entidad local.

No copie claves desde otro proyecto y no intente resolver el conflicto modificando el título. Si la clave no supera las validaciones, mantenga el elemento bloqueado y revise Jira con el administrador correspondiente.

# 12. Cerrar JSM Setup

La etapa se puede cerrar únicamente cuando se cumplen todas las condiciones aplicables:

| Condición           | Criterio                                          |
| ------------------- | ------------------------------------------------- |
| Plataforma definida | Prodigio o URL del cliente                        |
| Space Prodigio      | Vínculo JSM persistido                            |
| Mappings            | Cada categoría con elementos tiene mapping activo |
| Plan de trabajo     | Todas las actividades poseen `jiraIssueKey`       |
| Facturación         | Todas las mensualidades poseen `jiraIssueKey`     |

El cierre se solicita con su control independiente. Ni el vínculo ni la sincronización cierran la etapa por sí solos.

# 13. Revalidar o desvincular

Use **Revalidar** para actualizar salud, identidad, permisos e issue types. La operación consulta Jira/JSM y actualiza metadatos PMO, pero no crea ni modifica issues.

Para desvincular, abra la acción correspondiente e ingrese un motivo descriptivo de al menos diez caracteres. La operación se bloquea si alguna actividad o mensualidad conserva una `jiraIssueKey`. Primero debe resolver formalmente esas asociaciones; no borre claves para forzar la desvinculación sin una decisión de gobierno.

Una desvinculación válida limpia el vínculo activo, conserva la corrida con la identidad anterior para auditoría y marca los mappings como `superseded`.

# 14. Auditoría

Las operaciones gobernadas dejan eventos explícitos en `audit_logs`.

| Evento                    | Significado                                    |
| ------------------------- | ---------------------------------------------- |
| `jsm_existing_preflight`  | Se diagnosticó un candidato                    |
| `jsm_existing_link`       | Se confirmó un vínculo local                   |
| `jsm_existing_revalidate` | Se revisó nuevamente un vínculo                |
| `jsm_existing_unlink`     | Se desvinculó con motivo                       |
| `jsm_mapping_save`        | Se actualizaron mappings explícitos            |
| `jsm_sync_dry_run`        | Se generó un plan de sincronización            |
| `jsm_sync_confirm`        | Se confirmó una corrida que puede crear issues |
| `jsm_issue_associate`     | Se vinculó manualmente una clave existente     |

El historial técnico conserva IDs, estados y resúmenes operativos, pero no debe registrar credenciales ni tokens.

# 15. Solución de problemas

| Mensaje o síntoma         | Causa probable                                                   | Acción segura                                                    |
| ------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------- |
| No aparecen Spaces        | La cuenta técnica no ve Service Desks o Jira responde lentamente | Reintente una vez; luego valide permisos y conectividad          |
| Proyecto no es JSM        | Se seleccionó un proyecto `business`                             | Seleccione un Service Desk real; no convierta el proyecto        |
| Vinculado a otro servicio | La identidad ya tiene propietario PMO                            | Abra el servicio informado; no fuerce un segundo vínculo         |
| Preflight obsoleto        | Cambió Jira/JSM o la configuración local                         | Ejecute un nuevo preflight                                       |
| Falta mapping             | La categoría no tiene issue type válido                          | Seleccione uno desde la lista real y guarde                      |
| Dry-run bloqueado         | Hay asociación inconsistente o falta un mapping                  | Resuelva cada bloqueo antes de confirmar                         |
| Issue fuera del proyecto  | La clave ingresada pertenece a otro Space                        | Use la clave correcta del proyecto vinculado                     |
| Desvinculación bloqueada  | Existen `jiraIssueKey` asociados                                 | Revise plan y facturación; no elimine evidencia sin autorización |
| Cierre bloqueado          | Faltan mappings o claves en elementos aplicables                 | Complete la matriz mostrada por la pantalla                      |

# 16. Checklist de aceptación para un piloto

Antes de vincular un Space productivo, el responsable Admin/PMO debe confirmar:

- [ ] El servicio recurrente correcto está abierto en JSM Setup.
- [ ] El nombre, project key, Project ID y Service Desk ID fueron contrastados.
- [ ] El preflight está `ready` o `already_linked_same_service`.
- [ ] No existe otro servicio propietario de la identidad.
- [ ] Los permisos Browse y Create están disponibles.
- [ ] La confirmación de vínculo no creó ni importó tickets.
- [ ] Los mappings provienen de issue types reales y vigentes.
- [ ] El dry-run fue revisado y no contiene bloqueos.
- [ ] La sincronización fue autorizada conscientemente.
- [ ] Plan de trabajo y facturación muestran sus claves Jira.
- [ ] El cierre de `jira_setup` se ejecutó como acción separada.
- [ ] Auditoría e historial contienen las operaciones realizadas.

> **Salida controlada:** la versión queda preparada para un piloto, pero la selección y vinculación de un Space productivo requiere autorización específica del usuario sobre el servicio y el Service Desk concretos.

## Referencias

[1]: ./BACKLOG_VINCULACION_SPACES_JSM_EXISTENTES_2026-09-16.md "Backlog técnico de vinculación de Spaces JSM existentes"
[2]: ./IMPLEMENTACION_VINCULACION_JSM_EXISTENTE_LOG.md "Bitácora de implementación J0–J7"
