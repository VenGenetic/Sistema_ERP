import os
from supabase import create_client, Client
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# Supabase configuration
URL = os.getenv("VITE_SUPABASE_URL")
# Using the same service role key as in the JS script
SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE"

if not URL:
    print("Error: VITE_SUPABASE_URL not found in .env file.")
    exit(1)

supabase: Client = create_client(URL, SERVICE_ROLE_KEY)

def transfer():
    print("Iniciando transferencia de Bodega Principal a Guayaquil...")

    try:
        # 1. Obtener ID de Bodega Principal
        bp_response = supabase.table('warehouses').select('id, partner_id').eq('name', 'Bodega Principal').single().execute()
        bp_data = bp_response.data
        
        if not bp_data:
            print("No se encontró 'Bodega Principal'.")
            return

        source_warehouse_id = bp_data['id']
        partner_id = bp_data['partner_id']
        print(f"Bodega Principal ID: {source_warehouse_id}")

        # 2. Obtener o crear Guayaquil
        g_response = supabase.table('warehouses').select('id').eq('name', 'Guayaquil').execute()
        guayaquil = g_response.data[0] if g_response.data else None
        
        target_warehouse_id = None

        if not guayaquil:
            print("Creando bodega 'Guayaquil'...")
            new_wh_response = supabase.table('warehouses').insert([{
                'name': 'Guayaquil',
                'type': 'physical',
                'partner_id': partner_id
            }]).execute()
            
            if not new_wh_response.data:
                print("Error creando bodega Guayaquil.")
                return
            target_warehouse_id = new_wh_response.data[0]['id']
        else:
            target_warehouse_id = guayaquil['id']
        
        print(f"Guayaquil ID: {target_warehouse_id}")

        if source_warehouse_id == target_warehouse_id:
            print("La bodega de origen y destino son la misma. Abortando.")
            return

        # 3. Obtener todo el inventario de Bodega Principal
        print("Obteniendo niveles de inventario de Bodega Principal...")
        inventory_response = supabase.table('inventory_levels').select('*').eq('warehouse_id', source_warehouse_id).execute()
        inventory = inventory_response.data

        if not inventory:
            print("No hay productos en Bodega Principal para transferir.")
            return

        print(f"Se encontraron {len(inventory)} registros de inventario. Transfiriendo...")

        # 4. Mover el inventario
        # Obtener lo que ya hay en Guayaquil para sumar si es necesario
        target_inventory_response = supabase.table('inventory_levels').select('*').eq('warehouse_id', target_warehouse_id).execute()
        target_inventory = target_inventory_response.data or []
        target_map = {item['product_id']: item for item in target_inventory}

        transfer_count = 0
        
        for item in inventory:
            # Ignorar si el stock es 0 (opcional, pero ayuda a limpiar)
            if item['current_stock'] <= 0:
                continue

            target_item = target_map.get(item['product_id'])
            current_target_stock = target_item['current_stock'] if target_item else 0
            new_stock = current_target_stock + item['current_stock']

            # Upsert a Guayaquil
            supabase.table('inventory_levels').upsert({
                'product_id': item['product_id'],
                'warehouse_id': target_warehouse_id,
                'current_stock': new_stock
            }, on_conflict='product_id, warehouse_id').execute()

            # Dejar en 0 Bodega Principal
            supabase.table('inventory_levels').update({'current_stock': 0}).eq('id', item['id']).execute()

            # Registrar en logs
            supabase.table('inventory_logs').insert([
                {
                    'product_id': item['product_id'],
                    'warehouse_id': source_warehouse_id,
                    'quantity_change': -item['current_stock'],
                    'reason': 'Transferencia a Guayaquil'
                },
                {
                    'product_id': item['product_id'],
                    'warehouse_id': target_warehouse_id,
                    'quantity_change': item['current_stock'],
                    'reason': 'Transferencia desde Bodega Principal'
                }
            ]).execute()

            transfer_count += 1
            if transfer_count % 50 == 0:
                print(f"Transferidos {transfer_count} ítems...")

        print(f"¡Transferencia completada! {transfer_count} productos movidos a Guayaquil.")
    
    except Exception as e:
        print(f"Ocurrió un error inesperado: {e}")

if __name__ == "__main__":
    transfer()
