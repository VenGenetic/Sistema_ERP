import subprocess
import os
import sys

def run_step(step_num, title, cmd, cwd=None):
    print("=" * 50)
    print(f"[{step_num}/3] {title}")
    print("=" * 50)
    print(f"Ejecutando: {cmd}")
    if cwd:
        print(f"Directorio de trabajo: {cwd}")
    print("-" * 50)
    
    try:
        # Ejecuta el comando y transmite la salida a la consola en tiempo real
        subprocess.run(cmd, cwd=cwd, shell=True, check=True)
        print("\n✅ Paso completado con éxito.\n")
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Error en el paso {step_num}: El comando falló con código de salida {e.returncode}")
        input("\nPresiona Enter para salir...")
        sys.exit(e.returncode)

def main():
    # Obtener la ruta absoluta del directorio del script actual
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Definir rutas relativas seguras
    python_exe = os.path.join(base_dir, "odoo_scraper", "venv", "Scripts", "python.exe")
    scraper_script = os.path.join(base_dir, "odoo_scraper", "json_scraper_costos_cantidad.py")
    frontend_dir = os.path.join(base_dir, "Sistema_ERP-main")
    
    # Paso 1: Scrapear datos desde Odoo
    scrape_cmd = f'"{python_exe}" "{scraper_script}"'
    run_step(1, "Scrapeando stock desde Odoo...", scrape_cmd, cwd=base_dir)
    
    # Paso 2: Sincronizar stock a la base de datos de Supabase
    sync_cmd = "node scripts/sync-importer-stock.js"
    run_step(2, "Subiendo datos de stock a Supabase...", sync_cmd, cwd=frontend_dir)
    
    # Paso 3: Sincronizar nuevos productos e imágenes a Supabase
    sync_products_cmd = "node scripts/sync-odoo-products.js"
    run_step(3, "Sincronizando nuevos repuestos y subiendo sus fotos...", sync_products_cmd, cwd=frontend_dir)
    
    print("=" * 50)
    print("🎉 PROCESO COMPLETADO CON ÉXITO")
    print("=" * 50)
    input("\nPresiona Enter para finalizar...")

if __name__ == "__main__":
    main()
