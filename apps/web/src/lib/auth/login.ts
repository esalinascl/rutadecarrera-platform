/**
 * @file lib/auth/login.ts
 * @description Caso de uso «pedir un Magic Link» (TASK 9). Lógica pura con
 * dependencias inyectadas (envío del correo y límite), para probarla sin red.
 *
 * Seguridad:
 * - Respuesta NEUTRA: el mensaje es el mismo exista o no el email, y también
 *   si el envío falla (no se puede averiguar qué correos están registrados).
 * - `siguiente` pasa por `rutaSiguienteSegura` (sin redirecciones abiertas).
 * - Dos límites independientes: por correo (no se bombardea a una víctima cambiando
 *   de IP) y por IP (no se recorren correos ajenos desde una sola IP).
 */

import { rutaSiguienteSegura } from './acceso';
import { claveEmail, claveIp, type Limitador } from './limitador';

export const MENSAJE_NEUTRO =
  'Si el correo es válido, te enviamos un enlace para ingresar. Revisa tu bandeja de entrada.';

const MENSAJE_EMAIL_INVALIDO = 'Ingresa un correo electrónico válido.';
const MENSAJE_LIMITE = 'Demasiados intentos. Espera unos minutos antes de pedir otro enlace.';

/** Patrón mínimo y deliberadamente simple: la validación real la hace el envío del correo. */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LARGO_MAXIMO_EMAIL = 254;

export interface PedidoMagicLink {
  email: string;
  ip: string | null;
  siguiente: string | null | undefined;
}

export interface DependenciasLogin {
  /** Envía el correo con el enlace. Devuelve `error` si Supabase lo rechaza. */
  enviarOtp: (email: string, urlRedireccion: string) => Promise<{ error: unknown }>;
  /** Envíos por correo (desde cualquier IP). */
  limitadorCorreo: Limitador;
  /** Envíos por IP (a cualquier correo). */
  limitadorIp: Limitador;
  /** URL absoluta de `/auth/callback` (sin query), construida desde NEXT_PUBLIC_APP_URL. */
  urlCallback: string;
}

export interface ResultadoLogin {
  estado: 200 | 400 | 429;
  mensaje: string;
}

export async function solicitarMagicLink(
  pedido: PedidoMagicLink,
  deps: DependenciasLogin,
): Promise<ResultadoLogin> {
  const email = pedido.email.trim().toLowerCase();

  if (email.length === 0 || email.length > LARGO_MAXIMO_EMAIL || !PATRON_EMAIL.test(email)) {
    return { estado: 400, mensaje: MENSAJE_EMAIL_INVALIDO };
  }

  if (
    !deps.limitadorIp.permitir(claveIp(pedido.ip)) ||
    !deps.limitadorCorreo.permitir(claveEmail(email))
  ) {
    return { estado: 429, mensaje: MENSAJE_LIMITE };
  }

  const siguiente = rutaSiguienteSegura(pedido.siguiente);
  const urlRedireccion = `${deps.urlCallback}?siguiente=${encodeURIComponent(siguiente)}`;

  try {
    const { error } = await deps.enviarOtp(email, urlRedireccion);
    if (error) {
      // Solo al log del servidor: al usuario nunca se le dice qué falló.
      console.error('No se pudo enviar el Magic Link:', error);
    }
  } catch (error) {
    console.error('Error inesperado al enviar el Magic Link:', error);
  }

  return { estado: 200, mensaje: MENSAJE_NEUTRO };
}
