/**
 * @file lib/auth/limitador.ts
 * @description Límite de envíos de Magic Link (TASK 9).
 *
 * ⚠️ Limitación conocida (igual que el límite de /api/chat, issue #9): vive en
 * la memoria del proceso. Se reinicia con el servidor y no se comparte entre
 * instancias serverless. Es una primera barrera contra el abuso; el límite
 * de correos de Supabase Auth es la segunda. Si hace falta, se migra a un
 * almacén compartido (Redis/Upstash) en otra TASK.
 */

export interface OpcionesLimitador {
  max: number;
  ventanaMs: number;
  /** Reloj inyectable para las pruebas. */
  reloj?: () => number;
  /** Tope de claves guardadas antes de limpiar las vencidas. */
  maxEntradas?: number;
}

export interface Limitador {
  /** `true` si la clave aún tiene cupo (y lo consume). */
  permitir: (clave: string) => boolean;
  /** Cantidad de claves guardadas (para pruebas). */
  tamano: () => number;
}

export function crearLimitador({
  max,
  ventanaMs,
  reloj = Date.now,
  maxEntradas = 10_000,
}: OpcionesLimitador): Limitador {
  const contadores = new Map<string, { cuenta: number; venceEn: number }>();

  function limpiarVencidas(ahora: number): void {
    for (const [clave, entrada] of contadores) {
      if (ahora > entrada.venceEn) contadores.delete(clave);
    }
  }

  return {
    permitir(clave: string): boolean {
      const ahora = reloj();
      if (contadores.size >= maxEntradas) limpiarVencidas(ahora);

      const entrada = contadores.get(clave);
      if (!entrada || ahora > entrada.venceEn) {
        // Tope duro: con el mapa lleno de claves vivas no se aceptan claves nuevas
        // (así la memoria no crece sin límite si alguien inunda con claves distintas).
        if (!entrada && contadores.size >= maxEntradas) return false;
        contadores.set(clave, { cuenta: 1, venceEn: ahora + ventanaMs });
        return true;
      }
      if (entrada.cuenta >= max) return false;
      entrada.cuenta += 1;
      return true;
    },
    tamano: () => contadores.size,
  };
}

const LARGO_MAXIMO_CLAVE_IP = 64;

/** Clave por correo: normalizada, para que `Ana@X.cl` y `ana@x.cl` cuenten juntos. */
export function claveEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Clave por IP: acotada (el encabezado lo puede inflar el cliente). */
export function claveIp(ip: string | null): string {
  return (ip ?? 'desconocida').slice(0, LARGO_MAXIMO_CLAVE_IP);
}
