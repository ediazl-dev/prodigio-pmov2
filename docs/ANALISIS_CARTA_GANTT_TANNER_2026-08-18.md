# Análisis Carta Gantt Tanner — Línea base contractual (2026-08-18)

## Fuente
- Archivo: `/home/ubuntu/upload/TannerSFACartaGanttExcel20260312.xlsx` (Hoja1, 141 filas × 7 columnas)
- Extracción completa: `/tmp/gantt_tanner_content.txt`
- Proyecto: "Proyecto SFA -Tanner" · 160 días · 2026-02-02 → 2026-09-11

## Hitos [HITO] de la carta Gantt (línea base contractual)
| Fila | Hito Gantt | Fecha baseline |
|---|---|---|
| 18 | Aprobación Informe GAPs | 2026-03-13 |
| 27 | Arquitectura Aprobada | 2026-03-20 |
| 39 | Infraestructura Productiva Disponible | 2026-04-10 |
| 48 | Cumplimiento FAPI Validado | 2026-04-24 |
| 56 | Consentimientos Operativos | 2026-05-08 |
| 70 | Conexión exitosa al Sandbox DP | 2026-05-22 |
| 76 | Arquitectura Certificada | 2026-06-05 |
| 86 | Producto SFA Aprobado | 2026-09-11 |
| 94 | Producto SFA Aprobado (duplicado) | 2026-09-11 |

## Hitos de pago (sección "Hito de Pago", filas 133-140)
| Fila | Hito de pago | Fecha |
|---|---|---|
| 134 | Cierre Diseño y prerequisitos | 2026-03-20 |
| 135 | Habilitación de arquitectura SFA PREPROD | 2026-04-10 |
| 136 | Habilitación de arquitectura SFA PROD | 2026-04-10 |
| 137 | Cierre Sprint 1 y 2 de Banco Tanner | 2026-09-11 |
| 138 | Cierre Sprint 3 y 4 de Banco Tanner | 2026-09-11 |
| 139 | Cierre Sprint 5 y 6 de TSF | 2026-09-11 |
| 140 | Cierre Sprint 7 y 8 de TSF | 2026-09-11 |

## Hitos actuales en BD (executive_contract_milestones, projectId=180002)
| Código | Título | Peso % | baselineDate | jiraDueDate |
|---|---|---|---|---|
| M01 | Kick Off | 40 | NULL | 2026-02-02 |
| M02 | Cierre Diseño y pre-requisitos | 5 | NULL | 2026-03-20 |
| M03 | Arquitectura SFA Pre-Prod | 5 | NULL | 2026-07-27 |
| M04 | Arquitectura SFA Prod | 10 | NULL | 2026-10-02 |
| M05 | Cierre Sprint 1 y 2 | 10 | NULL | 2026-08-03 |
| M06 | Cierre Sprint 3 y 4 | 10 | NULL | 2026-08-10 |
| M07 | Iniciador de Pagos | 5 | NULL | 2026-09-03 |
| M08 | Cierre Sprint 6 y 7 | 5 | NULL | 2026-08-17 |
| M09 | Cierre Sprint 8 y 9 | 5 | NULL | 2026-08-25 |
| M10 | Cierre y Garantía | 5 | NULL | 2026-10-09 |

## Hallazgos clave
1. `baselineDate` está NULL en los 10 hitos → la carta Gantt es la fuente para poblarla.
2. `jiraDueDate` difiere de la Gantt en M03 (2026-07-27 vs 2026-04-10), M04 (2026-10-02 vs 2026-04-10), M05-M10 → evidencia replanificaciones en Jira.
3. El motor cardinal usa `committedDate ?? baselineDate` (effectiveDate) y `classifyMilestoneTimeline` usa `jiraDueDate` como fecha comprometida.
4. El Gantt visual actual: eje fijo FEB-OCT 2026, línea de corte hardcodeada en 65% (≈julio), textos con ellipsis que se pierden.
5. Fecha de corte del análisis: 2026-08-18 (hoy). La línea punteada debe calcularse desde esta fecha, no fija.

## Mapeo propuesto hito BD → fecha baseline Gantt
- M01 Kick Off → 2026-02-02 (inicio proyecto, fila 2)
- M02 Cierre Diseño y pre-requisitos → 2026-03-20 (fila 134 / hito Arquitectura Aprobada fila 27)
- M03 Arquitectura SFA Pre-Prod → 2026-04-10 (fila 135)
- M04 Arquitectura SFA Prod → 2026-04-10 (fila 136)
- M05 Cierre Sprint 1 y 2 → 2026-09-11 (fila 137) — la Gantt no desagrega sprints intermedios
- M06 Cierre Sprint 3 y 4 → 2026-09-11 (fila 138)
- M07 Iniciador de Pagos → sin equivalente directo en Gantt [POR CONFIRMAR]
- M08 Cierre Sprint 6 y 7 → 2026-09-11 (fila 139, "Sprint 5 y 6") [POR CONFIRMAR desfase de numeración]
- M09 Cierre Sprint 8 y 9 → 2026-09-11 (fila 140, "Sprint 7 y 8") [POR CONFIRMAR desfase]
- M10 Cierre y Garantía → 2026-09-11 (fin proyecto, fila 2)

NOTA: M07-M09 requieren confirmación del usuario por desfase de numeración de sprints entre BD y Gantt.

---

## Mapeo CONFIRMADO por el usuario (2026-08-18)
| Hito BD | baselineDate confirmada | Origen |
|---|---|---|
| M01 Kick Off | 2026-02-02 | Gantt inicio proyecto |
| M02 Cierre Diseño y pre-requisitos | 2026-03-20 | Gantt hito de pago |
| M03 Arquitectura SFA Pre-Prod | 2026-04-10 | Gantt hito de pago PREPROD |
| M04 Arquitectura SFA Prod | 2026-04-10 | Gantt hito de pago PROD |
| M05 Cierre Sprint 1 y 2 | 2026-09-11 | Gantt hito de pago Sprint 1 y 2 |
| M06 Cierre Sprint 3 y 4 | 2026-09-11 | Gantt hito de pago Sprint 3 y 4 |
| M07 Iniciador de Pagos | 2026-09-03 | (a) fecha Jira actual, confirmada por usuario |
| M08 Cierre Sprint 6 y 7 | 2026-08-17 | Usuario: hito distinto a Gantt "Sprint 5 y 6"; fecha indicada 17-08-2026 |
| M09 Cierre Sprint 8 y 9 | 2026-08-25 | Usuario: hito distinto a Gantt "Sprint 7 y 8"; fecha indicada 25-08-2026 |
| M10 Cierre y Garantía | 2026-09-11 | Gantt fin proyecto |

Regla: baselineDate = línea base contractual (Gantt/confirmación usuario); jiraDueDate = fecha comprometida replanificada. La deriva = jiraDueDate − baselineDate.
