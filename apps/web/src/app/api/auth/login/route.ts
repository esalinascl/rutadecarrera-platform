/**
 * @file app/api/auth/login/route.ts
 * @description POST /api/auth/login — envía el Magic Link (TASK 9, AD-3).
 * La lógica está en lib/auth/login.ts; aquí solo se conecta a Next y Supabase.
 */

import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '../../../../lib/supabase/servidor';
import { leerConfigPublica } from '../../../../lib/supabase/config';
import { crearLimitador } from '../../../../lib/auth/limitador';
import { obtenerIp } from '../../../../lib/auth/ip';
import { solicitarMagicLink } from '../../../../lib/auth/login';

/** 5 envíos cada 10 minutos por correo (desde cualquier IP). */
const limitadorCorreo = crearLimitador({ max: 5, ventanaMs: 10 * 60_000 });
/** 20 envíos cada 10 minutos por IP (a cualquier correo). */
const limitadorIp = crearLimitador({ max: 20, ventanaMs: 10 * 60_000 });

export async function POST(request: NextRequest): Promise<NextResponse> {
  let cuerpo: { email?: unknown; siguiente?: unknown };
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ mensaje: 'Solicitud inválida.' }, { status: 400 });
  }

  const email = typeof cuerpo.email === 'string' ? cuerpo.email : '';
  const siguiente = typeof cuerpo.siguiente === 'string' ? cuerpo.siguiente : null;
  const ip = obtenerIp(request.headers);

  let config;
  try {
    config = leerConfigPublica();
  } catch (error) {
    console.error('Autenticación sin configurar:', error);
    return NextResponse.json({ mensaje: 'Error interno del servidor.' }, { status: 500 });
  }

  const supabase = await crearClienteServidor();
  const resultado = await solicitarMagicLink(
    { email, ip, siguiente },
    {
      limitadorCorreo,
      limitadorIp,
      // La URL base viene de NEXT_PUBLIC_APP_URL, nunca del encabezado Host
      // (evita que un atacante haga que el enlace apunte a otro dominio).
      urlCallback: `${config.appUrl}/auth/callback`,
      enviarOtp: (correo, urlRedireccion) =>
        supabase.auth.signInWithOtp({
          email: correo,
          options: { emailRedirectTo: urlRedireccion, shouldCreateUser: true },
        }),
    },
  );

  return NextResponse.json({ mensaje: resultado.mensaje }, { status: resultado.estado });
}
