# Estado de la sincronización financiera — 2026-08-19

## Fuente
- Planilla Google Sheets: fileId 1ncyMnVgrwJ9DYWJDRorgnxNpGBPwaMAi3j8BYhxkjqQ
- Hoja leída: Artefactos_proyectos
- XLSX exportado: /home/ubuntu/prodigio-pmo/tmp_sync/reporte_proyectos.xlsx (2.022.756 bytes, 43 hojas)

## Script
- Origen: /home/ubuntu/skills/pmo-financial-sync/scripts/sync_financial_data.py
- Copia en proyecto: /home/ubuntu/prodigio-pmo/scripts/sync_financial_data.py
- Dependencias: openpyxl (OK), pymysql 1.2.0 (instalado)
- DATABASE_URL: presente en entorno

## Dry-run (2026-08-19T12:07:46Z)
- inputDeals: 37
- insert: 0
- update: 37
- status: dry_run
- Sin rechazados ni duplicados

## Pendiente
- Aplicar con --apply tras aprobación del usuario
- Verificar en BD: status=applied, 0 rechazados, Deal conocido con syncedAt actualizado

## Resultado aplicado (2026-08-19T12:18:01Z)
- status: applied
- inputDeals: 37 | insert: 0 | update: 37
- Verificación BD: total_registros=40, actualizados_hoy=37
- Deal conocido (Tanner, Deal1934): syncedAt=2026-08-19 12:18:01, valorVentaUF=8200, utilizadoUF=2113.572, avance=46%
