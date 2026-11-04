/**
 * @file lib/salud/verificar-base.ts
 * @description Lógica de salud de la base: tiempo límite, caché breve y consulta compartida.
 *
 * Por qué existe (SPEC — health-db): el plan gratuito de Supabase pausa los proyectos con 7 días
 * sin actividad, y el de producción ya se pausó. `GET /api/health` hace una consulta mínima y
 * `monitoring.yml` la llama cada 30 minutos: avisa si la base cae y, de paso, cuenta como
 * actividad. No es una garantía (solo el plan Pro lo es).
 *
 * Reglas:
 * - La consulta tiene un tiempo límite de 4 s; al vencer se CANCELA la petición en curso.
 * - El resultado se reutiliza: 30 s si fue ok y solo 5 s si fue un error (la ruta es pública y no
 *   debe poder usarse para saturar la base). El error dura poco para que el reintento de
 *   Monitoring, 10 s después, consulte de verdad en lugar de recibir el error guardado.
 *   Las solicitudes simultáneas comparten una sola consulta.
 * - Nunca lanza: devuelve `ok` o `error`. Al log va solo la causa y el código, jamás el mensaje.
 * - La caché vive en la memoria de cada instancia (no se comparte entre instancias serverless).
 */

import { ErrorBaseDeDatosSalud, ErrorConfiguracionSalud } from './errores';

/** Tiempo máximo que se espera a la base antes de darla por caída. */
const TIEMPO_LIMITE_MS = 4_000;
/** Cuánto tiempo se reutiliza un resultado ok antes de volver a consultar. */
const VIGENCIA_OK_MS = 30_000;
/** Un error se reutiliza menos: debe poder recuperarse rápido y dejar reintentar a Monitoring. */
const VIGENCIA_ERROR_MS = 5_000;

export type EstadoSalud = 'ok' | 'error';

export interface ResultadoSalud {
  estado: EstadoSalud;
  /** Fecha ISO 8601 del momento en que terminó la revisión. */
  revisadoEn: string;
}

type CausaFallo = 'configuracion' | 'timeout' | 'base_de_datos';

export interface DependenciasSalud {
  /** Consulta mínima a la base: debe rechazar si algo falla y respetar la señal de cancelación. */
  consulta: (senal: AbortSignal) => Promise<void>;
  /** Reloj en milisegundos (por defecto, la hora del sistema). Se inyecta en las pruebas. */
  ahora?: () => number;
  /** Registro de eventos (por defecto, `console.error`). Solo recibe la causa y el código. */
  registrar?: (evento: string, datos: Record<string, unknown>) => void;
}

/** Marca interna: la consulta no respondió dentro del tiempo límite. */
class TiempoAgotado extends Error {}

/** Clasifica un fallo sin conservar su mensaje (puede traer direcciones o claves). */
function clasificar(error: unknown): { causa: CausaFallo; codigo?: string } {
  if (error instanceof TiempoAgotado) return { causa: 'timeout' };
  if (error instanceof ErrorConfiguracionSalud) return { causa: 'configuracion' };
  if (error instanceof ErrorBaseDeDatosSalud && error.codigo) {
    return { causa: 'base_de_datos', codigo: error.codigo };
  }
  return { causa: 'base_de_datos' };
}

/** Ejecuta la consulta con tiempo límite; al vencer, aborta la petición y rechaza. */
async function consultarConLimite(consulta: (senal: AbortSignal) => Promise<void>): Promise<void> {
  const control = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const vence = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => {
      control.abort();
      rechazar(new TiempoAgotado());
    }, TIEMPO_LIMITE_MS);
  });
  try {
    await Promise.race([consulta(control.signal), vence]);
  } finally {
    clearTimeout(temporizador);
  }
}

/**
 * Crea un verificador de salud con su propia caché. Cada llamada a la función devuelta
 * entrega el último resultado vigente o, si venció, hace una consulta nueva.
 */
export function crearVerificadorDeSalud(dependencias: DependenciasSalud): () => Promise<ResultadoSalud> {
  const { consulta } = dependencias;
  const ahora = dependencias.ahora ?? (() => Date.now());
  const registrar =
    dependencias.registrar ?? ((evento: string, datos: Record<string, unknown>) => console.error(evento, datos));

  let guardado: { resultado: ResultadoSalud; momento: number } | undefined;
  let enCurso: Promise<ResultadoSalud> | undefined;

  async function revisar(): Promise<ResultadoSalud> {
    let estado: EstadoSalud = 'ok';
    try {
      await consultarConLimite(consulta);
    } catch (error) {
      estado = 'error';
      const { causa, codigo } = clasificar(error);
      registrar('health_db_error', codigo === undefined ? { causa } : { causa, codigo });
    }
    const momento = ahora();
    const resultado: ResultadoSalud = { estado, revisadoEn: new Date(momento).toISOString() };
    guardado = { resultado, momento };
    return resultado;
  }

  return () => {
    if (guardado) {
      const vigencia = guardado.resultado.estado === 'ok' ? VIGENCIA_OK_MS : VIGENCIA_ERROR_MS;
      if (ahora() - guardado.momento < vigencia) {
        return Promise.resolve(guardado.resultado);
      }
    }
    if (!enCurso) {
      enCurso = revisar().finally(() => {
        enCurso = undefined;
      });
    }
    return enCurso;
  };
}
