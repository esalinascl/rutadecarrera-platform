/**
 * Pruebas del alta de miembros de la Red (SPEC web de la Red, R6.1–R6.6).
 * Se escriben ANTES de la implementación (TDD, mandato 3). La base se simula.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  aplicarAlta,
  leerListaAlta,
  validarEntorno,
  type DependenciasAlta,
  type FilaAlta,
} from '../admin/alta-miembros';

describe('leerListaAlta', () => {
  it('lee correo, nombre y código DISC opcional; normaliza el correo', () => {
    const { filas, errores } = leerListaAlta('correo,nombre,codigo_disc\n Ana@Correo.CL , Ana Pérez ,RDC-1\nbeto@correo.cl,Beto,\n');
    expect(errores).toEqual([]);
    expect(filas).toEqual([
      { linea: 2, correo: 'ana@correo.cl', nombre: 'Ana Pérez', codigoDisc: 'RDC-1' },
      { linea: 3, correo: 'beto@correo.cl', nombre: 'Beto', codigoDisc: null },
    ]);
  });

  it('acepta punto y coma (Excel en español) y quita el BOM', () => {
    const { filas } = leerListaAlta('\uFEFFcorreo;nombre\nana@correo.cl;Ana\n');
    expect(filas).toEqual([{ linea: 2, correo: 'ana@correo.cl', nombre: 'Ana', codigoDisc: null }]);
  });

  it('exige el encabezado con correo y nombre', () => {
    const { filas, errores } = leerListaAlta('email,name\nana@correo.cl,Ana\n');
    expect(filas).toEqual([]);
    expect(errores[0]).toMatch(/encabezado/i);
  });

  it('marca correos inválidos, nombres vacíos y correos repetidos con su línea', () => {
    const { filas, errores } = leerListaAlta('correo,nombre\nno-es-correo,Ana\nbeto@correo.cl,\ncata@correo.cl,Cata\nCATA@correo.cl,Cata 2\n');
    expect(filas.map((f) => f.correo)).toEqual(['cata@correo.cl']);
    expect(errores).toEqual([
      'Línea 2: correo inválido.',
      'Línea 3: falta el nombre.',
      'Línea 5: correo repetido (cata@correo.cl).',
    ]);
  });

  it('rechaza un código DISC repetido en la lista (R6.5)', () => {
    const { filas, errores } = leerListaAlta('correo,nombre,codigo_disc\na@c.cl,A,X1\nb@c.cl,B,X1\n');
    expect(filas).toHaveLength(1);
    expect(errores).toEqual(['Línea 3: código DISC repetido (X1).']);
  });

  it('ignora líneas vacías', () => {
    expect(leerListaAlta('correo,nombre\n\n\na@c.cl,A\n\n').filas).toHaveLength(1);
  });
});

describe('validarEntorno (R6.4)', () => {
  it('exige correr con Doppler', () => {
    expect(validarEntorno({ entornoDoppler: undefined, produccion: false })).toMatchObject({ ok: false });
  });

  it('permite staging (dev) sin bandera', () => {
    expect(validarEntorno({ entornoDoppler: 'dev', produccion: false })).toEqual({ ok: true });
  });

  it('se niega a tocar producción sin --produccion', () => {
    const r = validarEntorno({ entornoDoppler: 'prd', produccion: false });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.motivo).toMatch(/--produccion/);
  });

  it('con --produccion exige que el entorno sea realmente producción', () => {
    expect(validarEntorno({ entornoDoppler: 'dev', produccion: true })).toMatchObject({ ok: false });
    expect(validarEntorno({ entornoDoppler: 'prd', produccion: true })).toEqual({ ok: true });
  });
});

/** Base simulada en memoria. */
function crearBase(inicial: { usuarios?: { id: string; correo: string; rol: 'cliente' | 'consultor' | 'admin' }[]; codigos?: Record<string, string> } = {}) {
  const usuarios = [...(inicial.usuarios ?? [])];
  const codigos: Record<string, string> = { ...(inicial.codigos ?? {}) };
  let siguiente = 1;
  const deps: DependenciasAlta = {
    buscarUsuarioPorCorreo: vi.fn(async (correo: string) => {
      const u = usuarios.find((x) => x.correo === correo);
      return u ? { id: u.id, rol: u.rol } : null;
    }),
    crearUsuario: vi.fn(async (correo: string) => {
      const id = `nuevo-${siguiente++}`;
      usuarios.push({ id, correo, rol: 'cliente' });
      return { id };
    }),
    fijarRolConsultor: vi.fn(async (id: string) => {
      const u = usuarios.find((x) => x.id === id);
      if (u) u.rol = 'consultor';
    }),
    leerCodigo: vi.fn(async (id: string) => codigos[id] ?? null),
    buscarDuenoDeCodigo: vi.fn(async (codigo: string) => Object.keys(codigos).find((k) => codigos[k] === codigo) ?? null),
    asignarCodigo: vi.fn(async (id: string, codigo: string) => {
      codigos[id] = codigo;
    }),
  };
  return { deps, usuarios, codigos };
}

