# Análisis: sincronización financiera PMO — 2026-08-19

## Estado actual verificado
| Componente | Estado | Detalle |
|---|---|---|
| Tabla financial_data | ✅ Existe | 40 registros actuales, esquema completo con 24 columnas |
| Script sync_financial_data.py | ✅ Disponible | En /home/ubuntu/skills/pmo-financial-sync/scripts/ (6922 bytes) |
| gws CLI | ✅ Disponible | Google Workspace CLI operativo |
| openpyxl | ✅ Instalado | Para leer XLSX |
| pymysql | ❌ FALTA | Necesario para conexión MySQL directa |
| cryptography | ✅ Instalado | Para SSL de TiDB |
| DATABASE_URL | ✅ Configurado | Secreto del proyecto (no exponer) |
| Planilla Google Sheets | ID: 1ncyMnVgrwJ9DYWJDRorgnxNpGBPwaMAi3j8BYhxkjqQ | Hoja: Artefactos_proyectos |

## Esquema financial_data (24 columnas)
- dealId (UNIQUE, llave de negocio)
- estadoProyecto, projectName, clientName, pm
- valorVentaUF, presupuestoUF, utilizadoUF, utilizadoUFPorc
- presupuestoHH, capacityHH, hhPorcUtilizado
- margenBrutoNotaVentaUF, porcentajeAvanceProyecto
- costoProyectadoUF, margenProyectadoUF, margenProyectadoPorc
- margenTargetPorc, capacityU, planificadoUF, proyectadoUF
- margenProyectadoSegunCapacity, notas, otrosCostosUF, lineaNegocio
- syncedAt (timestamp de última sincronización)

## Mapeo de columnas planilla → BD (FIELD_MAP del script)
24 columnas mapeadas. El script valida que TODAS existan en la planilla antes de escribir.

## Flujo de sincronización (según guía)
1. Instalar pymysql: sudo pip3 install pymysql
2. Copiar script al proyecto: scripts/sync_financial_data.py
3. Exportar planilla: gws drive files export → /tmp/reporte_proyectos.xlsx
4. Dry-run: python3 scripts/sync_financial_data.py --sheet /tmp/reporte_proyectos.xlsx
5. Revisar resultado (insert/update/duplicados/rechazados)
6. Aplicar: python3 scripts/sync_financial_data.py --sheet /tmp/reporte_proyectos.xlsx --apply
7. Verificar: status=applied, 0 rechazados, Deal conocido con syncedAt actualizado

## Controles de seguridad del script
- Rechaza workbook vacío y Deal IDs duplicados
- Verifica esquema antes de escribir
- Transacción atómica (todo o nada)
- UPSERT por dealId, nunca DELETE
- No infiere valores de JIRA/SoW/dashboard
- No expone DATABASE_URL en logs

## Datos actuales en BD
- 40 registros financieros existentes
- Últimos Deals: Deal4662, Deal4669, Deal2207, Deal4728, Deal4722
- La sincronización actualizará los existentes e insertará los nuevos

## Riesgos identificados
- pymysql no instalado → instalar antes de ejecutar
- La planilla puede tener columnas renombradas → el script falla si falta alguna
- Deal IDs duplicados en la planilla → el script aborta (correcto)
