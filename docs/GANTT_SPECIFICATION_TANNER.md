# Especificación del Gantt contractual — Tanner

## Fuente
- Maqueta HTML aprobada: `/home/ubuntu/upload/dashboard-ejecutivo-pmo-v2-layout_1.html`, líneas 427–486
- Diagnóstico de paridad: `/home/ubuntu/prodigio-pmo/docs/DIAGNOSTICO_PARIDAD_VISUAL_LINEA_TIEMPO_TANNER_2026-08-18.md`

## Estructura visual requerida

### Cabecera
- Título: `Línea de tiempo contractual — baseline vs. real`
- Metadato: `10 hitos · el % indica facturación, no avance`

### Eje temporal
- Eje horizontal por mes: FEB, MAR, ABR, MAY, JUN, JUL, AGO, SEP, OCT
- Separación visual entre meses

### Filas de hitos
Cada fila contiene:
- **Etiqueta**: código del hito (ej. H1-F1, H2-F1)
- **Nombre**: título del hito
- **Peso**: porcentaje de facturación (no avance)
- **Pista**: barra temporal con estado visual

### Estados visuales de barras
| Estado | Clase CSS | Color | Descripción |
|---|---|---|---|
| Aceptado | `.barra.ok` | Verde | Hito aceptado por el cliente |
| Planificado | `.barra.plan` | Gris | Baseline pendiente |
| Vencido | `.barra.atraso` | Rojo | Vencido sin aceptación |
| Hoy | `.barra.hoy` | Ámbar | Vence en el periodo |
| Deriva | `.deriva` | Rojo discontinuo | Segmento de deriva |

### Leyenda
Cinco significados visibles:
1. Verde: Aceptado por el cliente
2. Rojo: Vencido sin aceptación
3. Ámbar: Vence en el periodo
4. Gris: Baseline pendiente
5. Grafito: Fecha de corte

## Datos de ejemplo de la maqueta
| Hito | Nombre | Peso | Estado | Posición |
|---|---|---|---|---|
| H1-F1 | Kickoff | 40% | Aceptado 02 feb | left:0.5%;width:9% |
| H2-F1 | Cierre diseño y pre-análisis | 5% | Aceptado 20 mar | left:18%;width:9% |
| H3A-F1 | Arquitectura SFA — Pre-Prod | 5% | Plan 27 jul + deriva + atraso +21 d | left:53%;width:7% |
| H3B-F1 | Arquitectura SFA — Producción | 10% | Plan 02 ago + deriva + atraso +15 d | left:59%;width:7% |
| H4-F2 | Cierre Sprint 1 y 2 | 10% | Plan 02 ago + deriva + atraso +15 d | left:59%;width:7% |
| H5-F2 | Cierre Sprint 3 y 4 | 10% | Plan 16 ago + atraso +1 d | left:64%;width:7% |
| H7-F2 | Cierre Sprint 4 y 5 | 5% | Vence hoy | left:65%;width:9% |
| H8-F2 | Cierre Sprint 6 y 7 | 5% | Plan 25 ago | left:70%;width:8% |
| H6-F2 | Iniciador de pagos | 5% | Plan 03 sep | left:76%;width:8% |
| H9-F2 | Cierre Sprint 8 y 9 | 5% | Plan 09 sep | left:81%;width:8% |

## Regla de datos que debe conservarse
- Fecha planificada Jira = compromiso contractual
- Cierre Jira = señal operativa (no acredita aceptación)
- Aceptación = sólo con acta, fecha y vínculo válidos
- Tolerancia de 5 días: "pendiente de acta" dentro de ventana, "vencido sin acta" después

## Criterio de salida
- Eje de meses calculado desde fechas Jira reales
- Barras de compromiso, cierre/deriva y aceptación
- Línea de corte visible
- Leyenda accesible
- Tabla de detalle con: fecha comprometida Jira, fecha real acta, estado, variación
- Validación con sesión OAuth autorizada en Tanner
