# Manual operativo — Dashboard de Servicios Recurrentes V2

## Propósito

La Torre de Control V2 consolida cartera, compromisos financieros, evidencia documental, entregables mensuales, incidentes, SLA y calidad de datos de los servicios recurrentes. Su principio central es la trazabilidad: **no suma monedas distintas, no presenta cuotas programadas como facturación real y no transforma ausencia de evidencia en cumplimiento**.

## Acceso y navegación

La vista se abre desde **Servicios Recurrentes** en el menú lateral o mediante la ruta `/recurring-services`. **Torre V2** es la vista predeterminada. Las vistas **Clásico** y **Lista** permanecen disponibles durante la convivencia y el detalle operativo original sigue accesible desde cada servicio.

| Perfil | Ver Torre e historial | Actualizar JSM manualmente | Crear o modificar servicios |
|---|---:|---:|---:|
| Administrador | Sí | Sí | Sí |
| PMO | Sí | Sí | Sí, según reglas vigentes |
| PM | Sí | No | Según permisos vigentes |
| Consulta | Sí | No | No |

## Lectura de los indicadores

Los KPI financieros se agrupan por moneda. **Contratado** proviene del contrato del servicio; **programado** corresponde al calendario de cuotas; **facturado** y **cobrado** requieren evidencia financiera confirmada. **Vencido** representa obligaciones programadas cuya fecha ya pasó y que continúan pendientes. La Torre no aplica conversión cambiaria implícita.

Los reportes mensuales distinguen planificado, entregado, aceptado, rechazado y eximido. La puntualidad sólo se calcula cuando existen fechas y evidencia suficientes. La formalidad contractual diferencia documento presente, validado, vencido, rechazado o ausente.

Las métricas de incidentes y SLA sólo se muestran cuando hay vínculo JSM verificable y snapshots medidos. La configuración de un objetivo SLA no equivale al cumplimiento real. Cuando falta vínculo, permiso, ciclo SLA o snapshot, la interfaz muestra **N/D** y la causa correspondiente.

## Actualización JSM manual

Los perfiles Administrador y PMO pueden usar **Actualizar JSM**. La acción llama al mismo runner utilizado por el proceso diario, consulta JSM únicamente mediante operaciones GET, persiste snapshots idempotentes y refresca tanto el dashboard como el historial. No crea, edita ni transiciona tickets.

| Resultado | Interpretación operativa |
|---|---|
| `success` | El servicio se consultó y el snapshot quedó disponible |
| `partial` | La consulta produjo datos parciales; revisar el mensaje por servicio |
| `error` | El servicio falló sin impedir que los demás continuaran |
| `skipped` | El servicio no era elegible, ya estaba procesado o no tenía vínculo JSM |

## Actualización diaria

El job `recurring-services-jsm-refresh-daily` ejecuta `POST /api/scheduled/refreshRecurringServicesJsm` todos los días a las **09:00 UTC**. El callback acepta exclusivamente identidades cron autenticadas y valida el `taskUid` contra la clave durable `recurring_services_jsm_daily_task_uid`. Un UID desconocido responde `200` con estado `orphan` para evitar reintentos inútiles.

La operación diaria usa el identificador `scheduled:AAAA-MM-DD`; si la plataforma reintenta durante la misma fecha UTC, el runner devuelve el resultado auditado con `reused: true` y no vuelve a consultar JSM. El lote máximo es 25 servicios por corrida y cada servicio se procesa de forma independiente.

## Historial y diagnóstico

La tarjeta de historial muestra origen, fecha, estado global y conteos de éxitos, parciales, errores y omitidos. Un total alto de omitidos con causa `jsm_not_configured` indica ausencia de vínculo y no una indisponibilidad de JSM. Un estado parcial requiere revisar los resultados por servicio antes de reintentar manualmente.

| Situación | Acción recomendada |
|---|---|
| `jsm_not_configured` | Vincular y verificar el Space/Service Desk desde el flujo JSM del servicio |
| Error de autorización JSM | Revisar credenciales y permisos de lectura del conector |
| SLA N/D con incidentes disponibles | Confirmar que JSM exponga ciclos SLA medidos para esos issues |
| Corrida `partial` | Revisar servicios afectados y ejecutar actualización manual después de corregir la causa |
| Corrida `error` | Revisar logs del callback y disponibilidad de base/JSM antes de reintentar |
| Callback `orphan` | Verificar que el UID activo coincida con `recurring_services_jsm_daily_task_uid` |

## Operación segura y rollback

No se deben agregar `setInterval`, `node-cron` ni procesos residentes. Tampoco se debe disparar la actualización desde el render del cliente. Todo cambio de frecuencia debe realizarse sobre la tarea Heartbeat registrada y debe conservar un cron UTC de seis campos.

Ante una regresión del callback, primero se debe **pausar el job** para detener nuevos disparos. Luego se revierte la versión mediante un checkpoint estable y se comprueba la respuesta del endpoint publicado. La clave durable del UID no contiene secretos y puede conservarse mientras el job permanezca pausado; si se reemplaza la tarea, se debe actualizar esa clave antes de reanudarla. Las tablas D2 son aditivas y no deben eliminarse como parte de un rollback de código.

## Estado certificado y limitaciones

Al cierre D10 existen tres servicios productivos. Ninguno tiene vínculo JSM confirmado, por lo que la primera corrida diaria registró tres omitidos y cero errores. Los documentos requeridos están presentes, pero aún necesitan validación formal; tampoco hay evidencia financiera confirmada suficiente para facturado/cobrado. La Torre refleja estas brechas de forma explícita.

La certificación final aprobó 90 pruebas focales, build de producción, permisos de roles, ejecución cron real, idempotencia diaria, limpieza de fixtures y revisión responsive. Permanecen cinco errores TypeScript heredados en `jiraMilestoneSync.ts` y `routers.ts`, sin relación con este dashboard.
