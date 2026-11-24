/**
 * @file admin/alta-miembros.ts
 * @description Alta de miembros de la Red desde una lista aprobada por Eduardo
 * (SPEC «Web de la Red y área de miembros» v1.0, R6.1–R6.6).
 *
 * Lógica pura con dependencias inyectadas (la base y Supabase Auth se pasan
 * desde el script `scripts/alta-miembros.ts`), para probarla sin red.
 *
 * Reglas:
 * - No envía correos: la cuenta se crea con el correo ya confirmado y la
 *   invitación va aparte, bajo la regla de envíos.
 * - Idempotente: correrlo dos veces deja todo igual; nunca baja el rol de nadie.
 * - `simular: true` no escribe nada y dice qué haría.
 * - Nunca devuelve claves ni tokens: solo correos y acciones.
 */

export type RolCuenta = 'cliente' | 'consultor' | 'admin';

/** Una fila válida de la lista de alta. */
export interface FilaAlta {
  /** Línea del archivo (para los mensajes de error). */
  linea: number;
  /** Correo en minúsculas y sin espacios. */
  correo: string;
  nombre: string;
  /** Código DISC a asignar, o `null` si la fila no trae. */
  codigoDisc: string | null;
}

export interface ListaAlta {
  filas: FilaAlta[];
  /** Mensajes «Línea N: …» de las filas descartadas. */
  errores: string[];
}

/** Patrón mínimo (el mismo criterio que el login): la validación real la hace Supabase. */
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Lee la lista de alta (CSV con coma o punto y coma). Encabezado obligatorio:
 * `correo,nombre` y, opcional, `codigo_disc`.
 */
export function leerListaAlta(texto: string): ListaAlta {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  const separador = (lineas[0] ?? '').includes(';') ? ';' : ',';
  const encabezado = (lineas[0] ?? '').split(separador).map((c) => c.trim().toLowerCase());
  const iCorreo = encabezado.indexOf('correo');
  const iNombre = encabezado.indexOf('nombre');
  const iCodigo = encabezado.indexOf('codigo_disc');

  if (iCorreo === -1 || iNombre === -1) {
    return { filas: [], errores: ['El encabezado debe tener las columnas «correo» y «nombre» (y, opcional, «codigo_disc»).'] };
  }

  const filas: FilaAlta[] = [];
  const errores: string[] = [];
  const correosVistos = new Set<string>();
  const codigosVistos = new Set<string>();

  lineas.slice(1).forEach((linea, i) => {
    if (linea.trim() === '') return;
    const numero = i + 2;
    const celdas = linea.split(separador).map((c) => c.trim());
    const correo = (celdas[iCorreo] ?? '').toLowerCase();
    const nombre = celdas[iNombre] ?? '';
    const codigo = iCodigo === -1 ? '' : (celdas[iCodigo] ?? '');

    if (!PATRON_EMAIL.test(correo) || correo.length > 254) {
      errores.push(`Línea ${numero}: correo inválido.`);
      return;
    }
    if (nombre === '') {
      errores.push(`Línea ${numero}: falta el nombre.`);
      return;
    }
    if (correosVistos.has(correo)) {
      errores.push(`Línea ${numero}: correo repetido (${correo}).`);
      return;
    }
    if (codigo !== '' && codigosVistos.has(codigo)) {
      errores.push(`Línea ${numero}: código DISC repetido (${codigo}).`);
      return;
    }

    correosVistos.add(correo);
    if (codigo !== '') codigosVistos.add(codigo);
    filas.push({ linea: numero, correo, nombre, codigoDisc: codigo === '' ? null : codigo });
  });

  return { filas, errores };
}

export type ResultadoEntorno = { ok: true } | { ok: false; motivo: string };

/**
 * Decide si el script puede correr en el entorno actual (R6.4).
 * `entornoDoppler` es `DOPPLER_ENVIRONMENT`, que `doppler run` define solo.
 */
