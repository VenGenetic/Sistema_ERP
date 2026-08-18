"""
optimize_product_images.py

Pasa a WebP liviano toda imagen de repuesto que haya quedado en otro formato
(PNG, JPG, BMP, TIFF subidos crudos), tanto la foto principal como las de la
galería, y repunta la fila del producto a la imagen nueva.

Es re-ejecutable: correrlo de nuevo no vuelve a tocar lo ya convertido, así que
sirve como mantenimiento periódico y no como migración de una sola vez.

    py scripts/optimize_product_images.py --dry-run        (ver qué haría)
    py scripts/optimize_product_images.py                  (aplicar)
    py scripts/optimize_product_images.py --recompress-over 300
    py scripts/optimize_product_images.py --sku CB200WF-101

Desde el editor se puede correr con el botón de "Run" sin argumentos: eso
equivale a aplicar los cambios sobre todo el catálogo.

Por qué convierte acá y no con el transformador de Supabase: ese servicio se
factura por imagen origen y fue justamente el gasto que se eliminó (ver
utils/image.ts). La conversión la hace Pillow en local, sin costo por imagen.

El perfil de salida es el mismo que aplica el navegador al subir
(utils/imageCompression.ts): 1600px de lado mayor, calidad 82. Así una foto
convertida acá y una subida desde la app quedan idénticas en peso.

El objeto original NO se borra salvo que se pida --delete-originals: se sube uno
nuevo con extensión .webp y se actualiza la fila. Si algo saliera mal, la imagen
anterior sigue en el bucket y basta con revertir la columna.

Requiere: pip install pillow requests
"""

import argparse
import io
import os
import re
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import quote, unquote

import requests
from PIL import Image, ImageOps

# La consola de Windows suele venir en cp1252 y las flechas de los reportes la
# harían reventar a mitad de una corrida larga.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ─── Perfil de salida: debe seguir a utils/imageCompression.ts ───
MAX_SIDE = 1600
QUALITY = 82
BUCKET = "product_images"
CONCURRENCY = 6


# ─── Credenciales ───

def load_env(path):
    """Lee el .env a mano; el proyecto no usa python-dotenv."""
    values = {}
    if not os.path.exists(path):
        return values
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, raw = line.split("=", 1)
            values[key.strip()] = raw.strip().strip("\"'")
    return values


ENV = load_env(os.path.join(ROOT, ".env"))
SUPABASE_URL = ENV.get("VITE_SUPABASE_URL")
# Hace falta la clave de servicio: el script escribe en Storage y actualiza
# products, y la clave anónima está limitada por RLS.
SERVICE_KEY = ENV.get("SUPABASE_SERVICE_ROLE_KEY") or ENV.get("VITE_SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_KEY:
    sys.exit("Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env")

AUTH_HEADERS = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}
PUBLIC_PREFIX = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/"

session = requests.Session()


def kb(size):
    return f"{size / 1024:.0f} KB"


def encode_path(object_path):
    """Codifica la ruta sin tocar las barras, que la API espera literales."""
    return quote(object_path, safe="/")


def with_retry(fn, tries=3):
    """Reintenta ante caídas de red pasajeras; un catálogo son miles de peticiones."""
    for attempt in range(tries):
        try:
            return fn()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(0.5 * (attempt + 1))


# ─── Lectura del catálogo ───

def fetch_products(only_sku=None):
    rows = []
    page_size = 1000
    sku_filter = f"&sku=eq.{quote(only_sku)}" if only_sku else ""

    offset = 0
    while True:
        url = (
            f"{SUPABASE_URL}/rest/v1/products"
            f"?select=id,sku,image_url,gallery&order=id{sku_filter}"
            f"&limit={page_size}&offset={offset}"
        )
        res = with_retry(lambda: session.get(url, headers=AUTH_HEADERS, timeout=60))
        if not res.ok:
            raise RuntimeError(f"No se pudo listar productos: {res.status_code} {res.text}")
        page = res.json()
        rows.extend(page)
        if len(page) < page_size:
            return rows
        offset += page_size


def object_path_from_url(url):
    """Ruta del objeto dentro del bucket, o None si la URL no apunta a este bucket."""
    if not isinstance(url, str) or not url.startswith(PUBLIC_PREFIX):
        return None
    return unquote(url[len(PUBLIC_PREFIX):].split("?")[0])


def extension_of(object_path):
    return object_path.rsplit(".", 1)[-1].lower() if "." in object_path else ""


