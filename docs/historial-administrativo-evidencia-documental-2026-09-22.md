# Historial administrativo de evidencia documental

**Versión:** 1.0  
**Fecha:** 22 de septiembre de 2026  
**Ámbito:** Prodigio PMO Platform

## Resultado

La plataforma incorpora una vista administrativa para monitorear el ciclo completo de los archivos cargados como evidencia del Dashboard Ejecutivo v2. La vista está disponible en **Administración → Evidencia documental** y sólo puede ser consultada por usuarios con rol **Admin**.

La pantalla consolida minutas, actas de aceptación y planes de recuperación. Cada registro identifica el proyecto, la versión de baseline, el archivo, el usuario que realizó la carga, su estado operacional y la trazabilidad administrativa. La API nunca entrega el token del recibo, la URL interna, la clave de storage ni el hash del archivo.

## Estados operativos

| Estado | Definición | Acción administrativa disponible |
|---|---|---|
| **Pendiente** | El archivo fue validado y almacenado, pero todavía no fue adjuntado al registro formal. El recibo conserva vigencia durante 24 horas. | Descartar con razón obligatoria. |
| **Expirado** | El recibo permaneció pendiente por más de 24 horas. Ya no puede adjuntarse. | Descartar con razón obligatoria. |
| **Adjuntado** | El archivo quedó vinculado transaccionalmente a una minuta, acta o plan de recuperación. | Sólo consulta. |
| **Descartado** | Un administrador invalidó el recibo pendiente. El archivo no puede adjuntarse mientras continúe descartado. | Restaurar si el recibo aún está dentro de sus 24 horas de vigencia. |

El descarte es lógico y no elimina el objeto del storage. Esta decisión conserva la trazabilidad y evita que una acción administrativa borre evidencia física sin un proceso específico de retención documental.

## Monitoreo y filtros

El encabezado presenta cinco indicadores: pendientes vigentes, pendientes expirados, adjuntados, descartados y total histórico. Cada indicador funciona como acceso directo al estado correspondiente.

La grilla se pagina de 20 en 20 y permite buscar por proyecto, nombre de archivo o usuario. También permite filtrar por estado, tipo documental y proyecto. La vista se actualiza al recuperar el foco y ofrece un botón **Actualizar** para una lectura inmediata.

## Gestión de pendientes

La acción **Descartar** exige una razón de entre 5 y 500 caracteres. La actualización es condicional: sólo puede afectar un recibo pendiente que no haya sido descartado por otra operación. El registro formal de una minuta, acta o plan usa la condición inversa, por lo que un adjunto y un descarte concurrentes no pueden ganar al mismo tiempo.

La acción **Restaurar** sólo está disponible para un recibo descartado que todavía conserva vigencia. Un archivo expirado no se reactiva y debe cargarse nuevamente desde el Dashboard Ejecutivo v2.

## Auditoría

Las acciones administrativas generan eventos en el módulo de Auditoría:

| Acción | Entidad | Datos registrados |
|---|---|---|
| `executive_evidence_discarded` | `executive_evidence_upload` | Administrador, fecha y hora, proyecto, baseline, tipo, tamaño y razón. |
| `executive_evidence_restored` | `executive_evidence_upload` | Administrador, fecha y hora, proyecto, baseline, tipo y tamaño. |

Los eventos no contienen bytes, token de recibo, URL interna, clave de storage ni hash SHA-256.

## Implementación

La migración `0049_premium_justice.sql` añade a `executive_evidence_uploads` los campos `discardedAt`, `discardedBy`, `discardedByName` y `discardReason`. No modifica ni elimina registros existentes.

El read model administrativo calcula los estados derivados a partir de `uploadStatus`, `discardedAt`, `createdAt` y el tiempo de vigencia. La API tRPC usa procedimientos `adminOnly` para listar, resumir, consultar proyectos, descartar y restaurar. La ruta cliente `/admin/evidence-history` también está protegida por `AdminGuard`.

## Certificación

La certificación focal cubre la derivación de estados, filtros, paginación, descarte, restauración, invalidez del recibo descartado, protección `adminOnly`, auditoría segura, navegación y privacidad de la interfaz. Las pruebas de persistencia crean datos aislados y los eliminan mediante `afterEach`.

La revisión visual verificó escritorio a 1440 × 1000 y móvil a 390 × 844. El contenido se mantiene dentro del viewport y la tabla usa desplazamiento horizontal contenido. El estado vacío permanece legible en ambos formatos.

La comprobación final también mostró un recibo real pendiente del proyecto Tanner. La vista presentó correctamente el proyecto, baseline, tipo de documento, archivo, tamaño, responsable, vencimiento y acción disponible. El registro no fue descartado ni modificado durante la certificación.

## Limitaciones deliberadas

La vista no permite descargar documentos. Tampoco elimina objetos del storage. Estas operaciones requieren una política explícita de acceso y retención que no forma parte de esta implementación.
