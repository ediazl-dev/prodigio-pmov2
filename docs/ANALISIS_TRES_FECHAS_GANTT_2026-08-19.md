# Análisis: regla de tres fechas en el Gantt — caso M02 Tanner

## Datos reales verificados en BD (2026-08-19)

| Campo | Valor | Significado |
|---|---|---|
| baselineDate | 2026-03-20 | Base contractual (carta Gantt) |
| jiraDueDate | 2026-03-20 | Fecha planificada en Jira |
| jiraClosedDate | NULL | Jira NO tiene fecha de cierre registrada |
| acceptedAt | 2026-05-25 | Fecha real de aceptación del cliente (acta) |
| evidenceFileName | Plantilla_Acta de Aceptación...25052026.pdf | Acta cargada |
| acceptanceStatus | accepted | Hito aceptado |

## El problema detectado por el usuario

M02 tiene tres fechas distintas:
1. **Base contractual**: 20-marzo (lo que se comprometió)
2. **Planificación Jira**: 20-marzo (lo que Jira tiene programado)
3. **Fecha real**: 25-mayo (cuando realmente se cerró/aceptó)

El Gantt actual sólo muestra dos marcadores (rombo=baseline, círculo=Jira). No muestra la fecha real de cierre/aceptación. Esto oculta la desviación real: 66 días entre lo comprometido y lo que ocurrió.

Además, jiraClosedDate es NULL porque Jira no registró la fecha de cierre. La única evidencia del cierre real es el acta de aceptación (25-mayo).

## Regla propuesta para el Gantt (tres fechas)

Cada hito debe mostrar hasta tres marcadores temporales:

| Marcador | Fuente | Cuándo mostrarlo | Color/estilo |
|---|---|---|---|
| Rombo ◆ | baselineDate | Siempre que exista | Grafito #0D1117 |
| Círculo ● | jiraDueDate | Siempre que exista | Color por estado (verde/rojo/ámbar/gris) |
| Estrella ★ | acceptedAt (acta) | Sólo si hay acta registrada | Teal #00B3A4 |

La franja de deriva debe conectar:
- baseline → jiraDueDate (deriva de planificación)
- baseline → acceptedAt (deriva real, si existe acta)

## Cálculo de desviaciones para M02
- Deriva planificación: jiraDueDate - baseline = 20-mar - 20-mar = 0 días (sin replanificación)
- Deriva real: acceptedAt - baseline = 25-may - 20-mar = 66 días de atraso real

## Tooltip actualizado (tres fechas)
El tooltip debe mostrar:
- Base contractual: 20-mar-2026
- Programada Jira: 20-mar-2026
- Fecha real (acta): 25-may-2026
- Deriva planificación: 0 días
- Deriva real: +66 días
- Estado: Aceptado por el cliente
- Peso: X%
- Acta: nombre del archivo

## Mejora del botón de acta
El formulario de acta YA tiene un input type="file" funcional con validación de PDF, MIME y 25MB (uploadSelectedEvidence). El usuario pide que sea "más intuitivo". Las mejoras posibles:
1. El input file actual es un campo de formulario estándar — se puede estilizar como un botón de carga con icono y texto "Seleccionar archivo PDF"
2. Mostrar el nombre del archivo seleccionado junto al botón
3. El botón "Registrar acta" por hito ya preselecciona el hito correcto

## Nota sobre jiraClosedDate NULL
M02 tiene jiraClosedDate=NULL porque Jira no registró la fecha de resolución. La fecha real de cierre (25-mayo) proviene exclusivamente del acta de aceptación. Esto es correcto según la regla de gobierno: "Jira sólo penaliza el semáforo, nunca mejora el estado contractual". La fecha real de aceptación es la del acta, no la de Jira.
