/**
 * Cuánto puede entrar en una bitácora.
 *
 * El límite no es capricho: la bitácora se comparte como un PNG cuadrado de
 * lado fijo, y ahí el texto se achica solo hasta que entra. Sin tope, una
 * bitácora larga se encoge hasta un cuerpo ilegible y la imagen deja de
 * servir para lo único que se usa: mandarla y que se lea de un vistazo.
 *
 * Los valores salen de lo que entra en la tarjeta sin bajar de ~15px de
 * cuerpo (ver AUTOAJUSTE_MIN_PX en bitacoraImagen.ts).
 */

/** Caracteres de contenido. Lo aplica CharacterCount, que bloquea el tecleo. */
export const LIMITE_CONTENIDO = 1500;

/** Puntos del resumen. */
export const LIMITE_PUNTOS = 8;

/** Caracteres por punto del resumen. */
export const LIMITE_CARACTERES_POR_PUNTO = 120;
