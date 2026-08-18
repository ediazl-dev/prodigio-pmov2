# Diagnóstico de paridad visual — Línea de tiempo contractual Tanner

## Fuentes contrastadas

| Fuente | Ubicación | Rol |
|---|---|---|
| Captura publicada reportada | `/home/ubuntu/upload/FireShotCapture278-Prodigio-PlataformaPMO-[prodigio-pmo-neyq89tj.manus.space].pdf` | Evidencia de la vista que el usuario observó en producción. |
| Especificación aprobada | `/home/ubuntu/upload/dashboard-ejecutivo-pmo-v2-layout_1.html`, líneas 427–486 | Contrato visual de la línea de tiempo contractual. |
| Implementación actual | `client/src/pages/stages/ExecutiveDashboardV2.tsx`, líneas 165–167 | Componente entregado actualmente. |

## Hallazgo

La observación del usuario es correcta. La implementación actual ofrece una **lista de hitos con puntos sobre una pista abstracta**, titulada “Cadencia contractual y evidencia de aceptación”. Esa estructura no reproduce la composición aprobada: una tarjeta de “Línea de tiempo contractual — baseline vs. real” con un eje de meses, barras horizontales, línea de corte, deriva y leyenda operativa.

| Elemento | HTML aprobado | Vista publicada actual | Corrección requerida |
|---|---|---|---|
| Cabecera | “Línea de tiempo contractual — baseline vs. real” y metadato de hitos | “Cadencia contractual y evidencia de aceptación” | Recuperar el título y metadato de contrato aprobados. |
| Escala temporal | Eje horizontal por mes, de febrero a octubre, con separación visual | Dos columnas: nombre y pista sin meses | Construir una escala de meses calculada desde fechas Jira reales. |
| Representación de hito | Etiqueta, nombre y barra temporal | Etiqueta, nombre y un punto | Sustituir el punto por barras de compromiso, cierre/deriva y aceptación. |
| Fecha de corte | Línea vertical visible sobre las pistas | Ausente | Mostrar el corte productivo o fixture como línea de referencia. |
| Estados | Verde aceptado; rojo vencido; ámbar por vencer; gris planificado; deriva roja discontinua | Verde/ámbar/rojo sólo en un punto | Aplicar barras y tramos con los estados contractuales aprobados. |
| Leyenda | Cinco significados visibles, incluida baseline y fecha de corte | Ausente | Añadir leyenda accesible y explicativa. |
| Semántica de datos | Baseline/real en composición gráfica | La tabla de evidencia queda separada y la pista no explicita fechas | Mantener la tabla contractual, pero expresar en el gantt fecha Jira comprometida, cierre Jira y aceptación por acta. |

## Regla de datos que debe conservarse

La representación visual no puede cambiar el gobierno vigente. La fecha planificada de Jira representa el compromiso contractual; el cierre Jira es sólo una señal operativa; y la aceptación sólo existe con acta, fecha y vínculo válidos. La tolerancia de cinco días se expresa como “pendiente de acta” dentro de la ventana y como “vencido sin acta” una vez expirada.

## Criterio de salida

La corrección sólo se considerará terminada cuando el componente muestre en escritorio una tarjeta temporal con eje de meses, filas de barras, fecha de corte y leyenda; y cuando las columnas de detalle mantengan fecha comprometida Jira, fecha real de acta, estado y variación. La validación final debe realizarse con sesión OAuth autorizada en Tanner.