def image_targets_of(product):
    """
    Toda imagen del producto: la principal más las de la galería. Los videos de
    la galería viven en otro bucket y quedan fuera por el prefijo.
    """
    targets = []

    if product.get("image_url"):
        targets.append({"url": product["image_url"], "field": "image_url", "index": None})

    gallery = product.get("gallery") or []
    if isinstance(gallery, list):
        for index, item in enumerate(gallery):
            # La galería guarda objetos {url, type}; toleramos strings sueltos
            # por si quedó alguna entrada de una versión vieja.
            if isinstance(item, str):
                url, kind = item, "image"
            elif isinstance(item, dict):
                url, kind = item.get("url"), item.get("type")
            else:
                continue
            if url and kind != "video":
                targets.append({"url": url, "field": "gallery", "index": index})

    return [t for t in targets if object_path_from_url(t["url"])]


# ─── Storage ───

def head_size(url):
    res = with_retry(lambda: session.head(url, timeout=60, allow_redirects=True))
    if not res.ok:
        raise RuntimeError(f"no se pudo leer la imagen: {res.status_code}")
    return int(res.headers.get("content-length") or 0)


def download(url):
    res = with_retry(lambda: session.get(url, timeout=120))
    if not res.ok:
        raise RuntimeError(f"descarga falló: {res.status_code}")
    return res.content


def to_webp(data):
    """
    Convierte a WebP encogiendo al lado mayor permitido.

    `exif_transpose` aplica la orientación que traen las fotos de celular: sin
    eso la imagen se guardaría acostada, porque WebP no conserva ese dato.
    """
    with Image.open(io.BytesIO(data)) as image:
        animated = getattr(image, "n_frames", 1) > 1
        out = io.BytesIO()

        if animated:
            # Los cuadros se guardan tal cual: redimensionar una animación
            # cuadro a cuadro rompe las paletas y los GIF del catálogo ya son
            # chicos. Lo que importa acá es el cambio de formato.
            image.save(out, "WEBP", quality=QUALITY, method=4, save_all=True)
            return out.getvalue()

        frame = ImageOps.exif_transpose(image)

        # WebP guarda RGB y RGBA; el resto (paleta, CMYK, escala de grises de 16
        # bits) hay que convertirlo antes o Pillow falla al codificar.
        if frame.mode not in ("RGB", "RGBA"):
            frame = frame.convert("RGBA" if "A" in frame.getbands() else "RGB")

        # thumbnail sólo encoge: una imagen chica se deja en su tamaño original.
        frame.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        frame.save(out, "WEBP", quality=QUALITY, method=4)
        return out.getvalue()


def upload_webp(object_path, data):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encode_path(object_path)}"
    headers = {
        **AUTH_HEADERS,
        "Content-Type": "image/webp",
        "Cache-Control": "31536000",
        "x-upsert": "true",
    }
    res = with_retry(lambda: session.post(url, headers=headers, data=data, timeout=120))
    if not res.ok:
        raise RuntimeError(f"subida falló: {res.status_code} {res.text}")


def delete_object(object_path):
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{encode_path(object_path)}"
    res = session.delete(url, headers=AUTH_HEADERS, timeout=60)
    if not res.ok:
        raise RuntimeError(f"borrado falló: {res.status_code} {res.text}")


def update_product(product_id, patch):
    url = f"{SUPABASE_URL}/rest/v1/products?id=eq.{product_id}"
    headers = {**AUTH_HEADERS, "Content-Type": "application/json", "Prefer": "return=minimal"}
    res = with_retry(lambda: session.patch(url, headers=headers, json=patch, timeout=60))
    if not res.ok:
        raise RuntimeError(f"update falló: {res.status_code} {res.text}")


# ─── Conversión ───

class Report:
    """Contadores y salida de la corrida. Las imágenes se convierten en varios
    hilos, así que tanto los contadores como los prints van bajo un candado:
    sin él las líneas de dos hilos se entrelazan y el reporte queda ilegible."""

    def __init__(self):
        self.converted = 0
        self.skipped = 0
        self.failed = 0
        self.before = 0
        self.after = 0
        self._lock = threading.Lock()

    def log(self, line):
        with self._lock:
            print(line)

    def count_converted(self, before, after, line):
        with self._lock:
            self.converted += 1
            self.before += before
            self.after += after
            print(line)

    def count_skipped(self, line):
        with self._lock:
            self.skipped += 1
            print(line)

    def count_failed(self, line):
        with self._lock:
            self.failed += 1
            print(line)


