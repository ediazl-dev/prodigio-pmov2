# Implementación de Staffing en Servicios Recurrentes

**Fecha:** 16 de septiembre de 2026  
**Autor:** Manus AI  
**Módulo:** Servicios Recurrentes

## Resumen

Se incorporó **Staffing** como nueva categoría canónica del módulo de servicios recurrentes. El cambio abarca el contrato compartido, el esquema físico, las validaciones del servidor, el formulario de creación, los filtros, la distribución por tipo, las tarjetas de listado y las vistas de detalle e inicialización.

La implementación no modifica Jira Service Management ni crea configuraciones en JSM. `staffing` clasifica el servicio dentro de Prodigio PMO; la creación o vinculación de un proyecto JSM continúa realizándose posteriormente en la etapa **JSM Setup**.

## Contrato

| Elemento | Valor |
|---|---|
| Etiqueta visible | `Staffing` |
| Valor persistido | `staffing` |
| Tabla | `recurring_services` |
| Columna | `serviceType` |
| Tipo físico | `enum('soporte_incidentes','requerimientos','evolutivos','mixto','staffing')` |

El catálogo se centralizó en `shared/recurringServiceTypes.ts`. Esquema, servidor y cliente consumen la misma lista de valores, etiquetas, colores y opciones para evitar divergencias futuras.

## Superficies actualizadas

| Superficie | Comportamiento |
|---|---|
| Crear Servicio | El selector **Tipo de Servicio** incluye Staffing |
| Backend | Las mutaciones de creación y edición aceptan `staffing` mediante el validador compartido |
| Base de datos | La migración `0042_massive_blindfold.sql` amplía el enum sin alterar filas existentes |
| Listado | Staffing dispone de etiqueta y color propios |
| Filtros | La lista puede filtrarse por Staffing |
| Distribución por tipo | El KPI incorpora Staffing y presenta su color/etiqueta |
| Detalle | El resumen del servicio muestra `Staffing` en lugar del valor técnico |
| Inicialización | La etapa inicial presenta la etiqueta visible coherente |

## Validación

| Control | Resultado |
|---|---|
| Prueba unitaria del catálogo | 3 de 3 aprobadas |
| Prueba persistente opt-in | 1 de 1 aprobada |
| Creación y recuperación | `staffing` persistido correctamente |
| Etapas iniciales | 5 etapas creadas |
| Filtro | El servicio Staffing se recupera por tipo |
| KPI | El contador de Staffing aumenta en una unidad durante la prueba |
| Limpieza | 0 servicios y 0 auditorías de prueba residuales |
| Build de producción | Exitoso |
| Revisión visual | Formulario renderizado correctamente en escritorio |
| Logs de cliente | Sin errores nuevos |

`pnpm check` conserva cinco errores TypeScript heredados en `server/jiraMilestoneSync.ts` y `server/routers.ts`; no se introdujeron errores asociados a Staffing.

## Archivos principales

| Archivo | Cambio |
|---|---|
| `shared/recurringServiceTypes.ts` | Catálogo canónico, etiquetas, opciones y esquema Zod |
| `drizzle/schema.ts` | Enum de persistencia ampliado |
| `drizzle/0042_massive_blindfold.sql` | Migración aditiva aplicada |
| `server/recurringServicesRouter.ts` | Validación compartida en creación y edición |
| `client/src/pages/RecurringServiceCreate.tsx` | Nueva opción del formulario |
| `client/src/pages/RecurringServicesList.tsx` | Filtro, tarjetas y distribución por tipo |
| `client/src/pages/RecurringServiceDetail.tsx` | Etiqueta legible en detalle |
| `client/src/pages/recurring/RSInitStage.tsx` | Etiqueta legible en inicialización |
| `server/recurringServiceTypes.test.ts` | Pruebas unitarias del contrato |
| `server/recurringStaffingPersistence.test.ts` | Prueba persistente con limpieza garantizada |

## Resultado operativo

Los usuarios autorizados pueden crear nuevos servicios recurrentes seleccionando **Staffing**. Los servicios anteriores mantienen sus categorías originales y no fueron modificados. La selección de Staffing no altera el pipeline de cinco etapas ni ejecuta acciones en Jira.
