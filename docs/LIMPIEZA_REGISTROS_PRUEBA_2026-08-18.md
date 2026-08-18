# Limpieza de registros de prueba — 18 de agosto de 2026

## Alcance confirmado

La limpieza se limitó a proyectos con los criterios exactos `origin = 'platform'` y `clientName = 'Cliente de prueba'`. No se seleccionaron proyectos por nombre parcial ni se modificaron los 16 proyectos operativos restantes.

## Respaldo recuperable

Antes de eliminar datos se creó el checkpoint de aplicación `0a854604` y un respaldo de base de datos en las tablas con prefijo `backup_test_cleanup_20260818_`.

| Entidad respaldada | Registros |
|---|---:|
| Proyectos | 175 |
| Etapas de proyecto | 1.050 |
| Documentos SoW | 70 |
| Hitos de facturación | 210 |
| Tareas WBS | 420 |
| Espacios Jira | 35 |
| Lecciones aprendidas | 35 |
| Cierres de etapa | 35 |
| Registros de auditoría | 175 |

El manifiesto `backup_test_cleanup_20260818_manifest` conserva el checkpoint de origen, fecha de creación, conteos y criterio de selección.

## Operación ejecutada

Las dependencias se eliminaron antes que los proyectos, en el siguiente orden: auditoría, cierres de etapa, lecciones aprendidas, espacios Jira, WBS, hitos de facturación, documentos SoW, etapas y proyectos.

## Verificación posterior

| Control | Resultado |
|---|---:|
| Proyectos de prueba remanentes | 0 |
| Etapas ligadas a proyectos de prueba | 0 |
| Proyectos operativos preservados | 16 |
| Proyectos en respaldo | 175 |
| Etapas en respaldo | 1.050 |
| Auditorías en respaldo | 175 |

## Restauración

No eliminar las tablas de respaldo. Si se requiere recuperación, restaurar primero `projects` y luego las tablas dependientes en el orden inverso de la eliminación. Antes de cualquier restauración, crear un nuevo checkpoint y validar que no existan identificadores en conflicto.
