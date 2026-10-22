'use client';

import { useState, type FormEvent } from 'react';

/** Formulario de ingreso por Magic Link. No revela si el correo existe. */
export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'inicial' | 'enviando' | 'listo' | 'error'>('inicial');
  const [mensaje, setMensaje] = useState('');

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado('enviando');
    try {
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, siguiente }),
      });
      const datos = (await respuesta.json()) as { mensaje?: string };
      setMensaje(datos.mensaje ?? 'Ocurrió un error. Intenta de nuevo.');
      setEstado(respuesta.ok ? 'listo' : 'error');
    } catch {
      setMensaje('No pudimos conectar. Revisa tu conexión e intenta de nuevo.');
      setEstado('error');
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <label htmlFor="email">Correo electrónico</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-describedby="mensaje-login"
        style={{ display: 'block', width: '100%', margin: '8px 0 16px', padding: 8 }}
      />
      <button type="submit" disabled={estado === 'enviando'}>
        {estado === 'enviando' ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
      <p id="mensaje-login" role="status" aria-live="polite">
        {mensaje}
      </p>
    </form>
  );
}
