/**
 * La bitácora como un PNG cuadrado, listo para pegar en un chat.
 *
 * Se arma un nodo fuera de pantalla y se captura con `html2canvas` en vez de
 * dibujar el canvas a mano (como hace productShareCard.ts): el contenido es
 * HTML de Tiptap con negritas, listas y títulos, y redibujar eso a mano
 * sería reimplementar un motor de texto.
 *
 * `html2canvas` se importa DINÁMICAMENTE: pesa ~200 kB y solo hace falta al
 * pulsar el botón (ver la nota de vite.config.ts sobre no meter librerías
 * pesadas en el bundle principal).
 *
 * Los colores van escritos a mano y no con los tokens del tema: el nodo se
 * captura fuera de pantalla y la tarjeta tiene que salir siempre igual,
 * también cuando el ERP está en modo oscuro.
 */

const LADO = 1200;
const MARGEN = 72;

/** Cuerpo de texto de partida y mínimo al que puede bajar el autoajuste. */
const AUTOAJUSTE_MAX_PX = 27;
const AUTOAJUSTE_MIN_PX = 15;

const FUENTE = '"Inter", "Helvetica Neue", Arial, sans-serif';

export type ResultadoImagen = 'copiada' | 'descargada';

export interface DatosImagenBitacora {
    fecha: string;
    resumen: string[];
    contenidoHtml: string;
    autor: string;
    creado: string;
    editado: string | null;
}

/* -------------------------------------------------------------------------- */
/*  Saneado del HTML                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Tiptap valida lo que se escribe contra su esquema, pero acá el HTML llega
 * desde la base y se inyecta en el documento para capturarlo. Cualquier fila
 * con HTML puesto a mano se ejecutaría (`<img onerror=…>`), así que se copia
 * nodo por nodo dejando pasar solo lo que el editor puede producir.
 */
const ETIQUETAS = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'MARK', 'CODE', 'PRE',
    'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR', 'A', 'SPAN', 'DIV',
]);

const ALINEACIONES = new Set(['left', 'center', 'right', 'justify']);

