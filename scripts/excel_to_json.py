import pandas as pd
import json
import math
import sys
import os

def clean_price(price_str):
    if pd.isna(price_str):
        return 0.0
    if isinstance(price_str, (int, float)):
        return float(math.ceil(price_str))
    # Remove $ and replace comma with dot
    clean_str = str(price_str).replace('$', '').replace(',', '.').strip()
    try:
        return float(math.ceil(float(clean_str)))
    except:
        return 0.0

def main():
    if len(sys.argv) < 2:
        print("Uso: python excel_to_json.py <ruta_al_archivo_excel>")
        sys.exit(1)

    excel_path = sys.argv[1]
    
    if not os.path.exists(excel_path):
        print(f"Error: No se encontró el archivo '{excel_path}'")
        sys.exit(1)

    print(f"Leyendo {excel_path} ...")
    try:
        df = pd.read_excel(excel_path)
        # Si las columnas detectadas no contienen código/nombre/precio,
        # pero la primera fila de datos sí contiene 'código' o 'codigo',
        # entonces la primera fila contiene los encabezados reales.
        has_expected = any('código' in str(c).lower() or 'codigo' in str(c).lower() for c in df.columns)
        if not has_expected and len(df) > 0:
            first_row = df.iloc[0]
            if any('código' in str(val).lower() or 'codigo' in str(val).lower() for val in first_row):
                df.columns = [str(val).strip() for val in first_row]
                df = df[1:].reset_index(drop=True)
    except Exception as e:
        print(f"Error al leer el excel: {e}")
        sys.exit(1)

    # Identificar columnas
    try:
        col_codigo = [c for c in df.columns if 'código' in str(c).lower() or 'codigo' in str(c).lower()][0]
        col_nombre = [c for c in df.columns if 'nombre' in str(c).lower() or 'descripcion' in str(c).lower() or 'descripción' in str(c).lower()][0]
        col_precio = [c for c in df.columns if 'precio' in str(c).lower() or 'costo' in str(c).lower()][0]
    except IndexError:
        print("Error: No se pudieron encontrar las columnas esperadas ('código', 'nombre/descripcion', 'precio/costo').")
        print("Columnas encontradas:", list(df.columns))
        sys.exit(1)
        
    # Verificar si existe columna marca y categoria, si no usar por defecto
    col_marca = [c for c in df.columns if 'marca' in c.lower()]
    col_categoria = [c for c in df.columns if 'categoria' in c.lower() or 'categoría' in c.lower()]
    
    data_list = []
    
    for idx, row in df.iterrows():
        codigo = str(row[col_codigo]).strip() if not pd.isna(row[col_codigo]) else ""
        nombre = str(row[col_nombre]).strip() if not pd.isna(row[col_nombre]) else ""
        
        if not codigo or not nombre:
            continue
            
        precio = clean_price(row[col_precio])
        
        marca = str(row[col_marca[0]]).strip() if col_marca and not pd.isna(row[col_marca[0]]) else "DAYTONA"
        categoria = str(row[col_categoria[0]]).strip() if col_categoria and not pd.isna(row[col_categoria[0]]) else "General"
        
        item = {
            "id": codigo,
            "codigo_referencia": codigo,
            "nombre": nombre,
            "marca": marca,
            "precio": precio,
            "categoria": categoria,
            "imagen": "sin_imagen.jpg",
            "stock": True
        }
        data_list.append(item)

    # Generar ruta de salida basada en el nombre del excel
    base_name = os.path.splitext(os.path.basename(excel_path))[0]
    output_dir = os.path.dirname(excel_path)
    output_path = os.path.join(output_dir, f"{base_name}_data.json")

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data_list, f, ensure_ascii=False, indent=4)
        print(f"Éxito! Se procesaron {len(data_list)} productos.")
        print(f"Archivo JSON guardado en: {output_path}")
    except Exception as e:
        print(f"Error al guardar el JSON: {e}")

if __name__ == "__main__":
    main()
