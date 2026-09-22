# Corrección de evidencia documental en Staffing y proyectos con baseline ejecutivo

**Fecha:** 22 de septiembre de 2026  
**Autor:** Manus AI

## Resultado

La carga documental del Dashboard Ejecutivo v2 dejó de estar restringida a Tanner. Ahora está disponible para **cualquier proyecto existente que tenga un baseline ejecutivo aprobado**, con los mismos permisos Admin/PMO que ya gobernaban actas, minutas y planes de recuperación.[1]

Staffing `PMO-510001` cumple esa precondición mediante el baseline aprobado `jira-auto-v1`. Tanner `PMO-180002` conserva su operación. Los proyectos sin baseline aprobado continúan bloqueados de forma explícita y no exponen un formulario que no pueda completar su registro.

## Causa raíz

El problema tenía tres causas relacionadas. Primero, siete operaciones del Dashboard Ejecutivo v2 dependían de una bandera histórica que habilitaba el flujo sólo para Tanner. Segundo, el cliente reutilizaba un único estado de upload para actas, minutas y planes de recuperación. Cuando una carga fallaba, el formulario podía conservar un nombre de archivo sin una evidencia utilizable. Tercero, las mutaciones posteriores confiaban en `fileUrl` y `fileName` enviados por el navegador. Por eso una carga fallida terminaba en mensajes crudos de validación como `Invalid URL` y `fileName too small`.

## Solución implementada

### Elegibilidad general

La política ya no evalúa el identificador de Tanner. Evalúa dos hechos: el proyecto debe existir y debe tener una fuente contractual aprobada. La autorización de escritura continúa limitada a Admin/PMO.[1]

### Recibo durable de upload

La migración `0048_fat_morgan_stark.sql` crea `executive_evidence_uploads`. Cada upload validado genera un recibo opaco vinculado a **proyecto, baseline, tipo documental y usuario**. El recibo conserva nombre, clave de storage, URL interna, SHA-256, MIME, tamaño y estado. La UI recibe sólo el token necesario para completar el registro.[2] [3]

El recibo expira funcionalmente después de 24 horas. No puede cruzarse entre proyectos, baselines, tipos de documento o usuarios. Tampoco puede reutilizarse una vez adjuntado.[4]

### Registro transaccional

Minutas, actas de aceptación y planes de recuperación consumen el recibo dentro de una transacción. El sistema valida y reclama el recibo, crea la entidad de gobierno y marca el recibo como adjunto. Si cualquier paso falla, la transacción revierte y no deja un registro parcial.[3]

Para las actas se verifica además que el hito pertenezca al mismo proyecto y baseline, y que no exista una aceptación vigente previa. Para las minutas, la minuta y sus compromisos se crean en la misma transacción.

### Formularios independientes

Los formularios de acta, minuta y plan de recuperación mantienen estados separados de progreso, confirmación y error. Los botones de registro permanecen deshabilitados hasta que exista un recibo válido y estén completos los campos obligatorios. El nombre del archivo es de solo lectura. Las URLs y el hash dejaron de ser editables por el usuario.[5]

Los mensajes crudos de Zod ya no forman parte del flujo normal. Si una selección no produce un recibo, la interfaz solicita volver a seleccionar el archivo y esperar su confirmación.

### Auditoría

La auditoría registra cuatro eventos: upload exitoso, upload fallido, adjunto exitoso y adjunto fallido. Los eventos guardan proyecto, baseline, tipo, MIME, tamaño, hash, identificador de recibo o código de error según corresponda. No guardan bytes, contenido Base64, credenciales ni tokens de recibo.[1]

## Reglas de archivo

| Documento | Formatos admitidos | Tamaño máximo | Firma verificada |
|---|---:|---:|---:|
| Acta de aceptación | PDF | 25 MB | Sí |
| Minuta | PDF o DOCX | 25 MB | Sí |
| Plan de recuperación | PDF o DOCX | 25 MB | Sí |

La extensión, el MIME y la firma binaria deben coincidir. Cargar un archivo sólo lo deja pendiente; no acredita un hito, una minuta ni un plan hasta completar el registro de gobierno.

## Certificación

La suite focal aprobó **24 pruebas**. Incluye acceso para Staffing y Tanner, rechazo de proyectos sin baseline, formatos, tamaño, propiedad del recibo, cruce de proyecto/baseline/tipo/usuario, expiración, reuso y transacciones con base real. La prueba persistente crea un fixture aislado y lo elimina al terminar.[4] [6]

La suite integral ejecutó **852 pruebas aprobadas** y detectó dos fallas ajenas al cambio: un timeout de Jira live y una conexión fallida de Pipedrive. La repetición determinista, excluyendo únicamente esas dos integraciones live junto con las dos integraciones externas ya excluidas por la línea base, aprobó **838 pruebas**, con 19 omitidas. El build productivo finalizó correctamente.

`pnpm check` conserva los **cinco errores TypeScript heredados** ya documentados: cuatro en `jiraMilestoneSync.ts` y uno en `routers.ts`. La corrección no agregó errores nuevos.

La base quedó con la nueva tabla aplicada y sin fixtures: cero proyectos de prueba y cero recibos de prueba. La revisión visual autenticada verificó Staffing y Tanner en escritorio y móvil. También confirmó que un proyecto sin baseline aprobado muestra la precondición correspondiente.

## Limitaciones operativas

Un archivo almacenado que nunca se adjunta conserva un recibo `pending`. Después de 24 horas ya no puede utilizarse. Esta entrega no agrega un proceso automático de eliminación del objeto huérfano en storage porque el helper actual sólo expone operaciones de carga y lectura. El registro pendiente permite identificar esos casos para una limpieza futura controlada.

La corrección no cambia hitos, fechas, estados Jira, datos financieros ni el contenido de los documentos. Tampoco crea, edita o transiciona issues Jira/JSM.

## Recuperación

El checkpoint anterior al modelo durable es `5f4b8248`. La tabla nueva es aditiva. Una reversión de código puede volver a ese checkpoint sin alterar las tablas ejecutivas anteriores; los recibos nuevos quedarían inactivos hasta decidir su eliminación controlada.

## References

[1]: ../server/routers.ts "Rutas, elegibilidad y auditoría de evidencia ejecutiva"
[2]: ../drizzle/0048_fat_morgan_stark.sql "Migración de recibos de evidencia ejecutiva"
[3]: ../server/executiveEvidenceRepository.ts "Repositorio transaccional de evidencia ejecutiva"
[4]: ../server/executiveEvidenceReceipt.ts "Política de validación y consumo de recibos"
[5]: ../client/src/pages/stages/ExecutiveDashboardV2.tsx "Formularios documentales del Dashboard Ejecutivo v2"
[6]: ../server/executiveEvidenceRepository.integration.test.ts "Prueba persistente con autolimpieza"
