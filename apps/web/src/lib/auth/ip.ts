/**
 * @file lib/auth/ip.ts
 * @description IP del cliente para los límites de envío (TASK 9).
 *
 * `x-forwarded-for` lo puede falsificar el cliente: el PRIMER valor es el que
 * él mismo escribió. Por eso se prefieren los encabezados que fija la
 * plataforma, y de `x-forwarded-for` se toma el ÚLTIMO valor (el que añadió
 * el proxy más cercano al servidor).
 */

export function obtenerIp(encabezados: Headers): string | null {
  const plataforma = encabezados.get('x-vercel-forwarded-for') ?? encabezados.get('x-real-ip');
  if (plataforma && plataforma.trim()) return plataforma.trim();

  const reenviado = encabezados.get('x-forwarded-for');
  if (reenviado) {
    const ultimo = reenviado.split(',').at(-1)?.trim();
    if (ultimo) return ultimo;
  }
  return null;
}
