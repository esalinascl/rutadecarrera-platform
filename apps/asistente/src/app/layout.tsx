import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Asistente de Empleabilidad — Ruta de Carrera',
  description: 'Asistente de IA para coaching de transición profesional',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
