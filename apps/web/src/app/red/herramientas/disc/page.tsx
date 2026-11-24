import { URL_TEST_DISC } from '../../../../lib/herramientas';
import { exigirMiembro } from '../../../../lib/red/exigir-miembro';
import { leerCodigoDisc } from '../../../../lib/red/miembro';
import { crearDependenciasMiembro } from '../../../../lib/red/supabase-miembro';

export const metadata = { title: 'Test DISC — Área de miembros' };

/** Herramientas → DISC del miembro (SPEC web de la Red, R5). El test DISC no se toca. */
export default async function PaginaDisc() {
  const miembro = await exigirMiembro('/red/herramientas/disc');
  const codigo = await leerCodigoDisc(await crearDependenciasMiembro(), miembro.id);

  return (
    <main style={{ maxWidth: 720, margin: '48px auto', padding: '0 16px' }}>
      <p>
        <a href="/red">← Área de miembros</a>
      </p>
      <h1>Test DISC</h1>

      {codigo.estado === 'asignado' && (
        <>
          <p>Tu código personal es:</p>
          <p style={{ fontSize: 28, fontFamily: 'monospace', letterSpacing: 2 }}>
            <strong>{codigo.codigo}</strong>
          </p>
          <p>
            <a href={URL_TEST_DISC} target="_blank" rel="noopener noreferrer">
              Abrir el test DISC
            </a>
          </p>
          {/* Texto a validar por Eduardo (R5.2). */}
          <h2>Cómo usarlo con un cliente</h2>
          <ol>
            <li>Comparte con tu cliente el enlace del test y tu código personal.</li>
            <li>Tu cliente escribe su nombre y tu código, y responde el test.</li>
            <li>Cada test queda registrado con tu código: así sabemos que lo aplicaste tú.</li>
            <li>Revisa el informe con tu cliente en tu sesión.</li>
          </ol>
          <p>Durante la marcha blanca el test es gratis, hasta 5 aplicaciones por miembro.</p>
        </>
      )}

      {codigo.estado === 'sin-codigo' && (
        <p role="status">
          Todavía no tienes un código DISC asignado. Escríbele a Eduardo para que te asigne uno.
        </p>
      )}

      {codigo.estado === 'error' && (
        <p role="alert">No pudimos cargar tu código en este momento. Intenta de nuevo en unos minutos.</p>
      )}
    </main>
  );
}
