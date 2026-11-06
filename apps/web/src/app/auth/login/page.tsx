import { FormularioLogin } from './formulario-login';
import { rutaSiguienteSegura } from '../../../lib/auth/acceso';

export const metadata = { title: 'Ingresar — Ruta de Carrera' };

export default async function PaginaLogin({
  searchParams,
}: {
  searchParams: Promise<{ siguiente?: string; error?: string }>;
}) {
  const { siguiente, error } = await searchParams;

  return (
    <main style={{ maxWidth: 420, margin: '48px auto', padding: '0 24px' }}>
      <h1>Ingresar</h1>
      <p>Te enviaremos un enlace a tu correo. No necesitas contraseña.</p>
      {error === 'enlace_invalido' && (
        <p role="alert">El enlace no es válido o ya venció. Pide uno nuevo.</p>
      )}
      <FormularioLogin siguiente={rutaSiguienteSegura(siguiente)} />
    </main>
  );
}
