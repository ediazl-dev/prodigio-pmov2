# Remediación de la sincronización financiera programada

**Fecha de ejecución:** 18 de septiembre de 2026  
**Sistema:** Prodigio PMO Platform  
**Job existente:** `financial-sync-daily`  
**Task UID:** `koZvKFb8FE7TZ6hy8GAnvM`  
**Horario permanente:** 03:00 UTC (`0 0 3 * * *`)

## Resumen ejecutivo

La causa raíz era una **credencial OAuth estática expirada**. El Heartbeat funcionaba y alcanzaba el callback todos los días, pero Google Drive rechazaba la descarga con HTTP 401. La ejecución manual asistida funcionaba porque utilizaba la sesión renovable de Google Workspace disponible para el agente, mientras que el servidor programado dependía de `GOOGLE_DRIVE_TOKEN`, que no podía renovarse.

La corrección sustituye esa dependencia por una **cuenta de servicio Google con renovación automática**, manteniendo el token estático sólo como fallback transitorio. La planilla `Reporte  Estado de Proyectos_20250205` fue compartida como Lector con la cuenta de servicio y su credencial quedó almacenada exclusivamente como secreto protegido `GOOGLE_SERVICE_ACCOUNT_JSON`.

## Controles implementados

| Control | Implementación |
|---|---|
| Autenticación durable | `google-auth-library` genera access tokens renovables con scope `drive.readonly`. |
| Secreto | `GOOGLE_SERVICE_ACCOUNT_JSON`; no se persiste en Git, base, logs ni historial. |
| Preflight | Descarga, lectura de hoja `Artefactos_proyectos`, columnas obligatorias, Deal ID único, conteos y SHA-256. |
| Escritura | UPSERT por Deal dentro de una única transacción; no existe borrado automático. |
| Concurrencia | Lock distribuido MySQL `GET_LOCK` compartido por ejecución manual y cron. |
| Scheduler | Se conserva el mismo Heartbeat; el callback valida el task UID persistido en `admin_settings`. |
| Anti-divergencia | UID distinto se responde como `orphan` 2xx y no ejecuta el runner. |
| Observabilidad | Último intento, último éxito, antigüedad, frescura, credencial y registro del cron separados. |
| Errores | Códigos y fases operacionales sin incluir tokens, JSON ni claves privadas. |

## Conectividad y persistencia

La aplicación obtiene su conexión MySQL/TiDB desde la variable protegida **`DATABASE_URL`**. El valor de la URL no se documenta ni se versiona. Las tablas relacionadas con este flujo son:

| Tabla | Uso |
|---|---|
| `financial_data` | Datos financieros consolidados por `dealId`. |
| `financial_sync_log` | Historial de intentos manuales y programados. |
| `admin_settings` | UID durable y cron UTC del Heartbeat. |
| `audit_logs` | Auditoría general de operaciones administrativas. |
| `backup_financial_data_service_account_20260918` | Copia física previa de los datos financieros. |
| `backup_financial_sync_logs_service_account_20260918` | Copia física previa del historial. |
| `backup_financial_schedule_settings_20260918` | Salvaguarda de settings previos; estaba vacía porque las claves no existían. |

## Evidencia de certificación

| Verificación | Resultado |
|---|---|
| Credencial y token Google | Cuenta de servicio válida; token renovable emitido. |
| Acceso Drive | Metadata de la planilla leída con HTTP 200. |
| Preflight real | 37 Deals válidos, 6 filas omitidas, 0 inserts y 37 updates proyectados. |
| Respaldo | 46 filas de `financial_data` y 33 logs previos respaldados. |
| Corrida manual controlada | `applied`: 37 leídos, 0 insertados, 37 actualizados. |
| Runner programado con UID | `applied`: 37 leídos, 0 insertados, 37 actualizados; origen `cron`. |
| Estado posterior | 46 filas y 46 Deals distintos; sin borrados. |
| Historial UI | Último intento y último éxito a las 01:36 UTC, frescura vigente, credencial renovable y cron registrado. |
| Heartbeat HTTP real | Ejecución `asopK3gpy29JGkp74NH2NB`, HTTP 200, 37 Deals, 0 inserts y 37 updates. |
| Grilla de historial | 36 registros ordenados en forma descendente, paginados 20 + 16, sin filas repetidas entre páginas. |
| Pruebas | Suite de autenticación, live access, preflight, lock, callback, UID y salud aprobada. |
| Build | Compilación productiva exitosa. |
| TypeScript | Permanecen únicamente cinco errores heredados, sin regresiones de este bloque. |

## Heartbeat y prueba temporal

No se creó un job adicional. Se conservó `financial-sync-daily` con el mismo UID. Una prueba temporal adelantó su expresión. El monitor local agotó su ventana inicial y restauró automáticamente el horario `0 0 3 * * *`; el scheduler procesó después el evento ya encolado y completó el callback real con HTTP 200. Este comportamiento no afectó datos ni configuración permanente.

La ruta funcional se certificó primero mediante `runProductionScheduledFinancialSync` con el UID durable real y luego mediante el Heartbeat HTTP real. Ambas ejecuciones atravesaron validación del UID, descarga con cuenta de servicio, preflight, lock, transacción y logging con origen `cron`. El horario permanente permanece en **03:00 UTC**.

El historial administrativo se sirve en páginas fijas de 20 registros. El servidor aplica `ORDER BY createdAt DESC, id DESC`, entrega total, número de páginas y contadores globales, y la interfaz muestra los botones **anterior** y **siguiente** arriba a la derecha de la grilla.

## Operación y recuperación

Si una corrida falla, revisar primero el panel **Administración → Sincronización Financiera**. La fase `credentials` indica un problema de secreto; `download`, un problema de acceso o exportación; `preflight`, una planilla inválida; `lock`, otra corrida activa; y `apply`, una falla transaccional de base.

Para rollback de datos, restaurar `financial_data` desde `backup_financial_data_service_account_20260918`. Para rollback de código, regresar al checkpoint anterior a esta remediación. Para rollback del scheduler, mantener el mismo UID y restaurar únicamente su cron a `0 0 3 * * *`; no eliminar ni recrear el job.