const fila = (correo: string, codigoDisc: string | null = null): FilaAlta => ({ linea: 2, correo, nombre: 'Nombre', codigoDisc });

describe('aplicarAlta', () => {
  it('crea la cuenta, la deja como consultor y le asigna el código (R6.1)', async () => {
    const { deps, usuarios, codigos } = crearBase();
    const r = await aplicarAlta([fila('ana@c.cl', 'X1')], deps, { simular: false });
    expect(r).toEqual([{ correo: 'ana@c.cl', acciones: ['cuenta creada', 'rol consultor', 'código DISC asignado'] }]);
    expect(usuarios[0]).toMatchObject({ correo: 'ana@c.cl', rol: 'consultor' });
    expect(codigos['nuevo-1']).toBe('X1');
    expect(deps.crearUsuario).toHaveBeenCalledWith('ana@c.cl', 'Nombre');
  });

  it('es idempotente: la segunda corrida no hace nada (R6.2)', async () => {
    const base = crearBase();
    await aplicarAlta([fila('ana@c.cl', 'X1')], base.deps, { simular: false });
    const r = await aplicarAlta([fila('ana@c.cl', 'X1')], base.deps, { simular: false });
    expect(r).toEqual([{ correo: 'ana@c.cl', acciones: ['sin cambios'] }]);
    expect(base.deps.crearUsuario).toHaveBeenCalledTimes(1);
  });

  it('nunca baja de rol a un admin (R6.2)', async () => {
    const { deps, usuarios } = crearBase({ usuarios: [{ id: 'e', correo: 'edu@c.cl', rol: 'admin' }] });
    const r = await aplicarAlta([fila('edu@c.cl')], deps, { simular: false });
    expect(r[0]?.acciones).toEqual(['sin cambios']);
    expect(usuarios[0]?.rol).toBe('admin');
    expect(deps.fijarRolConsultor).not.toHaveBeenCalled();
  });

  it('sube a consultor a un cliente existente', async () => {
    const { deps } = crearBase({ usuarios: [{ id: 'c', correo: 'cli@c.cl', rol: 'cliente' }] });
    const r = await aplicarAlta([fila('cli@c.cl')], deps, { simular: false });
    expect(r[0]?.acciones).toEqual(['rol consultor']);
  });

  it('en modo --simular no escribe nada y dice qué haría (R6.3)', async () => {
    const { deps, usuarios, codigos } = crearBase();
    const r = await aplicarAlta([fila('ana@c.cl', 'X1')], deps, { simular: true });
    expect(r[0]?.acciones).toEqual(['crearía la cuenta', 'fijaría rol consultor', 'asignaría el código DISC']);
    expect(usuarios).toEqual([]);
    expect(codigos).toEqual({});
    expect(deps.crearUsuario).not.toHaveBeenCalled();
    expect(deps.fijarRolConsultor).not.toHaveBeenCalled();
    expect(deps.asignarCodigo).not.toHaveBeenCalled();
  });

  it('no asigna un código que ya tiene otra cuenta (R6.5) y sigue con las demás filas', async () => {
    const { deps } = crearBase({ usuarios: [{ id: 'b', correo: 'b@c.cl', rol: 'consultor' }], codigos: { b: 'X1' } });
    const r = await aplicarAlta([fila('ana@c.cl', 'X1'), fila('cata@c.cl')], deps, { simular: false });
    expect(r[0]).toMatchObject({ correo: 'ana@c.cl', error: 'el código DISC ya está asignado a otra cuenta' });
    expect(r[1]?.acciones).toContain('cuenta creada');
  });

  it('reasigna el código si el miembro ya tenía otro', async () => {
    const { deps, codigos } = crearBase({ usuarios: [{ id: 'a', correo: 'ana@c.cl', rol: 'consultor' }], codigos: { a: 'VIEJO' } });
    const r = await aplicarAlta([fila('ana@c.cl', 'NUEVO')], deps, { simular: false });
    expect(r[0]?.acciones).toEqual(['código DISC asignado']);
    expect(codigos.a).toBe('NUEVO');
  });

  it('un error de la base en una fila queda en esa fila, sin datos secretos', async () => {
    const { deps } = crearBase();
    vi.mocked(deps.crearUsuario).mockRejectedValueOnce(new Error('fallo de red'));
    const r = await aplicarAlta([fila('ana@c.cl'), fila('beto@c.cl')], deps, { simular: false });
    expect(r[0]).toEqual({ correo: 'ana@c.cl', acciones: [], error: 'fallo de red' });
    expect(r[1]?.acciones).toContain('cuenta creada');
  });
});
