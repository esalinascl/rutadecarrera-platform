/**
 * @file scripts/alta-miembros.ts
 * @description Da de alta a los miembros de la Red desde una lista aprobada
 * por Eduardo (SPEC «Web de la Red y área de miembros» v1.0, R6).
 *
 * Uso (siempre con Doppler; las claves nunca pasan por la terminal):
 *   doppler run --config dev -- node packages/shared/scripts/alta-miembros.ts lista.csv --simular
 *   doppler run --config dev -- node packages/shared/scripts/alta-miembros.ts lista.csv
 *   # Producción, SOLO con el OK de Eduardo:
 *   doppler run --config prd -- node packages/shared/scripts/alta-miembros.ts lista.csv --produccion
 *
 * La lista (CSV, coma o punto y coma) NO va al repo: tiene datos personales.
 * Encabezado: correo,nombre[,codigo_disc]
 *
 * No envía correos. Solo imprime correos y acciones, nunca claves ni tokens.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import {
  aplicarAlta,
  leerListaAlta,
  validarEntorno,
  type DependenciasAlta,
  type RolCuenta,
} from '../src/admin/alta-miembros.ts';

function salirConError(mensaje: string): never {
  console.error(`✖ ${mensaje}`);
  process.exit(1);
}

const argumentos = process.argv.slice(2);
const simular = argumentos.includes('--simular');
const produccion = argumentos.includes('--produccion');
const ruta = argumentos.find((a) => !a.startsWith('--'));

if (!ruta) salirConError('Falta la ruta de la lista (CSV).');

const entorno = validarEntorno({ entornoDoppler: process.env.DOPPLER_ENVIRONMENT, produccion });
if (!entorno.ok) salirConError(entorno.motivo);

const url = process.env.SUPABASE_URL;
const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !claveServicio) salirConError('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Doppler.');

const { filas, errores } = leerListaAlta(readFileSync(ruta, 'utf8'));
for (const error of errores) console.error(`⚠ ${error}`);
if (filas.length === 0) salirConError('La lista no tiene filas válidas.');

const supabase = createClient(url, claveServicio, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Convierte un error de Supabase en un Error con solo su mensaje (sin datos de la petición). */
function fallar(operacion: string, error: { message: string } | null): void {
  if (error) throw new Error(`${operacion}: ${error.message}`);
}

const deps: DependenciasAlta = {
  async buscarUsuarioPorCorreo(correo) {
    const { data, error } = await supabase.from('usuarios').select('id, rol').eq('email', correo).maybeSingle();
    fallar('buscar usuario', error);
    return data ? { id: data.id as string, rol: data.rol as RolCuenta } : null;
  },
  async crearUsuario(correo, nombre) {
    // email_confirm: la cuenta queda lista para el Magic Link, sin correo de confirmación.
    const { data, error } = await supabase.auth.admin.createUser({
      email: correo,
      email_confirm: true,
      user_metadata: { nombre },
    });
    fallar('crear cuenta', error);
    if (!data.user) throw new Error('crear cuenta: Supabase no devolvió el usuario');
    return { id: data.user.id };
  },
  async fijarRolConsultor(id) {
    // Solo sube a quien es cliente: nunca baja a un admin.
    const { error } = await supabase.from('usuarios').update({ rol: 'consultor' }).eq('id', id).eq('rol', 'cliente');
    fallar('fijar rol', error);
  },
  async leerCodigo(id) {
    const { data, error } = await supabase.from('codigos_disc').select('codigo').eq('usuario_id', id).maybeSingle();
    fallar('leer código', error);
    return (data?.codigo as string | undefined) ?? null;
  },
  async buscarDuenoDeCodigo(codigo) {
    const { data, error } = await supabase.from('codigos_disc').select('usuario_id').eq('codigo', codigo).maybeSingle();
    fallar('buscar código', error);
    return (data?.usuario_id as string | undefined) ?? null;
  },
  async asignarCodigo(id, codigo) {
    const { error } = await supabase
      .from('codigos_disc')
      .upsert({ usuario_id: id, codigo, asignado_en: new Date().toISOString() }, { onConflict: 'usuario_id' });
    fallar('asignar código', error);
  },
};

console.log(`${simular ? 'SIMULACIÓN (no se escribe nada)' : 'ALTA'} · entorno ${process.env.DOPPLER_ENVIRONMENT} · ${filas.length} filas`);
const resultados = await aplicarAlta(filas, deps, { simular });
let conError = 0;
for (const r of resultados) {
  if (r.error) {
    conError += 1;
    console.log(`✖ ${r.correo}: ${r.error}${r.acciones.length > 0 ? ` (alcanzó: ${r.acciones.join(', ')})` : ''}`);
  } else {
    console.log(`✔ ${r.correo}: ${r.acciones.join(', ')}`);
  }
}
console.log(`Listo: ${resultados.length - conError} bien, ${conError} con error, ${errores.length} descartadas.`);
process.exit(conError > 0 ? 1 : 0);
