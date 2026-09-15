# Diagnóstico y plan de remediación — creación JSM para Deal 4687

**Fecha:** 15 de septiembre de 2026  
**Servicio recurrente:** `Deal 4687_Servicio Staffing`  
**Cliente:** Isapre Consalud  
**Alcance:** diagnóstico y planificación; no se modificó Jira ni se alteraron datos del servicio.

## 1. Conclusión ejecutiva

El error no corresponde a una caída de Jira ni a un problema de permisos. Jira rechazó correctamente la solicitud porque el nombre y la clave enviados ya pertenecen a un proyecto existente.

La clave `PSCSC4S` identifica al proyecto Jira `12976`, denominado `[PMO_ST|Isapre Consalud] Servicio CloudOps|Deal 4687-4727-4775 - Staffing`. Ese proyecto es de tipo **`business`**, no de tipo **`service_desk`**, y ya está vinculado en Prodigio PMO al proyecto nativo `510001`.

El servicio recurrente `2040001` todavía no tiene proyecto JSM vinculado: `jsmProjectKey`, `jsmProjectId` y `jsmPortalUrl` permanecen nulos. Su etapa `jira_setup` continúa `in_progress`, mientras `ejecucion` y `cierre` siguen bloqueadas. Por lo tanto, el intento fallido no creó un segundo proyecto ni dejó una vinculación parcial en la PMO.

> **Recomendación:** conservar intacto `PSCSC4S` como proyecto PMO empresarial y crear para el servicio recurrente un proyecto JSM separado, con nombre y clave únicos previamente validados. No se debe convertir, renombrar ni reutilizar automáticamente el proyecto empresarial como mesa JSM.

## 2. Evidencia verificada

| Fuente | Evidencia | Interpretación |
|---|---|---|
| Error mostrado por la interfaz | Jira devolvió HTTP 400 por `projectName` existente y `projectKey` ya utilizada | La creación fue rechazada antes de obtener un nuevo proyecto |
| Consulta Jira por clave | `PSCSC4S`, ID `12976`, tipo `business`, estilo `classic` | La clave existe, pero no corresponde a un proyecto JSM |
| Búsqueda Jira por Deal 4687 | Existe un único proyecto coincidente: `PSCSC4S` | No se encontró un segundo proyecto JSM para ese Deal |
| Búsqueda Jira por Consalud | Los dos proyectos encontrados son de tipo `business` | No se identificó una mesa JSM existente que pueda vincularse automáticamente |
| Base PMO — servicio recurrente | Servicio `2040001`, Deal `4687`, plataforma `prodigio`, campos JSM nulos | La PMO todavía no tiene un vínculo JSM para este servicio |
| Base PMO — etapas | `jira_setup` en progreso; `ejecucion` y `cierre` bloqueadas | El pipeline quedó detenido de manera consistente, sin avance falso |
| Base PMO — proyecto empresarial | Proyecto `510001` vinculado a `PSCSC4S`, activo y en `design` | La identidad Jira ya está ocupada por otro objeto de negocio de la plataforma |
| Auditoría | No existe evento `jsm_project_create` para el servicio | El intento fallido no se registra hoy como evento auditable |

## 3. Causa raíz

### 3.1 Causa inmediata

La solicitud intentó crear un nuevo proyecto JSM usando exactamente la identidad de un proyecto empresarial existente. Jira exige unicidad tanto para la clave como para el nombre del proyecto, por lo que rechazó la operación.

### 3.2 Defecto funcional de la plataforma

La ruta `createJsmProject` llama directamente a `createJiraSpace`, que ejecuta un `POST /project`. No hay una verificación previa de disponibilidad del nombre y la clave, ni una comprobación del tipo del proyecto que ocupa esos identificadores.

### 3.3 Defecto de idempotencia y recuperación

Si una creación remota llegara a completarse en Jira y luego fallara la persistencia local, un reintento devolvería el mismo error de duplicidad. La implementación actual no relee Jira después de un conflicto para distinguir entre una colisión ajena y una creación previa recuperable del mismo servicio.

### 3.4 Defecto de experiencia de usuario y auditoría

La interfaz solo ofrece **Crear Proyecto JSM**. No existe un preflight, una advertencia contextual, una acción segura para vincular un JSM existente ni una propuesta de identidad alternativa. Además, el error técnico de Jira se muestra prácticamente sin normalización y el intento fallido no queda en auditoría.

## 4. Alternativas evaluadas

