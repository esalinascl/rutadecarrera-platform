// Lógica de cálculo de la Rueda de la Vida, sin DOM ni canvas.
// La cargan la página (index.html) y las pruebas (src/lib/__tests__/rueda-calculos.test.ts):
// una sola copia, para que lo que se prueba sea lo que se publica.

export const PUNTAJE_MIN = 1;
export const PUNTAJE_MAX = 10;
export const PUNTAJE_INICIAL = 5;

/**
 * Convierte un valor cualquiera en un puntaje entero entre 1 y 10.
 * Si no es un número, devuelve el puntaje inicial.
 * @param {unknown} valor
 * @returns {number}
 */
export function normalizarPuntaje(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || valor === '' || !Number.isFinite(n)) {
    return PUNTAJE_INICIAL;
  }
  return Math.min(PUNTAJE_MAX, Math.max(PUNTAJE_MIN, Math.round(n)));
}

/**
 * Resumen de la rueda: promedio (1 decimal), zona más alta y más baja.
 * En caso de empate gana la primera de la lista.
 * @param {number[]} puntajes
 * @param {string[]} nombres
 * @returns {{promedio: string, indiceMasAlta: number, indiceMasBaja: number, nombreMasAlta: string, nombreMasBaja: string}}
 */
export function calcularResumen(puntajes, nombres) {
  if (puntajes.length === 0) {
    return { promedio: '—', indiceMasAlta: -1, indiceMasBaja: -1, nombreMasAlta: '—', nombreMasBaja: '—' };
  }
  const suma = puntajes.reduce((a, b) => a + b, 0);
  const indiceMasAlta = puntajes.indexOf(Math.max(...puntajes));
  const indiceMasBaja = puntajes.indexOf(Math.min(...puntajes));
  return {
    promedio: (suma / puntajes.length).toFixed(1),
    indiceMasAlta,
    indiceMasBaja,
    nombreMasAlta: nombres[indiceMasAlta],
    nombreMasBaja: nombres[indiceMasBaja],
  };
}

/**
 * Primera palabra del nombre de un área (para el resumen).
 * @param {string} nombre
 * @returns {string}
 */
export function etiquetaCorta(nombre) {
  return nombre.split(' ')[0];
}

/**
 * Nombre de archivo de descarga: «AAAAMMDD Rueda de la vida.ext».
 * @param {Date} fecha
 * @param {string} extension
 * @returns {string}
 */
export function nombreArchivo(fecha, extension) {
  const yyyy = fecha.getFullYear();
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  const dd = String(fecha.getDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd} Rueda de la vida.${extension}`;
}