def convert_url(url, label, args, report):
    """
    Devuelve la URL nueva de la imagen, o None si no había nada que hacer o si
    la conversión no valía la pena.
    """
    object_path = object_path_from_url(url)
    extension = extension_of(object_path)
    original_size = 0

    if extension == "webp":
        # Sólo tiene sentido tocarlo si pesa de más y se pidió el barrido.
        if not args.recompress_over:
            return None
        original_size = head_size(url)
        if original_size <= args.recompress_over * 1024:
            return None

    original = download(url)
    if not original_size:
        original_size = len(original)

    converted = to_webp(original)

    # Recomprimir algo que ya está bien sólo degrada la imagen sin ahorrar: si
    # la conversión no adelgaza, se deja la original tal como está.
    if len(converted) >= original_size:
        report.count_skipped(f"  {label:<34} {kb(original_size):>9} → sin mejora, se deja igual")
        return None

    new_path = re.sub(r"\.[^./]+$", "", object_path) + ".webp"
    new_url = PUBLIC_PREFIX + encode_path(new_path)

    if not args.dry_run:
        upload_webp(new_path, converted)
        if args.delete_originals and new_path != object_path:
            try:
                delete_object(object_path)
            except Exception as err:
                report.log(f"  {label:<34} aviso: no se borró el original ({err})")

    report.count_converted(
        original_size, len(converted),
        f"  {label:<34} {kb(original_size):>9} → {kb(len(converted)):>9}")

    # Al recomprimir un WebP la ruta no cambia, así que no hay fila que tocar.
    return None if new_url == url else new_url


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    parser.add_argument("--dry-run", action="store_true", help="muestra qué haría sin modificar nada")
    parser.add_argument("--sku", help="procesa un solo repuesto")
    parser.add_argument("--limit", type=int, help="tope de productos a procesar")
    parser.add_argument("--delete-originals", action="store_true",
                        help="borra el archivo viejo después de convertir")
    parser.add_argument("--recompress-over", type=int, default=0, metavar="KB",
                        help="además, vuelve a comprimir los WebP que pesen más de este tamaño")
    args = parser.parse_args()

    print("— SIMULACIÓN, no se modifica nada —\n" if args.dry_run else "— APLICANDO CAMBIOS —\n")

    products = fetch_products(args.sku)
    with_images = [p for p in products if image_targets_of(p)]

    def needs_review(product):
        for target in image_targets_of(product):
            if args.recompress_over:
                return True
            if extension_of(object_path_from_url(target["url"])) != "webp":
                return True
        return False

    # Sin el barrido de recompresión sólo interesan los que tienen algo que no
    # es WebP; filtrarlos acá evita descargar el catálogo entero.
    pending = [p for p in with_images if needs_review(p)]
    if args.limit:
        pending = pending[:args.limit]

    print(f"Productos con imagen: {len(with_images)}")
    print(f"Productos a revisar:  {len(pending)}\n")
    if not pending:
        print("No hay ninguna imagen fuera de formato. Todo el catálogo ya está en WebP.")
        return

    report = Report()

    # Un mismo archivo puede estar referenciado por varios productos (la foto
    # por convención `products/<SKU>_cut.webp`, por ejemplo). Se agrupan las
    # URLs únicas para convertir cada archivo una sola vez, y recién después se
    # actualizan las filas que lo usan.
    by_url = {}
    for product in pending:
        for target in image_targets_of(product):
            label = (product["sku"] if target["field"] == "image_url"
                     else f"{product['sku']} [galería {target['index'] + 1}]")
            by_url.setdefault(target["url"], label)

    def work(item):
        url, label = item
        try:
            return url, convert_url(url, label, args, report)
        except Exception as err:
            report.count_failed(f"  {label:<34} ERROR: {err}")
            return url, None

    with ThreadPoolExecutor(max_workers=CONCURRENCY) as pool:
        new_urls = dict(pool.map(work, by_url.items()))

    # ─── Repuntar las filas a las imágenes nuevas ───
    for product in pending:
        patch = {}
        gallery = list(product.get("gallery") or [])

        for target in image_targets_of(product):
            new_url = new_urls.get(target["url"])
            if not new_url:
                continue
            if target["field"] == "image_url":
                patch["image_url"] = new_url
            else:
                item = gallery[target["index"]]
                gallery[target["index"]] = ({"url": new_url, "type": "image"}
                                            if isinstance(item, str)
                                            else {**item, "url": new_url})
                patch["gallery"] = gallery

        if patch and not args.dry_run:
            try:
                update_product(product["id"], patch)
            except Exception as err:
                report.count_failed(f"  {product['sku']:<34} ERROR al actualizar la fila: {err}")

    print(f"\nConvertidas: {report.converted}   "
          f"Sin mejora: {report.skipped}   Con error: {report.failed}")
    if report.converted:
        saved = 100 - (report.after / report.before) * 100
        print(f"Peso: {kb(report.before)} → {kb(report.after)}  ({saved:.1f}% menos)")
    if args.dry_run:
        print("\nNada se modificó. Corre sin --dry-run para aplicar.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit("\nInterrumpido.")
    except Exception as err:
        sys.exit(f"\nFalló el script: {err}")
