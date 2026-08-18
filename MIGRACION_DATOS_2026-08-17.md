# Registro de migración de datos — Prodigio PMO

**Fecha:** 17 de agosto de 2026  
**Origen:** `respaldo_bd_prodigio_pmo_importable.zip`  
**Destino:** base de datos gestionada de Prodigio PMO restaurado

## Alcance y método

El respaldo recibido incluía DDL heredado, datos de proyectos, configuración global, auditoría y servicios recurrentes. Se descartaron las sentencias de definición o eliminación de estructura y se generaron lotes de `INSERT` exclusivamente para datos de negocio compatibles. La importación se ejecutó dentro de una transacción y la prevalidación comprobó las tablas, columnas y ausencia de datos operativos previos en el destino.

| Dominio importado | Registros validados |
|---|---:|
| Proyectos | 16 |
| Etapas de proyectos | 96 |
| Aperturas de etapa | 13 |
| Espacios Jira | 14 |
| Documentos SoW y versiones | 6 |
| Aprobaciones de etapa | 4 |
| Riesgos | 36 |
| Tareas WBS | 94 |
| Hitos de facturación | 4 |
| Datos financieros | 40 |
| Veredictos ejecutivos | 38 |
| Archivos y documentos vinculados | 9 |
| Cierres y extensiones de etapa | 22 |

## Identidades y referencias externas

Se preservaron los responsables de proyecto existentes y se prepararon las identidades faltantes como cuentas invitadas vinculables por correo. Al iniciar sesión mediante OAuth con el mismo correo, la plataforma vincula la cuenta real manteniendo el rol migrado. Los enlaces, claves y URL de Jira se conservaron como referencias; sus permisos y vigencia se deben revisar desde el módulo de administración de Jira.

> La disponibilidad de archivos históricos depende de que los enlaces y objetos de almacenamiento de la instancia anterior continúen vigentes. Los metadatos y referencias almacenados en la base se importaron sin alterar sus URL.

## Datos excluidos deliberadamente

No se importaron las migraciones de Drizzle, configuraciones globales, feriados, invitaciones históricas, notificaciones, bitácora de auditoría ni el módulo de servicios recurrentes y sus dependencias. Estas entidades no son necesarias para recuperar los proyectos y se excluyeron para evitar sobrescribir la configuración actual, duplicar trazabilidad histórica o introducir servicios fuera del alcance solicitado.

## Ajuste de integridad aplicado

El respaldo contenía seis etapas asociadas al proyecto `270001`, pero no incluía el proyecto padre. Esas seis filas se excluyeron del resultado final y se registró la corrección en `audit_logs`. La validación posterior confirmó cero referencias huérfanas en etapas, SoW, riesgos, WBS, hitos, espacios Jira y cierres; cada uno de los 16 proyectos mantiene exactamente seis etapas.

## Reutilización del proceso

El proyecto incluye `scripts/import-pmo-backup.mjs`, un ejecutor que sólo admite lotes saneados de `INSERT`, valida tablas y columnas contra el esquema destino y detiene la operación si detecta datos existentes en las tablas migradas. El preparador local usado para el respaldo conserva el filtro de integridad para no regenerar filas dependientes sin proyecto padre.

