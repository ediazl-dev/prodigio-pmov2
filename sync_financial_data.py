#!/usr/bin/env python3
"""
Sincronización directa de datos financieros desde Google Sheets → BD MySQL/TiDB
Usa pymysql directamente para mayor velocidad y confiabilidad
"""
import openpyxl
import json
import os
import re
import subprocess
import ssl

XLSX_PATH = '/home/ubuntu/reporte_proyectos_fresh.xlsx'

def safe_val(val):
    """Convierte valor a float o None"""
    if val is None:
        return None
    s = str(val).strip()
    if s.startswith('#') or s in ('None', '', 'N/A'):
        return None
    try:
        return float(s)
    except ValueError:
        return None

def safe_str(val):
    if val is None:
        return None
    s = str(val).strip()
    if s.startswith('#') or s in ('None', ''):
        return None
    return s

def extract_rows():
    wb = openpyxl.load_workbook(XLSX_PATH, data_only=True)
    sheet = wb['Artefactos_proyectos']
    
    headers = [str(cell.value).strip() if cell.value else '' for cell in sheet[1]]
    col = {h: i for i, h in enumerate(headers) if h}
    
    rows = []
    for row in sheet.iter_rows(min_row=2, values_only=True):
        deal_id = row[col.get('Deal', 1)] if 'Deal' in col else None
        if not deal_id or str(deal_id).startswith('#') or not str(deal_id).startswith('Deal'):
            continue
        
        def g(name):
            idx = col.get(name)
            return row[idx] if idx is not None else None
        
        def gf(name):
            return safe_val(g(name))
        
        def gs(name):
            return safe_str(g(name))
        
        rows.append({
            'dealId': str(deal_id).strip(),
            'estadoProyecto': gs('Estado Proyecto'),
            'projectName': gs('Proyecto'),
            'clientName': gs('Cliente'),
            'pm': gs('PM'),
            'valorVentaUF': gf('valor_venta_uf'),
            'presupuestoUF': gf('Presupuesto_UF'),
            'utilizadoUF': gf('Utilizado_UF'),
            'utilizadoUFPorc': gf('Utilizado_UF_porc'),
            'presupuestoHH': gf('Presupuesto_HH'),
            'capacityHH': gf('Capacity_HH'),
            'hhPorcUtilizado': gf('HH_porc_utilizado'),
            'margenBrutoNotaVentaUF': gf('Margen_bruto_nota_venta (UF)'),
            'porcentajeAvanceProyecto': gf('Porcentaje_avance_proyecto'),
            'costoProyectadoUF': gf('Costo_Proyectado_UF_(segun avance)'),
            'margenProyectadoUF': gf('Margen_Proyectado UF_(segun avance)'),
            'margenProyectadoPorc': gf('Margen_Proyectado_% (segun avance)'),
            'margenTargetPorc': gf('Margen_Target_porc'),
            'capacityU': gf('Capacity U'),
            'planificadoUF': gf('Planificado_UF'),
            'proyectadoUF': gf('Proyectado_UF'),
            'margenProyectadoSegunCapacity': gf('margen_proyectado_segun_capacity'),
            'notas': gs('Notas'),
            'otrosCostosUF': gf('Otros costos (UF)'),
            'lineaNegocio': gs('Linea_negocio'),
        })
    
    return rows

def get_db_url():
    """Obtiene la DATABASE_URL del proceso del servidor"""
    # Intentar desde variable de entorno del proceso actual
    url = os.environ.get('DATABASE_URL', '')
    if url:
        return url
    # Intentar desde archivo temporal (generado por el servidor)
    if os.path.exists('/tmp/db_url.txt'):
        with open('/tmp/db_url.txt') as f:
            return f.read().strip()
    # Fallback: obtener via node
    result = subprocess.run(
        ['node', '-e', """
const { execSync } = require('child_process');
try {
  const url = execSync('printenv DATABASE_URL', { encoding: 'utf8' }).trim();
  if (url) { require('fs').writeFileSync('/tmp/db_url.txt', url); console.log(url); }
} catch(e) {}
"""],
        cwd='/home/ubuntu/prodigio-pmo',
        capture_output=True, text=True, timeout=10
    )
    return result.stdout.strip()

def parse_db_url(url):
    """Parsea mysql://user:pass@host:port/db?params"""
    # Limpiar parámetros SSL problemáticos
    url_clean = re.sub(r'[?&]ssl=[^&]*', '', url)
    url_clean = re.sub(r'[?&]sslaccept=[^&]*', '', url_clean)
    
    m = re.match(r'mysql(?:2)?://([^:]+):([^@]+)@([^:/]+):?(\d+)?/([^?]+)', url_clean)
    if not m:
        raise ValueError(f"Cannot parse DATABASE_URL: {url_clean[:50]}...")
    
    user, password, host, port, database = m.groups()
    return {
        'host': host,
        'port': int(port) if port else 4000,
        'user': user,
        'password': password,
        'database': database.split('?')[0],
    }

def sync_via_pymysql(rows):
    import pymysql
    
    url = get_db_url()
    if not url:
        raise ValueError("No se pudo obtener DATABASE_URL")
    
    cfg = parse_db_url(url)
    
    conn = pymysql.connect(
        host=cfg['host'],
        port=cfg['port'],
        user=cfg['user'],
        password=cfg['password'],
        database=cfg['database'],
        ssl={'ssl': {}},
        connect_timeout=30,
        autocommit=True,
    )
    
    updated = 0
    inserted = 0
    
    try:
        with conn.cursor() as cur:
            for row in rows:
                deal_id = row['dealId']
                fields = [k for k in row if k != 'dealId']
                values = [row[k] for k in fields]
                
                # Verificar si existe
                cur.execute('SELECT id FROM financial_data WHERE dealId = %s', (deal_id,))
                existing = cur.fetchone()
                
                if existing:
                    set_clause = ', '.join(f'`{f}` = %s' for f in fields)
                    cur.execute(
                        f'UPDATE financial_data SET {set_clause} WHERE dealId = %s',
                        values + [deal_id]
                    )
                    updated += 1
                else:
                    all_fields = ['dealId'] + fields
                    all_values = [deal_id] + values
                    cols = ', '.join(f'`{f}`' for f in all_fields)
                    placeholders = ', '.join(['%s'] * len(all_fields))
                    cur.execute(
                        f'INSERT INTO financial_data ({cols}) VALUES ({placeholders})',
                        all_values
                    )
                    inserted += 1
    finally:
        conn.close()
    
    return updated, inserted

if __name__ == '__main__':
    print("=== Extrayendo datos de la planilla ===")
    rows = extract_rows()
    print(f"Registros extraídos: {len(rows)}")
    
    # Verificar Deal4564
    d4564 = next((r for r in rows if r['dealId'] == 'Deal4564'), None)
    if d4564:
        print(f"Deal4564 - utilizadoUF: {d4564['utilizadoUF']}, capacityU: {d4564['capacityU']}")
    
    print(f"\n=== Sincronizando {len(rows)} registros a la BD ===")
    updated, inserted = sync_via_pymysql(rows)
    
    result = {"updated": updated, "inserted": inserted, "total": len(rows)}
    print(f"✅ Sincronización completa: {updated} actualizados, {inserted} insertados, {len(rows)} total")
    print(f"Resultado: {json.dumps(result)}")
