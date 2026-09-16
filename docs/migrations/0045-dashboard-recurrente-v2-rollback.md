# Reversión controlada de la migración 0045

La migración `0045_cute_may_parker.sql` es **aditiva** y crea cuatro tablas nuevas para el Dashboard de Servicios Recurrentes V2. No modifica ni elimina columnas o registros preexistentes.

## Condición de uso

Esta reversión solo puede ejecutarse directamente mientras las cuatro tablas estén vacías. Si alguna contiene datos, se debe crear primero un respaldo físico y obtener autorización explícita, porque el `DROP TABLE` eliminaría evidencia operacional.

```sql
DROP TABLE IF EXISTS recurring_service_jsm_snapshots;
DROP TABLE IF EXISTS recurring_service_financial_evidence;
DROP TABLE IF EXISTS recurring_service_report_evidence;
DROP TABLE IF EXISTS recurring_service_document_controls;
```

Después de una reversión se debe restaurar `drizzle/schema.ts`, el snapshot Drizzle y la migración en un único cambio versionado. No se debe ejecutar esta receta sobre producción sin un gate de conteos y respaldo.
