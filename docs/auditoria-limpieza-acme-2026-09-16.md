# Auditoría de limpieza controlada — ACME y cuentas de prueba

**Fecha de ejecución:** 16 de septiembre de 2026  
**Autor:** Manus AI  
**Proyecto:** Prodigio PMO Platform  
**Base de código:** `c0c9d088f19a7490cc2892ef14e8023a48dbb36c`

## 1. Objetivo y autorización

La operación tuvo como objetivo retirar registros inequívocos de prueba sin afectar servicios, clientes ni usuarios reales. El usuario autorizó expresamente eliminar los **72 servicios recurrentes del cliente `Acme Corp`**, todas sus dependencias identificadas y las **171 cuentas e invitaciones del dominio `@prodigio.test`**.

La ejecución se restringió a los identificadores previamente copiados a tablas físicas de respaldo. No se utilizaron criterios abiertos de texto o dominio durante el borrado, y no se ejecutaron cambios sobre Jira o Jira Service Management.

## 2. Respaldo previo

Antes de eliminar se crearon tablas físicas con prefijo `backup_cleanup_acme_20260916_`. Los conteos del respaldo se compararon con los candidatos vivos y coincidieron exactamente: no se detectaron servicios, usuarios o invitaciones candidatos sin respaldo.

| Conjunto respaldado | Tabla de respaldo | Registros |
|---|---|---:|
| Servicios recurrentes | `backup_cleanup_acme_20260916_services` | 72 |
| Documentos | `backup_cleanup_acme_20260916_documents` | 72 |
| Mensualidades de facturación | `backup_cleanup_acme_20260916_billing` | 864 |
| Etapas | `backup_cleanup_acme_20260916_stages` | 360 |
| Plan de trabajo | `backup_cleanup_acme_20260916_work_plan` | 0 |
| Configuración SLA | `backup_cleanup_acme_20260916_sla` | 0 |
| Penalidades | `backup_cleanup_acme_20260916_penalties` | 0 |
| Análisis IA | `backup_cleanup_acme_20260916_ai` | 0 |
| Corridas de vínculo JSM | `backup_cleanup_acme_20260916_jsm_link_runs` | 0 |
| Mapeos JSM | `backup_cleanup_acme_20260916_jsm_mappings` | 0 |
| Corridas de sincronización JSM | `backup_cleanup_acme_20260916_jsm_sync_runs` | 0 |
| Usuarios de prueba | `backup_cleanup_acme_20260916_users` | 171 |
| Invitaciones de prueba | `backup_cleanup_acme_20260916_invitations` | 171 |

También permanecen `backup_cleanup_acme_20260916_manifest`, con el inventario de respaldo, y `backup_cleanup_acme_20260916_execution`, con los conteos efectivos del borrado. Estas tablas **no fueron eliminadas** y constituyen el punto restaurable de la operación.

## 3. Eliminación ejecutada

El borrado se realizó dentro de una transacción, comenzando por dependencias y terminando en los registros principales. La operación utilizó exclusivamente los IDs presentes en las tablas de respaldo.

| Entidad eliminada | Registros eliminados |
|---|---:|
| Servicios recurrentes ACME | 72 |
| Documentos asociados | 72 |
| Mensualidades de facturación | 864 |
| Etapas | 360 |
| Usuarios `@prodigio.test` | 171 |
| Invitaciones `@prodigio.test` | 171 |

Las dependencias de plan de trabajo, SLA, penalidades, análisis IA y JSM devolvieron cero eliminaciones, de forma consistente con el inventario previo.

## 4. Verificación posterior

La primera consulta de control posterior falló antes de retornar resultados porque usó un nombre de respaldo inexistente. La incidencia estuvo limitada a esa consulta de lectura; **no repitió el borrado ni modificó datos**. A continuación se enumeraron las tablas reales desde `information_schema` y se reconstruyeron los controles utilizando únicamente nombres confirmados.

| Control | Resultado |
|---|---:|
| Servicios respaldados aún presentes en producción | 0 |
| Documentos, mensualidades, etapas y demás dependencias vinculadas a esos servicios | 0 |
| Usuarios respaldados aún presentes | 0 |
| Invitaciones respaldadas aún presentes | 0 |
| Usuarios con email `@prodigio.test` | 0 |
| Invitaciones con email `@prodigio.test` | 0 |
| Huérfanos globales en las diez tablas dependientes de servicios recurrentes | 0 |
| Referencias productivas a IDs de usuarios eliminados | 0 |
| Usuarios reales `@prodigio.tech` preservados | 7 |

Los conteos del respaldo se verificaron nuevamente después del borrado y permanecen en **72 servicios, 72 documentos, 864 mensualidades, 360 etapas, 171 usuarios y 171 invitaciones**. Por tanto, el respaldo físico conserva la totalidad del universo eliminado.

## 5. Comprobación funcional

La aplicación respondió correctamente y presentó la pantalla de acceso SSO. La revisión posterior de los registros del servidor y del navegador no mostró errores de consola ni solicitudes HTTP fallidas asociadas a esta comprobación. La ausencia de sesión autenticada se registró como comportamiento esperado y no se realizaron operaciones funcionales de escritura.

La validación estática continúa mostrando cinco errores TypeScript heredados y ya documentados: cuatro en `server/jiraMilestoneSync.ts` y uno en `server/routers.ts`. No fueron introducidos por esta limpieza exclusivamente de datos.

## 6. Control de versión y trazabilidad

El control local previo a la documentación confirmó la rama `main` sobre el checkpoint `c0c9d088`. Las referencias remotas almacenadas localmente para `origin/main` y `user_github/main` apuntaban al mismo commit. El único cambio local previo a este informe era el bloque de seguimiento de la limpieza en `todo.md`.

Una comprobación remota fresca había fallado previamente por autenticación y no se reintentó a ciegas. Este hecho no afectó la transacción de base de datos ni la integridad del respaldo; se mantiene documentado como limitación del control de sincronización.

## 7. Recuperación

No se ejecutó rollback. Si en el futuro se requiriera restaurar, deberá existir una nueva autorización explícita y aplicarse una operación transaccional en orden inverso: primero usuarios y servicios principales, luego dependencias, verificando antes conflictos de claves, emails, tokens e identificadores. Las tablas de respaldo no deben eliminarse sin una autorización independiente.

## 8. Conclusión

La limpieza autorizada quedó completada con respaldo físico verificable. Los candidatos aprobados ya no están presentes, no quedaron dependencias huérfanas ni referencias a los usuarios eliminados, y las siete cuentas reales del dominio `@prodigio.tech` permanecen preservadas.

## Referencias internas

[1]: ../drizzle/schema.ts "Esquema físico de Prodigio PMO"
[2]: ../todo.md "Backlog y registro de cierre"

