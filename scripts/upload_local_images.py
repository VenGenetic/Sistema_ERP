import os
import sys
import json
import urllib.request
import urllib.error
import mimetypes
from concurrent.futures import ThreadPoolExecutor, as_completed

# Clave de servicio de Supabase por defecto si no se encuentra en el archivo .env
FALLBACK_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh6c2RzbXNreW9zZXBlbWFsYWdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTMzMTk4MywiZXhwIjoyMDg2OTA3OTgzfQ.XY-OoGMVyhCcJIbb2sq7VSGL1NnEzZszjs8a6BswizE"

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    env_vars[parts[0].strip()] = parts[1].strip()
    return env_vars

def upload_and_link_image(file_path, supabase_url, service_key, sku_option):
    filename = os.path.basename(file_path)
    
    # Auto-detectar SKU
    name_without_ext = os.path.splitext(filename)[0]
    if sku_option == "1": # Quitar sufijo _cut
        sku = name_without_ext.replace("_cut", "").strip().upper()
    elif sku_option == "2": # Mantener nombre exacto
        sku = name_without_ext.strip().upper()
    else: # Auto-detectar (Opción por defecto)
        sku = name_without_ext.replace("_cut", "").strip().upper()
        
    mime_type, _ = mimetypes.guess_type(file_path)
    if not mime_type:
        mime_type = "image/webp" if filename.endswith(".webp") else "application/octet-stream"

    # Leer contenido del archivo
    with open(file_path, "rb") as f:
        file_data = f.read()

    storage_path = f"products/{filename}"
    upload_url = f"{supabase_url}/storage/v1/object/product_images/{storage_path}"
    public_url = f"{supabase_url}/storage/v1/object/public/product_images/{storage_path}"

    # 1. Subir a Supabase Storage (POST/PUT con x-upsert: true)
    req = urllib.request.Request(
        url=upload_url,
        data=file_data,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": mime_type,
            "x-upsert": "true"
        },
        method="POST"
    )

    try:
        urllib.request.urlopen(req)
    except urllib.error.HTTPError as e:
        # Si da error 400 o similar porque ya existe y el POST con x-upsert falla, intentamos PUT
        try:
            req.method = "PUT"
            urllib.request.urlopen(req)
        except Exception as upload_err:
            return sku, "error", f"Fallo al subir a Storage: {str(upload_err)}"
    except Exception as e:
        return sku, "error", f"Fallo al subir a Storage: {str(e)}"

    # 2. Actualizar campo image_url en la tabla products
    update_url = f"{supabase_url}/rest/v1/products?sku=eq.{sku}"
    payload = json.dumps({"image_url": public_url}).encode("utf-8")
    
    req_db = urllib.request.Request(
        url=update_url,
        data=payload,
        headers={
            "Authorization": f"Bearer {service_key}",
            "apikey": service_key,
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        },
        method="PATCH"
    )

    try:
        with urllib.request.urlopen(req_db) as response:
            res_data = json.loads(response.read().decode("utf-8"))
            if not res_data:
                return sku, "uploaded_only", "Subida OK. No se encontró producto con ese SKU para asociar."
            return sku, "linked", "Subida y enlazada correctamente en base de datos."
    except Exception as e:
        return sku, "uploaded_only", f"Subida OK, pero fallo al asociar en DB: {str(e)}"

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Subida y enlazado masivo de imagenes a Supabase")
    parser.add_argument("--dir", help="Directorio de las imagenes")
    parser.add_argument("--sku-mode", choices=["1", "2"], default="1", help="Modo SKU (1: Auto-detect, 2: Nombre exacto)")
    parser.add_argument("--yes", action="store_true", help="Omitir confirmaciones e interactividad")
    
    args = parser.parse_args()

    print("==================================================")
    print("SUBIDA Y ENLAZADO MASIVO DE IMAGENES A SUPABASE")
    print("==================================================")

    # 1. Cargar variables de entorno
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "../.env")
    env_vars = load_env(env_path)

    supabase_url = env_vars.get("VITE_SUPABASE_URL")
    service_key = env_vars.get("VITE_SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url:
        print("[ERROR] VITE_SUPABASE_URL no encontrado en .env")
        sys.exit(1)
        
    if not service_key:
        print("[ADVERTENCIA] No se encontro VITE_SUPABASE_SERVICE_ROLE_KEY en .env.")
        print("[INFO] Usando clave de servicio administrativa por defecto...")
        service_key = FALLBACK_SERVICE_KEY

    # 2. Seleccionar directorio
    if args.dir:
        target_dir = args.dir
    else:
        # Detectar directorios por defecto
        project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
        potential_paths = {
            "1": os.path.join(project_root, "imagenes_recortadas"),
            "2": os.path.join(project_root, "imagenes_repuestos"),
            "3": os.path.join(project_root, "exported_images")
        }

        print("\nDirectorios de imagenes detectados en tu workspace:")
        valid_options = []
        for opt, path in potential_paths.items():
            exists = os.path.exists(path)
            status = f"Disponible ({len(os.listdir(path))} archivos)" if exists else "No existe"
            print(f"[{opt}] {os.path.basename(path)} -> {status}")
            if exists:
                valid_options.append(opt)

        print("[4] Ingresar una ruta de carpeta personalizada manualmente")

        selected_opt = input("\nSelecciona una opcion (1-4): ").strip()
        
        if selected_opt == "4":
            target_dir = input("Ingresa la ruta absoluta de la carpeta de imagenes: ").strip()
        else:
            target_dir = potential_paths.get(selected_opt)
            if not target_dir or not os.path.exists(target_dir):
                print("[ERROR] Opcion invalida o el directorio no existe.")
                sys.exit(1)

    if not os.path.exists(target_dir):
        print(f"[ERROR] La carpeta '{target_dir}' no existe.")
        sys.exit(1)

    # 3. Listar imágenes válidas
    supported_exts = (".webp", ".png", ".jpg", ".jpeg")
    files_to_process = [
        os.path.join(target_dir, f)
        for f in os.listdir(target_dir)
        if f.lower().endswith(supported_exts)
    ]

    if not files_to_process:
        print("[INFO] No se encontraron imagenes con extensiones compatibles (.webp, .png, .jpg, .jpeg) en esa carpeta.")
        sys.exit(0)

    print(f"\n[CARPETA] Carpeta seleccionada: {target_dir}")
    print(f"[INFO] Se encontraron {len(files_to_process)} imagenes listas para procesar.")

    sku_option = args.sku_mode
    if not args.dir:
        # Elegir modo de SKU interactivo
        print("\n¿Como debe extraerse el SKU del nombre del archivo?")
        print("[1] Auto-detectar (Quitar '_cut' si existe, ej: 'SKU123_cut.webp' -> 'SKU123') [RECOMENDADO]")
        print("[2] Nombre exacto del archivo (Sin la extension, ej: 'SKU123.webp' -> 'SKU123')")
        sku_option = input("Selecciona una opcion (1-2) [Por defecto 1]: ").strip()
        if sku_option not in ("1", "2"):
            sku_option = "1"

    # 5. Iniciar subidas
    if not args.yes:
        confirm = input(f"\n[INICIAR] ¿Deseas iniciar la subida de {len(files_to_process)} imagenes a Supabase? (s/n): ").strip().lower()
        if confirm != "s":
            print("Subida cancelada por el usuario.")
            sys.exit(0)

    print("\n[INICIANDO] Iniciando subida concurrente (10 hilos)... Por favor, espera.\n")

    success_count = 0
    uploaded_only_count = 0
    error_count = 0

    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = {
            executor.submit(upload_and_link_image, file_path, supabase_url, service_key, sku_option): file_path
            for file_path in files_to_process
        }
        
        total = len(futures)
        completed = 0
        
        for future in as_completed(futures):
            completed += 1
            file_path = futures[future]
            filename = os.path.basename(file_path)
            try:
                sku, status, msg = future.result()
                if status == "linked":
                    success_count += 1
                    print(f"[{completed}/{total}] [OK] {filename} -> SKU [{sku}] subido y enlazado.")
                elif status == "uploaded_only":
                    uploaded_only_count += 1
                    print(f"[{completed}/{total}] [ALERTA] {filename} -> SKU [{sku}] subido (Sin producto en BD).")
                else:
                    error_count += 1
                    print(f"[{completed}/{total}] [ERROR] {filename} -> Error: {msg}")
            except Exception as exc:
                error_count += 1
                print(f"[{completed}/{total}] [ERROR] {filename} -> Excepcion generada: {str(exc)}")

    print("\n" + "=" * 50)
    print("SUBIDA FINALIZADA CON EXITO")
    print("=" * 50)
    print(f"Total procesados: {len(files_to_process)}")
    print(f"[OK] Subidos y Enlazados a productos: {success_count}")
    print(f"[ALERTA] Subidos al storage unicamente: {uploaded_only_count}")
    print(f"[ERROR] Fallidos: {error_count}")
    print("=" * 50)
    
    if not args.yes:
        input("\nPresiona Enter para finalizar...")

if __name__ == "__main__":
    main()
