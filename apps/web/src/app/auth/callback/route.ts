/**
 * @file app/auth/callback/route.ts
 * @description GET /auth/callback — intercambia el código del Magic Link por
 * una sesión (cookies httpOnly vía @supabase/ssr) y redirige (TASK 9).
 */

import { NextRequest, NextResponse } from 'next/server';
import { crearClienteServidor } from '../../../lib/supabase/servidor';
import { leerConfigPublica } from '../../../lib/supabase/config';
import { rutaSiguienteSegura } from '../../../lib/auth/acceso';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { appUrl } = leerConfigPublica();
  const codigo = request.nextUrl.searchParams.get('code');
  const siguiente = rutaSiguienteSegura(request.nextUrl.searchParams.get('siguiente'));

  if (codigo) {
    try {
      const supabase = await crearClienteServidor();
      const { error } = await supabase.auth.exchangeCodeForSession(codigo);
      if (!error) {
        return NextResponse.redirect(`${appUrl}${siguiente}`);
      }
      console.error('No se pudo canjear el código del Magic Link:', error.message);
    } catch (error) {
      console.error('Error inesperado en /auth/callback:', error);
    }
  }

  return NextResponse.redirect(`${appUrl}/auth/login?error=enlace_invalido`);
}
