import os
import re
import sys
import requests
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Forzar UTF-8 en la consola de Windows para evitar errores de encoding
sys.stdout.reconfigure(encoding='utf-8')

# ─────────────────────────────────────────────
# 1. CONFIGURACIÓN
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent.parent
env_path = BASE_DIR / '.env'
load_dotenv(dotenv_path=env_path)

URL = os.getenv("VITE_SUPABASE_URL")
KEY = os.getenv("VITE_SUPABASE_SERVICE_ROLE_KEY") or os.getenv("VITE_SUPABASE_ANON_KEY")

if not URL or not KEY:
    print("❌ Error: Falta VITE_SUPABASE_URL o Key en el archivo .env")
    exit(1)

supabase: Client = create_client(URL, KEY)
EXPORT_DIR = BASE_DIR / 'exported_images'

# ─────────────────────────────────────────────
# 2. PARSEAR link_images.sql  →  {nombre_archivo: sku}
# ─────────────────────────────────────────────
def build_sku_map() -> dict:
    sql_path = BASE_DIR / 'link_images.sql'
    if not sql_path.exists():
        print("⚠️  No se encontró link_images.sql - se usará el nombre de archivo como código.")
        return {}

    sql_content = sql_path.read_text(encoding='utf-8')
    # Captura: /products/NOMBRE_ARCHIVO' ... WHERE sku = 'SKU'
    pattern = re.compile(r"/products/(.+?)'.*?WHERE sku = '(.+?)'")
    sku_map = {}
    for match in pattern.finditer(sql_content):
        file_name = match.group(1)  # ej: CB200WF-001N_cut.webp
        sku       = match.group(2)  # ej: CB200WF-001N
        sku_map[file_name] = sku
    return sku_map


# ─────────────────────────────────────────────
# 3. LISTAR TODOS LOS ARCHIVOS DEL BUCKET (paginado)
# ─────────────────────────────────────────────
def get_all_files() -> list:
    all_files = []
    offset = 0
    limit  = 1000

    while True:
        response = supabase.storage.from_('product_images').list(
            'products', {"limit": limit, "offset": offset}
        )
        batch = response or []
        if not batch:
            break
        all_files.extend(batch)
        if len(batch) < limit:
            break
        offset += limit

    return all_files


# ─────────────────────────────────────────────
# 4. DESCARGAR UNA IMAGEN Y GUARDARLA
# ─────────────────────────────────────────────
def download_image(storage_path: str, sku: str) -> bool:
    try:
        # Construir la URL pública
        public_url = f"{URL}/storage/v1/object/public/product_images/{storage_path}"

        response = requests.get(public_url, timeout=30)
        response.raise_for_status()

        dest = EXPORT_DIR / f"{sku}.webp"
        dest.write_bytes(response.content)
        return True
    except Exception as e:
        print(f"\n  [!] Error al descargar {sku}: {e}")
        return False


# ─────────────────────────────────────────────
# 5. MAIN
# ─────────────────────────────────────────────
def main():
    print("🚀 Iniciando exportación de imágenes con códigos correctos...\n")

    # Crear carpeta destino
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"📂 Carpeta de destino: {EXPORT_DIR}\n")

    # Construir mapa SKU
    print("🗺️  Construyendo mapa de códigos desde link_images.sql...")
    sku_map = build_sku_map()
    print(f"   → {len(sku_map)} vínculos archivo↔código encontrados.\n")

    # Listar archivos en el Storage
    print('🔍 Listando archivos en el bucket "product_images"...')
    all_files_raw = get_all_files()

    # Filtrar placeholder vacío
    files = [f for f in all_files_raw if f.get('name') != '.emptyFolderPlaceholder']
    print(f"📦 Encontrados {len(files)} archivos en el storage.\n")

    success_count = 0
    fail_count    = 0

    for i, file in enumerate(files):
        file_name    = file['name']
        storage_path = f"products/{file_name}"

        # Determinar el SKU correcto
        if file_name in sku_map:
            sku = sku_map[file_name]           # ✅ Código real del repuesto
        else:
            # Archivo subido manualmente sin SKU registrado
            base = file_name.rsplit('.', 1)[0].replace('.', '_')
            sku  = f"sin_codigo_{base}"

        print(f"⏳ [{i+1}/{len(files)}] {sku}.webp... ", end='', flush=True)

        if download_image(storage_path, sku):
            success_count += 1
            print("✅")
        else:
            fail_count += 1

    # Estadísticas
    with_real_code = sum(1 for f in files if f['name'] in sku_map)
    with_fallback  = len(files) - with_real_code

    print("\n" + "═" * 45)
    print("         RESUMEN DE EXPORTACIÓN")
    print("═" * 45)
    print(f"✅ Exitosas:                   {success_count}")
    print(f"❌ Fallidas:                   {fail_count}")
    print(f"🏷️  Con código real (del SQL):  {with_real_code}")
    print(f"⚠️  Sin código (timestamp):     {with_fallback}")
    print(f"📂 Guardadas en:               {EXPORT_DIR}")
    print("═" * 45)

    if with_fallback > 0:
        print(f"\nℹ️  Los archivos con prefijo 'sin_codigo_' son imágenes")
        print(f"   subidas manualmente sin SKU en link_images.sql.")


if __name__ == "__main__":
    main()