| Alternativa | Evaluación | Decisión recomendada |
|---|---|---|
| Renombrar o cambiar la clave de `PSCSC4S` | Alto riesgo: el proyecto está activo, vinculado a PMO y puede tener referencias externas | **Descartar** |
| Vincular `PSCSC4S` como JSM del servicio recurrente | Incompatible: Jira lo reporta como `business`, no `service_desk` | **Bloquear** |
| Crear un JSM separado con identidad única | Preserva el proyecto PMO y separa gestión de proyecto de mesa de servicio | **Recomendada** |
| Usar la plataforma JSM del cliente | Válida solo si el contrato y la operación definen esa modalidad | Alternativa de negocio, no corrección técnica automática |

## 5. Plan de remediación

### Fase R0 — Control de versión y respaldo lógico

Se ejecutará el gate de sincronización antes de cualquier cambio. Se guardará un checkpoint de base, se verificará árbol limpio y alineamiento con GitHub, y no se efectuarán operaciones destructivas ni cambios en proyectos Jira existentes.

**Criterio de salida:** versión base identificada y backlog del cambio registrado.

### Fase R1 — Preflight JSM de solo lectura

Se incorporará un procedimiento servidor que reciba `serviceId`, `spaceName` y `spaceKey`, normalice los valores y consulte tanto Jira como la PMO antes de habilitar la creación.

El resultado tendrá estados explícitos:

| Estado | Significado | Acción permitida |
|---|---|---|
| `available` | Nombre y clave libres | Permitir creación |
| `key_taken_business` | La clave pertenece a un proyecto Jira no JSM | Bloquear y solicitar otra clave |
| `name_taken_business` | El nombre pertenece a un proyecto Jira no JSM | Bloquear y solicitar otro nombre |
| `existing_jsm_match` | Existe un JSM con clave y nombre coincidentes | Permitir vinculación explícita, no automática |
| `existing_jsm_mismatch` | Existe un JSM, pero su identidad no coincide plenamente | Bloquear y requerir revisión PMO |
| `local_link_conflict` | La clave ya está vinculada a otro proyecto o servicio en la PMO | Bloquear |
| `invalid_input` | Nombre o clave no cumplen el contrato | Corregir en el formulario |

El preflight reutilizará los lectores de `server/jiraClient.ts`; no realizará escrituras Jira.

**Criterio de salida:** para `PSCSC4S`, el sistema debe identificar el proyecto `business` existente y no ejecutar `POST /project`.

### Fase R2 — Creación y recuperación idempotentes

La mutación de creación se ajustará para volver a ejecutar el preflight en el servidor, aunque la interfaz ya lo haya realizado. Solo el estado `available` podrá crear un nuevo proyecto.

Si Jira responde con una colisión durante la creación, el servidor volverá a consultar la clave. Si encuentra un proyecto JSM con ID, nombre y clave equivalentes a la solicitud y sin otro propietario local, clasificará el caso como creación previa recuperable. La vinculación requerirá confirmación explícita; nunca se adoptará un proyecto solo porque la clave coincide.

La secuencia deberá registrar los eventos `jsm_project_create_requested`, `jsm_project_create_succeeded`, `jsm_project_create_failed` y `jsm_project_link_existing`, incluyendo `serviceId`, operación, nombre, clave, ID Jira y resultado. Los mensajes almacenados deberán sanitizar credenciales y limitar el cuerpo técnico.

**Criterio de salida:** un doble clic, reintento o fallo posterior a la creación no puede producir un segundo proyecto ni dejar el servicio sin una ruta de recuperación.

### Fase R3 — Interfaz accionable

El diálogo se convertirá en un flujo de dos pasos: **Verificar disponibilidad** y **Crear/Vincular**. El botón de escritura permanecerá deshabilitado hasta obtener un preflight vigente.

Para el caso actual, el mensaje deberá indicar que `PSCSC4S` pertenece a un proyecto PMO empresarial y que no puede usarse como JSM. La interfaz podrá proponer una clave y nombre alternativos basados en cliente y Deal, pero solo después de validar su disponibilidad y sin crearlos automáticamente.

La opción **Vincular proyecto JSM existente** aparecerá únicamente cuando Jira confirme `projectTypeKey = service_desk`, la identidad coincida y la clave no esté vinculada en otro registro local.

**Criterio de salida:** el usuario recibe una explicación en español, conoce el proyecto que genera el conflicto y dispone de una acción segura para continuar.

### Fase R4 — Restricciones de integridad local

Se verificará que una clave JSM no pueda quedar vinculada a dos servicios recurrentes. Si el esquema no lo garantiza, se añadirá una restricción aditiva sobre `recurring_services.jsmProjectKey`, precedida por una consulta de duplicados y una migración revisada antes de aplicarla.

También se validará que una clave ocupada en `projects` o `jira_spaces` por un proyecto `business` no se pueda asociar como JSM de un servicio recurrente.

