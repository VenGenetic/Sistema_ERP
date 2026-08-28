/**
 * Copiar al portapapeles sin depender de `navigator.clipboard`.
 *
 * Esa API solo existe en contextos seguros: HTTPS o localhost. El sistema
 * se abre todos los días desde la red local por IP (http://192.168.x.x) y
 * ahí NO está: la llamada revienta con un TypeError sin capturar, el botón
 * no hace nada y no se avisa de por qué. Por eso siempre hay que tener el
 * método viejo detrás.
 *
 * Devuelve `false` en vez de tirar: quien llama decide qué mostrar (lo
 * decente es enseñar el texto para que se copie a mano).
 */
export async function copiarTexto(texto: string): Promise<boolean> {
    if (!texto) return false;
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(texto);
            return true;
        }
        const auxiliar = document.createElement('textarea');
        auxiliar.value = texto;
        auxiliar.setAttribute('readonly', '');
        auxiliar.style.position = 'fixed';
        auxiliar.style.opacity = '0';
        document.body.appendChild(auxiliar);
        auxiliar.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(auxiliar);
        return ok;
    } catch {
        return false;
    }
}
