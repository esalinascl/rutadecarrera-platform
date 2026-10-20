/**
 * @file proxy.ts
 * @description Proxy de Next 16 (antes «middleware»): protege rutas por sesión
 * y rol (TASK 9). La decisión vive en lib/auth/acceso.ts; aquí solo se lee la
 * sesión y se traduce la decisión a una respuesta HTTP.
 *
 * Las rutas públicas NO consultan a Supabase.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { decidirAcceso, type Rol } from './lib/auth/acceso';
import { leerConfigPublica } from './lib/supabase/config';

const ROLES_VALIDOS: readonly string[] = ['cliente', 'consultor', 'admin'];

function esRutaConsultor(pathname: string): boolean {
  return (
    pathname === '/dashboard/consultor' ||
    pathname.startsWith('/dashboard/consultor/') ||
    pathname === '/api/consultor' ||
    pathname.startsWith('/api/consultor/')
  );
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Las rutas públicas no consultan a Supabase.
  if (!requiereSesion(pathname)) {
    return NextResponse.next();
  }

  const config = leerConfigPublica();
  // Las cookies que Supabase renueve se copian a la respuesta final.
  const cookiesNuevas: { name: string; value: string; options?: Record<string, unknown> }[] = [];

  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (aEscribir) => {
        cookiesNuevas.push(...aEscribir);
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const usuario = data?.user ?? null;

  let rol: Rol | null = null;
  if (usuario) {
    rol = 'cliente';
    // El rol solo se consulta donde importa (rutas de consultor).
    if (esRutaConsultor(pathname)) {
      const { data: fila, error } = await supabase
        .from('usuarios')
        .select('rol')
        .eq('id', usuario.id)
        .maybeSingle();
      if (error || !fila || !ROLES_VALIDOS.includes(fila.rol)) {
        // Falla cerrada: sin rol confirmado no hay acceso de consultor.
        if (error) console.error('No se pudo leer el rol del usuario:', error.message);
        rol = 'cliente';
      } else {
        rol = fila.rol as Rol;
      }
    }
  }

  const decision = decidirAcceso({ pathname, rol });
  let respuesta: NextResponse;

  if (decision.tipo === 'redirigir') {
    respuesta = NextResponse.redirect(new URL(decision.destino, request.url));
  } else if (decision.tipo === 'rechazar') {
    const esApi = pathname.startsWith('/api/');
    const mensaje = decision.estado === 401 ? 'No autenticado' : 'Acceso denegado';
    respuesta = esApi
      ? NextResponse.json({ error: mensaje }, { status: decision.estado })
      : new NextResponse(mensaje, { status: decision.estado });
  } else {
    respuesta = NextResponse.next();
  }

  for (const { name, value, options } of cookiesNuevas) {
    respuesta.cookies.set(name, value, options);
  }
  return respuesta;
}

/** Rutas que exigen consultar la sesión (las mismas que protege `decidirAcceso`). */
function requiereSesion(pathname: string): boolean {
  return (
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/api/chat' ||
    esRutaConsultor(pathname)
  );
}

export const config = {
  // Solo las rutas protegidas: no se ejecuta en estáticos ni en páginas públicas.
  matcher: ['/dashboard/:path*', '/api/chat', '/api/consultor/:path*'],
};
