# Implementación del Portafolio de Proyectos

**Fecha:** 18 de septiembre de 2026  
**Autor:** Manus AI  
**Rama:** `feat/portafolio-tabla-y-filtros`

## Resultado

La página **PMO Proyectos** fue reemplazada por un portafolio tabular denso que utiliza el endpoint ejecutivo existente. La integración fue deliberadamente compatible: el parche entregado no aplicaba de forma limpia sobre `Projects.tsx` y `executivePortfolio.ts`, porque ambos archivos ya contenían mejoras posteriores. En lugar de sobrescribirlas, se incorporaron los bloques nuevos y se preservaron las reglas vigentes.[1] [2]

La vista productiva contiene **12 proyectos**: 8 activos y 4 cerrados. El resumen muestra 6 riesgos altos confirmados y abiertos, UF 1.452 con evidencia de monto y 10 proyectos sin monto cargado. No se suman monedas distintas ni se transforma ausencia de datos en cero.

## Cambios funcionales

El motor ejecutivo ahora expone `portfolio`, una fila determinista por proyecto. Cada fila incluye identidad PMO, cliente, origen, etapa, estado, PM, monto, moneda, riesgos altos confirmados, plazo efectivo y etapas realmente cerradas. El pipeline usa `closedStageIds`; por ello no interpreta la posición del cursor como evidencia de cierre.[1]

La interfaz incorporó búsqueda y seis selectores adicionales: estado, cliente, etapa, tipo, PM y salud del plazo. Los siete filtros se combinan con lógica AND. La tabla permite ordenar por proyecto, cliente, etapa, plazo, estado, riesgos y monto. Los valores nulos permanecen al final tanto en orden ascendente como descendente.

Cada proyecto muestra su código `PMO-{id}`. El nombre conserva la navegación al detalle. Los encabezados ordenables anuncian `aria-sort`, los encabezados usan `scope="col"`, el pipeline tiene descripción accesible y la región de tabla admite foco para desplazamiento horizontal en pantallas estrechas.[2] [3]

## Salvaguardas preservadas

La creación sigue disponible sólo para roles **Admin** y **PMO**. El formulario normaliza el nombre, detecta duplicados antes de enviar y mantiene la restricción única del servidor. La prueba visual confirmó que una variante espaciada de `[PMO] CCLA SRP MVP1 Deal 4728` fue bloqueada y señaló `PMO-2670001`; no se creó ningún registro.

La eliminación permanece limitada a **Admin** y a proyectos fuera de Avance o Cierre. El botón es visible y tiene nombre accesible. El diálogo exige escribir exactamente `ELIMINAR`; durante la certificación se abrió y canceló sin ejecutar la mutación.

Los riesgos ejecutivos continúan contando sólo registros de impacto alto, confirmados y no cerrados. El plazo usa `avgEffectiveAllowedDays`; las extensiones sólo afectan etapas cerradas. Los proyectos cerrados muestran plazo no aplicable y los proyectos sin apertura muestran `Sin apertura`, no un cumplimiento inventado.[1]

## Limpieza de datos de prueba

La primera inspección visual reveló cinco fixtures persistentes creados por pruebas anteriores, con IDs `2790001` a `2790005`. Se respaldaron 63 filas en tablas físicas `bkp_pf_*_20260918` y en JSON antes de reutilizar la cascada productiva `deleteProjectAdmin`. Después se registraron cinco auditorías `DELETE_PROJECT_FIXTURE_CLEANUP`.[4]

La verificación independiente confirmó cero filas del lote, 12 proyectos restantes, 8 activos y 4 cerrados. El respaldo exportable quedó en `/home/ubuntu/pmo-backups/portfolio-fixtures-20260918.zip` con checksum SHA-256.

## Certificación

La matriz final aprobó **79 pruebas** en siete archivos. Incluye motor ejecutivo, filas de portafolio, view model, tabla, creación desde Home, identidad única y reglas de borrado. El build productivo terminó correctamente. TypeScript conserva exactamente los cinco errores heredados ya documentados; esta implementación no agregó errores.

La validación de datos reales confirmó IDs y nombres únicos, 12 filas, 10 montos ausentes y consistencia entre `deadlineState=overdue` y `headline.stagesOverdue`. La revisión visual se realizó a 1440×1000 y 390×844. A 1440 px no existe scroll horizontal; en móvil los filtros ocupan el ancho disponible y la tabla conserva todas las columnas dentro de una región desplazable.

## Límites

No se agregó paginación porque el portafolio tiene 12 registros. No se reconciliaron montos ni se introdujeron conversiones de moneda. No se modificaron Jira, JSM, el esquema de base de datos, `App.tsx`, `server/routers.ts` ni `server/db.ts`.

## Referencias

[1]: ../server/executivePortfolio.ts "Motor ejecutivo del portafolio"
[2]: ../client/src/pages/Projects.tsx "Página PMO Proyectos"
[3]: ../client/src/pages/projects/ProjectTable.tsx "Tabla accesible del portafolio"
[4]: ../server/db.ts "Cascada productiva de eliminación administrativa"