export function validarEntorno(opciones: { entornoDoppler: string | undefined; produccion: boolean }): ResultadoEntorno {
  const { entornoDoppler, produccion } = opciones;
  if (!entornoDoppler) {
    return { ok: false, motivo: 'Corre el script con `doppler run`: así las claves no pasan por la terminal.' };
  }
  if (entornoDoppler === 'prd' && !produccion) {
    return { ok: false, motivo: 'Este entorno es PRODUCCIÓN: agrega --produccion (solo con el OK de Eduardo).' };
  }
  if (produccion && entornoDoppler !== 'prd') {
    return { ok: false, motivo: `Pediste --produccion, pero el entorno de Doppler es «${entornoDoppler}».` };
  }
  return { ok: true };
}

/** Acceso a Supabase que necesita el alta (lo implementa el script con la clave de servicio). */
export interface DependenciasAlta {
  buscarUsuarioPorCorreo: (correo: string) => Promise<{ id: string; rol: RolCuenta } | null>;
  /** Crea la cuenta con el correo confirmado y SIN enviar correo. */
  crearUsuario: (correo: string, nombre: string) => Promise<{ id: string }>;
  fijarRolConsultor: (id: string) => Promise<void>;
  leerCodigo: (id: string) => Promise<string | null>;
  /** `usuario_id` que ya tiene ese código, o `null`. */
  buscarDuenoDeCodigo: (codigo: string) => Promise<string | null>;
  asignarCodigo: (id: string, codigo: string) => Promise<void>;
}

export interface ResultadoFila {
  correo: string;
  acciones: string[];
  error?: string;
}

/** Aplica la lista fila por fila. Un error en una fila no detiene las demás. */
export async function aplicarAlta(
  filas: readonly FilaAlta[],
  deps: DependenciasAlta,
  opciones: { simular: boolean },
): Promise<ResultadoFila[]> {
  const resultados: ResultadoFila[] = [];
  for (const fila of filas) {
    const acciones: string[] = [];
    try {
      await procesarFila(fila, deps, opciones.simular, acciones);
      resultados.push({ correo: fila.correo, acciones: acciones.length > 0 ? acciones : ['sin cambios'] });
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'error desconocido';
      resultados.push({ correo: fila.correo, acciones, error: mensaje });
    }
  }
  return resultados;
}

class ErrorDeFila extends Error {}

async function procesarFila(
  fila: FilaAlta,
  deps: DependenciasAlta,
  simular: boolean,
  acciones: string[],
): Promise<void> {
  const existente = await deps.buscarUsuarioPorCorreo(fila.correo);

  // Antes de escribir nada: el código no puede ser de otra cuenta.
  if (fila.codigoDisc !== null) {
    const dueno = await deps.buscarDuenoDeCodigo(fila.codigoDisc);
    if (dueno !== null && dueno !== existente?.id) {
      throw new ErrorDeFila('el código DISC ya está asignado a otra cuenta');
    }
  }

  let id = existente?.id ?? null;
  let rol: RolCuenta = existente?.rol ?? 'cliente';

  if (id === null) {
    if (simular) {
      acciones.push('crearía la cuenta');
    } else {
      id = (await deps.crearUsuario(fila.correo, fila.nombre)).id;
      rol = 'cliente';
      acciones.push('cuenta creada');
    }
  }

  // Nunca se baja el rol: un admin o un consultor se quedan como están.
  if (rol === 'cliente') {
    if (simular) {
      acciones.push('fijaría rol consultor');
    } else if (id !== null) {
      await deps.fijarRolConsultor(id);
      acciones.push('rol consultor');
    }
  }

  if (fila.codigoDisc !== null) {
    const actual = id === null ? null : await deps.leerCodigo(id);
    if (actual !== fila.codigoDisc) {
      if (simular) {
        acciones.push('asignaría el código DISC');
      } else if (id !== null) {
        await deps.asignarCodigo(id, fila.codigoDisc);
        acciones.push('código DISC asignado');
      }
    }
  }
}
