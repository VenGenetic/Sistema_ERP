import os
import json
import math
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase configuration
URL = os.getenv("VITE_SUPABASE_URL")
# Using the service role key provided in the original script
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE"

if not URL:
    print("❌ Error: VITE_SUPABASE_URL not found in .env file.")
    exit(1)

supabase: Client = create_client(URL, SERVICE_ROLE_KEY)

def export_inventory():
    print("Iniciando exportacion de inventario para Guayaquil...")

    try:
        # 1. Obtener ID de la bodega "Guayaquil"
        warehouse_res = supabase.table('warehouses').select('id').eq('name', 'Guayaquil').execute()
        warehouse = warehouse_res.data[0] if warehouse_res.data else None

        if not warehouse:
            print("Error: No se encontro la bodega 'Guayaquil'.")
            return

        guayaquil_id = warehouse['id']
        print(f"ID de Bodega Guayaquil: {guayaquil_id}")

        # 2. Obtener niveles de inventario con stock > 0
        print("Obteniendo productos con stock disponible...")
        # Join patterns in postgrest-py (supabase-py) use select string format
        inventory_res = supabase.table('inventory_levels').select("""
            product_id,
            current_stock,
            products (
                sku,
                name,
                price,
                category,
                reference_image_url,
                brands (
                    name
                )
            )
        """).eq('warehouse_id', guayaquil_id).gt('current_stock', 0).execute()

        inventory = inventory_res.data

        if not inventory:
            print("No se encontraron productos con stock en Guayaquil.")
            # We'll still continue to save an empty list
            inventory = []

        # 3. Formatear los datos
        formatted_data = []
        for item in inventory:
            prod = item.get('products')
            if not prod:
                continue
                
            brand = prod.get('brands')
            brand_name = brand.get('name') if brand else "N/A"
            
            formatted_data.append({
                "id": prod.get('sku'),
                "codigo_referencia": prod.get('sku'),
                "nombre": prod.get('name'),
                "marca": brand_name,
                "precio": math.ceil(prod.get('price') or 0),
                "categoria": prod.get('category') or "General",
                "imagen": prod.get('reference_image_url') or "sin_imagen.jpg",
                "stock": item.get('current_stock') > 0
            })

        # 4. Guardar a JSON
        output = {
            "RAW_SCRAPED_DATA": formatted_data
        }

        output_path = Path(__file__).parent.parent / 'inventario desorganizado' / 'data_guayaquil.json'
        # Ensure the directory exists
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=4, ensure_ascii=False)

        print(f"Exportacion completa: {len(formatted_data)} productos guardados en {output_path}")

    except Exception as e:
        print(f"Ocurrio un error inesperado: {e}")

if __name__ == "__main__":
    export_inventory()