**Criterio de salida:** no existen vínculos ambiguos entre proyectos PMO y servicios recurrentes.

### Fase R5 — Pruebas de regresión focales

Se cubrirán, como mínimo, los siguientes escenarios:

| Prueba | Resultado esperado |
|---|---|
| Clave ocupada por proyecto `business` | Bloqueo previo; cero escrituras Jira |
| Nombre ocupado por proyecto `business` | Bloqueo previo; mensaje accionable |
| Nombre y clave libres | Una creación y una persistencia local |
| Doble envío de la misma solicitud | Una sola creación efectiva |
| JSM coincidente ya creado | Recuperación/vinculación con confirmación |
| JSM existente con identidad distinta | Bloqueo y revisión PMO |
| Clave vinculada a otro servicio | Bloqueo local |
| Error Jira no relacionado con duplicidad | Error normalizado y auditado |
| Creación Jira exitosa y persistencia local fallida | Reintento recuperable sin duplicar |

Se ejecutará Vitest focal, `pnpm check` separando las deudas TypeScript heredadas y `pnpm build`. Una prueba persistente, si resulta necesaria, usará una identidad aislada, limpieza en `finally` y no tocará `PSCSC4S`.

### Fase R6 — Remediación controlada del Deal 4687

Después de publicar y validar la corrección, se mantendrá intacto el proyecto empresarial `PSCSC4S`. Para el servicio recurrente se propondrá una identidad JSM separada; por ejemplo, una convención similar a `[JSM|Isapre Consalud] Servicio CloudOps | Deal 4687` y una clave candidata como `JSMC4687`. Estos valores son solo propuestas y deberán pasar el preflight antes de aprobarse.

Con aprobación humana se ejecutará una única creación. Luego se verificará que Jira devuelva `projectTypeKey = service_desk`, se persistirán `jsmProjectKey`, `jsmProjectId` y `jsmPortalUrl`, se comprobará la auditoría y recién después se habilitará la sincronización de tareas y el cierre manual de `jira_setup`.

**Criterio de salida:** el servicio `2040001` queda vinculado a un JSM real y único, sin alterar el proyecto PMO `510001` ni avanzar etapas automáticamente.

## 6. Controles anti-loop y seguridad

Cada fase tendrá una sola batería focal y un checkpoint. No se repetirá una verificación sin información nueva. Se usarán como máximo tres intentos por enfoque y, ante un segundo fallo distinto, se detendrá la ejecución para revisar el contrato antes de continuar.

Durante el desarrollo, todas las consultas iniciales a Jira serán de lectura. La creación del JSM del Deal 4687 requerirá autorización específica después de presentar el nombre y la clave disponibles. No se renombrará, archivará, convertirá ni desvinculará `PSCSC4S`.

## 7. Criterios de aceptación finales

| Criterio | Evidencia esperada |
|---|---|
| La colisión se detecta antes de escribir Jira | Preflight `key_taken_business` para `PSCSC4S` |
| Un proyecto empresarial nunca se vincula como JSM | Validación de `projectTypeKey` en servidor |
| El flujo es reintentable | Mismo resultado sin duplicados ni pérdida de vínculo |
| Los errores son comprensibles | Mensaje en español con clave, causa y siguiente acción |
| La operación es trazable | Eventos de solicitud, éxito, fallo o vinculación |
| La PMO conserva integridad | Una clave JSM por servicio y sin conflicto con proyectos PMO |
| El caso actual queda resuelto de forma segura | JSM separado para Deal 4687; `PSCSC4S` intacto |

## 8. Archivos previstos para la implementación

| Archivo | Cambio previsto |
|---|---|
| `server/jiraClient.ts` | Lectura/preflight y normalización de conflictos Jira |
| `server/recurringServicesRouter.ts` | Validación servidor, creación idempotente, recuperación y auditoría |
| `server/recurringServicesDb.ts` | Búsquedas de conflicto y persistencia controlada |
| `client/src/pages/recurring/RSJsmSetupStage.tsx` | Flujo de preflight, mensajes y vinculación explícita |
| `server/recurringServices.test.ts` y pruebas nuevas focales | Cobertura de colisiones, idempotencia y recuperación |
| `drizzle/schema.ts` y migración aditiva, solo si corresponde | Restricción de unicidad local para `jsmProjectKey` |

## 9. Estado actual preservado

No se realizaron escrituras en Jira, no se volvió a intentar la creación y no se modificó el proyecto empresarial `PSCSC4S`. Tampoco se alteraron el servicio recurrente `2040001`, sus etapas ni sus documentos. El único cambio local de esta investigación es la documentación del diagnóstico y el backlog de remediación.
