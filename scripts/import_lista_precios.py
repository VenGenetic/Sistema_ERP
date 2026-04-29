import pandas as pd
import re
import os

EXCEL_PATH = r"C:\Users\ASUS\Documents\catalogo-motos-main\catalogo-motos\lista_precios_simplificada.xlsx"
OUTPUT_SQL_PATH = r"C:\Users\ASUS\Documents\Sistema_ERP-main\Sistema_ERP-main\supabase\migrations\20260429000000_import_nuevos_productos.sql"

def clean_price(price_str):
    if pd.isna(price_str):
        return 0.0
    if isinstance(price_str, (int, float)):
        return float(price_str)
    # Remove $ and replace comma with dot
    clean_str = str(price_str).replace('$', '').replace(',', '.').strip()
    try:
        return float(clean_str)
    except:
        return 0.0

def escape_sql(text):
    if pd.isna(text):
        return ""
    # Escape single quotes for postgres
    return str(text).replace("'", "''")

def main():
    print(f"Reading {EXCEL_PATH} ...")
    df = pd.read_excel(EXCEL_PATH)
    
    # Check actual columns just to be safe
    # We saw: ['Código', 'Nombre', 'Precio (1 Unidad)']
    col_codigo = [c for c in df.columns if 'código' in c.lower() or 'codigo' in c.lower()][0]
    col_nombre = [c for c in df.columns if 'nombre' in c.lower()][0]
    col_precio = [c for c in df.columns if 'precio' in c.lower()][0]

    sql_statements = []
    sql_statements.append("-- Migration: Importación de Nuevos Productos")
    sql_statements.append("-- Timestamp: 20260429000000\n")
    sql_statements.append("BEGIN;\n")

    added_count = 0

    for idx, row in df.iterrows():
        sku = escape_sql(row[col_codigo])
        name = escape_sql(row[col_nombre])
        
        # Ignorar filas vacias
        if not sku or not name:
            continue
            
        costo_base = clean_price(row[col_precio])
        
        # Formula: (Costo * 1.15) * 1.65
        precio_pvp = (costo_base * 1.15) * 1.65
        
        # Usamos WHERE NOT EXISTS en lugar de ON CONFLICT para evitar errores de constraint faltante en Supabase
        sql = f"""
WITH inserted_product AS (
    INSERT INTO products (sku, name, category, cost_without_vat, price)
    SELECT '{sku}', '{name}', 'General', {costo_base:.4f}, {precio_pvp:.4f}
    WHERE NOT EXISTS (SELECT 1 FROM products WHERE sku = '{sku}')
    RETURNING id
)
INSERT INTO inventory_levels (product_id, warehouse_id, current_stock)
SELECT id, (SELECT id FROM warehouses ORDER BY id LIMIT 1), 0 FROM inserted_product;
"""
        sql_statements.append(sql)
        added_count += 1
        
    sql_statements.append("\nCOMMIT;")

    with open(OUTPUT_SQL_PATH, 'w', encoding='utf-8') as f:
        f.write("".join(sql_statements))

    print(f"Generados {added_count} bloques de inserción.")
    print(f"SQL Guardado en: {OUTPUT_SQL_PATH}")

if __name__ == "__main__":
    main()
