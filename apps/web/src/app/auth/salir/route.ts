/**
 * @file app/auth/salir/route.ts
 * @description POST /auth/salir — cierra la sesión y vuelve a la portada
 * (SPEC web de la Red, R3.5). Solo POST: un enlace o una imagen no pueden
 * cerrar la sesión de nadie.
 */

import { NextResponse } from 'next/server';
import { crearClienteServidor } from '../../../lib/supabase/servidor';
import { leerConfigPublica } from '../../../lib/supabase/config';

export async function POST(): Promise<NextResponse> {
  const { appUrl } = leerConfigPublica();
  try {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.signOut();
    if (error) console.error('No se pudo cerrar la sesión:', error.message);
  } catch (error) {
    console.error('Error inesperado en /auth/salir:', error);
  }
  // 303: el navegador vuelve a la portada con GET.
  return NextResponse.redirect(`${appUrl}/`, 303);
}
