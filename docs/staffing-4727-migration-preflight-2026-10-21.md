# Preparación de la migración 4727 a CONSALOP02

**21-oct-2026. Base:** `42562d65`; preparación respaldada en checkpoint `005d2cf8`. **Alcance autorizado:** operación y facturación del servicio PMO-2070001 deben quedar en CONSALOP02. **Estado:** P0 ejecutado; P1 bloqueado por configuración team-managed no disponible a través de las operaciones API comprobadas y ausencia de sesión web. No se movieron, crearon ni actualizaron issues; no se cambiaron registros PMO. No se declara terminada la implementación.

## Respaldo completado

Se respaldaron la ficha, etapas, 24 controles, seis cuotas UF195, documentos y decisiones documentales, reportes, evidencia financiera, multas, SLA, mappings y corridas. Se conservó el SoW adjunto y se capturaron completos los seis hitos PSCSC4S-41/-19/-20/-21/-22/-23, sus campos, changelog paginado y comentarios paginados. El adjunto de aprobación de M01 también fue descargado y respaldado. Todos los checksums SHA-256 pasaron.

Directorio privado: `/home/ubuntu/backups/prodigio-pmo/2026-10-21-staffing-4727-migration/2026-10-21T17-56-58-914Z/`. El respaldo no está en Git ni contiene credenciales del cliente API.

El snapshot fresco conserva tres hitos Facturado y tres No facturado en el campo `customfield_11237`. El traslado no autoriza inferir entrega o aceptación de los controles operativos.

## Compatibilidad y restricciones reales

PSCSC4S es `classic`/business (12976); CONSALOP02 es `next-gen`/service_desk (13114). La cuenta técnica tiene permisos de Browse, Move, Create y Bulk Change, y administración del destino. El campo Estado de Facturación tiene contexto global 12913 y opciones existentes.

La API de metadatos del destino respondió correctamente: 17 campos en Email request y 22 campos en Get IT help. **Estado de Facturación no está habilitado en ninguno de esos tipos**, ni aparecen los campos de fecha de vencimiento/asignado en sus metadatos de creación. Una definición global no equivale a estar habilitada en el formulario de un tipo local.

El usuario rechazó la toma de control y pidió resolver mediante la cuenta técnica. Se investigó y probó la vía pública API:

- `GET /rest/servicedeskapi/servicedesk/399/requesttype`: **HTTP 403**, "You don't have permission to access this service space". No se confunde este permiso JSM con el permiso genérico de administración del proyecto, que sí está concedido.
- Se respaldaron los tipos locales 12925/12926 y se verificó que el proyecto estaba vacío y ambos pertenecían exclusivamente a 13114. Se intentó una única actualización semántica del tipo 12925 mediante el endpoint documentado `PUT /rest/api/3/issuetype/12925`.
- Jira rechazó la actualización con **HTTP 400**, "Can not update issue type, because it is not a global issue type." **No se reintentó ni se actualizó el segundo tipo.**
- Después del rechazo, seis lecturas completas verificaron que los seis issues originales conservan su ID, clave y todos sus campos sin cambios. Los tipos del destino siguen siendo Email request y Get IT help.

La guía oficial vigente permite reutilizar campos con contexto global en JSM team-managed, pero prescribe añadirlos desde Work types en la interfaz. [4] No se identificó una operación pública soportada para hacer esa asociación local por API; la actualización de tipo probada es además rechazada por el servidor. [5] [6]

La API de movimiento sí existe y admite mappings. [1] [7] El bloqueo comprobado es **preparar adecuadamente el destino**, no que mover issues sea intrínsecamente imposible. No se probó un traslado de producción con tipo/campos inadecuados ni se crearon copias para eludir esa restricción.

## Acceso y siguiente paso seguro

El navegador aislado redirige a Atlassian Login. El token API funciona, pero no autentica una sesión web. No se dispone de una contraseña guardada en este entorno. No se volverá a solicitar toma de control, de acuerdo con la instrucción del usuario.

Para que Manus complete la configuración personalmente necesita una vía de autenticación web válida distinta de ese token (por ejemplo, credenciales mediante formulario seguro, sin enviarlas en chat; puede requerirse MFA). Si no se facilita acceso web, un administrador Jira deberá habilitar una vez los tipos Tarea de Staffing e Hito de Facturación y agregar Estado de Facturación, fecha y responsable en el destino; después se puede retomar la automatización API de la migración. No se cambia a otro Space ni se sustituye el proyecto sin autorización específica.

## Implementación preparada y validación

`scripts/prepareStaffing4727Migration.ts` es exclusivamente de lectura: GET API y SELECT DB, con límites de paginación, timeouts, validación de identidad/cuotización y archivos privados. `scripts/inspectStaffing4727Destination.ts` conserva las lecturas API de campos/estados/acceso del destino. Se actualizó el backlog; no se activó aún el corte financiero ni se encendió una creación ciega de hitos. El intento de configuración rechazado no se conserva como script ejecutable para evitar reintentos sin nueva evidencia.

El bloque P0 tuvo `pnpm build` exitoso y `pnpm check` con los cinco errores TypeScript heredados (cuatro en jiraMilestoneSync.ts y uno estadoSII en routers.ts). La continuación sólo añade un inspector de lectura y documenta el bloqueo; se valida build/check nuevamente antes de guardar. No se afirma ejecución de una suite funcional nueva, puesto que no se modifica el comportamiento de la aplicación.

Después de resolver el acceso/configuración se retomarán P1–P5: simulación, migración, generación del plan y corte exclusivo a CONSALOP02. Si la vía nativa no conserva evidencia, se propondrá la alternativa antes de copiar.

## Referencias

[1]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-bulk-operations/ "Atlassian Jira Cloud REST API — Issue bulk operations"
[2]: https://developer.atlassian.com/cloud/jira/platform/bulk-operation-additional-examples-and-faqs/ "Atlassian — Bulk operation examples and FAQs"
[3]: https://support.atlassian.com/jira-work-management/docs/migrate-between-team-managed-and-company-managed-projects/ "Atlassian — Migrate between team-managed and company-managed spaces"
[4]: https://support.atlassian.com/jira-service-management-cloud/docs/customize-request-fields-in-next-gen-service-projects/ "Atlassian — Customize request fields in team-managed service spaces"
[5]: https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-types/ "Atlassian REST — Issue types"
[6]: https://community.developer.atlassian.com/t/add-custom-field-to-a-nextgen-project-via-the-api/49164 "Atlassian Developer Community — Configuration of team-managed fields via API"
[7]: https://support.atlassian.com/atlassian-cloud/kb/bulk-move-work-items-with-the-jira-cloud-rest-api/ "Atlassian — Bulk move work items with the Jira cloud REST API"