const sanearNodo = (origen: Node, destino: Node, doc: Document) => {
    origen.childNodes.forEach((hijo) => {
        if (hijo.nodeType === Node.TEXT_NODE) {
            destino.appendChild(doc.createTextNode(hijo.textContent || ''));
            return;
        }
        if (hijo.nodeType !== Node.ELEMENT_NODE) return;

        const elemento = hijo as Element;
        if (!ETIQUETAS.has(elemento.tagName)) {
            // La etiqueta no va, pero su texto sí: un <script> no llega acá
            // con contenido visible y un <font> viejo sí.
            if (elemento.tagName === 'SCRIPT' || elemento.tagName === 'STYLE') return;
            sanearNodo(elemento, destino, doc);
            return;
        }

        const copia = doc.createElement(elemento.tagName.toLowerCase());

        // Solo dos atributos sobreviven, y ambos revisados.
        const alineacion = (elemento as HTMLElement).style?.textAlign;
        if (alineacion && ALINEACIONES.has(alineacion)) {
            copia.style.textAlign = alineacion;
        }
        if (elemento.tagName === 'A') {
            const href = elemento.getAttribute('href') || '';
            if (/^https?:\/\//i.test(href)) copia.setAttribute('href', href);
        }

        sanearNodo(elemento, copia, doc);
        destino.appendChild(copia);
    });
};

export const sanearHtmlBitacora = (html: string): DocumentFragment => {
    const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
    const fragmento = document.createDocumentFragment();
    sanearNodo(doc.body, fragmento, document);
    return fragmento;
};

/* -------------------------------------------------------------------------- */
/*  Armado de la tarjeta                                                       */
/* -------------------------------------------------------------------------- */

const ESTILOS = `
.bitacora-png * { margin: 0; padding: 0; box-sizing: border-box; }
.bitacora-png { position: fixed; left: -10000px; top: 0; width: ${LADO}px; height: ${LADO}px;
  background: #ffffff; color: #0f172a; font-family: ${FUENTE};
  display: flex; flex-direction: column; padding: ${MARGEN}px; }
.bitacora-png .etiqueta { font-size: 18px; font-weight: 700; letter-spacing: .18em;
  text-transform: uppercase; color: #2563eb; }
.bitacora-png .fecha { font-size: 52px; font-weight: 800; letter-spacing: -.02em; margin-top: 6px; }
.bitacora-png .regla { height: 4px; background: #2563eb; width: 96px; border-radius: 999px; margin: 20px 0 8px; }
.bitacora-png .cuerpo { flex: 1; min-height: 0; overflow: hidden; padding-top: 12px; }
.bitacora-png .resumen { list-style: none; margin-bottom: 22px; }
.bitacora-png .resumen li { position: relative; padding-left: 26px; margin-bottom: 8px;
  font-weight: 600; line-height: 1.4; }
.bitacora-png .resumen li::before { content: ""; position: absolute; left: 6px; top: .55em;
  width: 9px; height: 9px; border-radius: 999px; background: #2563eb; }
.bitacora-png .contenido { line-height: 1.5; }
.bitacora-png .contenido p { margin: 0 0 .5em; }
.bitacora-png .contenido h1 { font-size: 1.5em; font-weight: 800; margin: .6em 0 .3em; }
.bitacora-png .contenido h2 { font-size: 1.3em; font-weight: 700; margin: .6em 0 .3em; }
.bitacora-png .contenido h3 { font-size: 1.12em; font-weight: 700; margin: .5em 0 .25em; }
.bitacora-png .contenido ul { list-style: disc; padding-left: 1.4em; margin: 0 0 .5em; }
.bitacora-png .contenido ol { list-style: decimal; padding-left: 1.5em; margin: 0 0 .5em; }
.bitacora-png .contenido li { margin: .15em 0; }
.bitacora-png .contenido blockquote { border-left: 3px solid #cbd5e1; padding-left: .8em;
  color: #475569; font-style: italic; margin: 0 0 .5em; }
.bitacora-png .contenido code { background: #f1f5f9; padding: .1em .3em; border-radius: 4px;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: .9em; }
.bitacora-png .contenido pre { background: #f1f5f9; padding: .6em .8em; border-radius: 8px;
  margin: 0 0 .5em; white-space: pre-wrap; word-break: break-word; }
.bitacora-png .contenido pre code { background: none; padding: 0; }
.bitacora-png .contenido mark { background: #fef08a; padding: 0 .15em; border-radius: 3px; }
.bitacora-png .contenido a { color: #2563eb; text-decoration: underline; }
.bitacora-png .contenido hr { border: none; border-top: 1px solid #e2e8f0; margin: .7em 0; }
.bitacora-png .contenido strong { font-weight: 700; }
.bitacora-png .pie { border-top: 1px solid #e2e8f0; padding-top: 18px; font-size: 19px;
  color: #64748b; display: flex; flex-wrap: wrap; gap: 6px 18px; }
.bitacora-png .pie b { color: #0f172a; font-weight: 700; }
`;

const construirTarjeta = (datos: DatosImagenBitacora) => {
    const raiz = document.createElement('div');
    raiz.className = 'bitacora-png';

    const estilos = document.createElement('style');
    estilos.textContent = ESTILOS;
    raiz.appendChild(estilos);

    const cabecera = document.createElement('div');
    cabecera.innerHTML = '<div class="etiqueta">Bitácora</div>';
    const fecha = document.createElement('div');
    fecha.className = 'fecha';
    fecha.textContent = datos.fecha;
    cabecera.appendChild(fecha);
    const regla = document.createElement('div');
    regla.className = 'regla';
    cabecera.appendChild(regla);
    raiz.appendChild(cabecera);

    const cuerpo = document.createElement('div');
    cuerpo.className = 'cuerpo';

    if (datos.resumen.length) {
        const lista = document.createElement('ul');
        lista.className = 'resumen';
        datos.resumen.forEach((punto) => {
            const item = document.createElement('li');
            item.textContent = punto;
            lista.appendChild(item);
        });
        cuerpo.appendChild(lista);
    }

    const contenido = document.createElement('div');
    contenido.className = 'contenido';
    contenido.appendChild(sanearHtmlBitacora(datos.contenidoHtml));
    cuerpo.appendChild(contenido);
    raiz.appendChild(cuerpo);

    const pie = document.createElement('div');
    pie.className = 'pie';
    const partes = [
        `<span>Por <b>${escaparTexto(datos.autor)}</b></span>`,
        `<span>Creada ${escaparTexto(datos.creado)}</span>`,
    ];
    if (datos.editado) partes.push(`<span>Editada ${escaparTexto(datos.editado)}</span>`);
    pie.innerHTML = partes.join('');
    raiz.appendChild(pie);

    return { raiz, cuerpo };
};

const escaparTexto = (valor: string) => {
    const div = document.createElement('div');
    div.textContent = valor;
    return div.innerHTML;
};

/**
 * Baja el cuerpo de letra hasta que todo entra en el cuadrado.
 *
 * Va de mayor a menor y corta en el primero que entra, así que el texto sale
 * siempre lo más grande que permita el espacio. Con los límites de
 * bitacoraLimites.ts casi nunca llega al mínimo.
 */
const autoajustar = (cuerpo: HTMLElement) => {
    for (let px = AUTOAJUSTE_MAX_PX; px >= AUTOAJUSTE_MIN_PX; px -= 1) {
        cuerpo.style.fontSize = `${px}px`;
        if (cuerpo.scrollHeight <= cuerpo.clientHeight) return px;
    }
    return AUTOAJUSTE_MIN_PX;
};

/* -------------------------------------------------------------------------- */
/*  Generación y entrega                                                       */
/* -------------------------------------------------------------------------- */

export const generarImagenBitacora = async (datos: DatosImagenBitacora): Promise<Blob> => {
    const { raiz, cuerpo } = construirTarjeta(datos);
    document.body.appendChild(raiz);

    try {
        autoajustar(cuerpo);

        const { default: html2canvas } = await import('html2canvas');
        const canvas = await html2canvas(raiz, {
            backgroundColor: '#ffffff',
            width: LADO,
            height: LADO,
            scale: 2,
        });

        const blob = await new Promise<Blob | null>((resolver) =>
            canvas.toBlob(resolver, 'image/png'),
        );
        if (!blob) throw new Error('No se pudo generar la imagen de la bitácora.');
        return blob;
    } finally {
        raiz.remove();
    }
};

/**
 * Copia la imagen al portapapeles y, si no se puede, la descarga.
 *
 * El portapapeles solo existe en contexto seguro (HTTPS o localhost) y el
 * sistema se abre a diario por IP en la red local, donde no está — ver la
 * nota de utils/portapapeles.ts. Ahí la descarga es la única salida, y por
 * eso el resultado dice cuál de las dos ocurrió.
 */
export const copiarBitacoraComoImagen = async (
    datos: DatosImagenBitacora,
): Promise<ResultadoImagen> => {
    const blob = await generarImagenBitacora(datos);
    const nombre = `bitacora-${datos.fecha.replace(/[^\w]+/g, '-').toLowerCase()}.png`;

    if (navigator.clipboard && typeof window.ClipboardItem !== 'undefined') {
        try {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return 'copiada';
        } catch {
            // El navegador rechaza escribir el portapapeles si la pestaña
            // perdió el foco; la descarga siempre funciona.
        }
    }

    const url = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
    return 'descargada';
};
