/**
 * @file lib/http/cuerpo-acotado.ts
 * @description Lectura del cuerpo JSON de una petición con un TOPE de tamaño, en bytes.
 *
 * Por qué existe (GHSA-mrhx-c7xc-m3w5): Zod < 4.6.6 acumulaba un error por cada
 * elemento inválido de un arreglo. Un cuerpo de 4,2 MB (el máximo que admite Vercel)
 * con 2,2 millones de elementos inválidos hacía que `/api/chat` gastara ~1,8 GB y
 * ~5 s, y tumbaba una función de 1 GB. El parche está en Zod 4.6.6, pero un cuerpo
 * enorme igual cuesta memoria y CPU sin motivo: el tope es una segunda defensa que no
 * depende de la versión de Zod.
 *
 * Reglas:
 * - Si el cliente DECLARA (Content-Length) más que el tope, se responde 413 sin leer nada.
 * - El encabezado puede faltar (cuerpo por trozos) o mentir, así que además se cuentan
 *   los bytes REALES mientras se leen y se corta (cancelando la lectura) al pasar el tope.
 * - Se cuentan bytes, no caracteres: una eñe ocupa 2.
 */

/** Tope del cuerpo de `/api/chat`: 512 KB. El máximo legítimo ronda 410 KB (40 turnos × 5000 caracteres con acentos). */
export const MAX_CUERPO_BYTES = 512 * 1024;

export const MENSAJE_JSON_INVALIDO = 'JSON inválido en el cuerpo de la solicitud';
export const MENSAJE_CUERPO_GRANDE = 'El cuerpo de la solicitud es demasiado grande';

export type LecturaJson =
  | { ok: true; datos: unknown }
  | { ok: false; estado: 400 | 413; error: string };

const CUERPO_GRANDE: LecturaJson = { ok: false, estado: 413, error: MENSAJE_CUERPO_GRANDE };
const JSON_INVALIDO: LecturaJson = { ok: false, estado: 400, error: MENSAJE_JSON_INVALIDO };

/**
 * Lee y parsea el cuerpo JSON de `request` sin pasar de `maxBytes`.
 *
 * No valida la FORMA del JSON (eso lo hace el esquema Zod): solo el tamaño y que sea JSON.
 *
 * @returns `{ ok: true, datos }`, o `{ ok: false, estado: 413 }` si excede el tope,
 *          o `{ ok: false, estado: 400 }` si no hay cuerpo, se cortó la conexión o no es JSON.
 */
export async function leerJsonAcotado(
  request: Request,
  maxBytes: number = MAX_CUERPO_BYTES,
): Promise<LecturaJson> {
  // 1) Rechazo barato: un tamaño declarado que ya excede el tope ni se lee.
  const declarado = Number(request.headers.get('content-length'));
  if (Number.isFinite(declarado) && declarado > maxBytes) {
    return CUERPO_GRANDE;
  }

  const lector = request.body?.getReader();
  if (!lector) {
    return JSON_INVALIDO;
  }

  // 2) Se cuentan los bytes reales: el encabezado puede faltar o mentir.
  const trozos: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await lector.cancel();
        return CUERPO_GRANDE;
      }
      trozos.push(value);
    }
  } catch {
    // Por ejemplo, el cliente cortó la conexión a mitad del cuerpo.
    return JSON_INVALIDO;
  }

  const completo = new Uint8Array(total);
  let desplazamiento = 0;
  for (const trozo of trozos) {
    completo.set(trozo, desplazamiento);
    desplazamiento += trozo.byteLength;
  }

  try {
    return { ok: true, datos: JSON.parse(new TextDecoder().decode(completo)) };
  } catch {
    return JSON_INVALIDO;
  }
}
