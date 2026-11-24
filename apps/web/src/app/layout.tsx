import type { Metadata } from 'next';
import { SiteNav } from '../components/site-nav';

export const metadata: Metadata = {
  title: 'Ruta de Carrera',
  description: 'La ruta hacia una mejor etapa laboral: método, herramientas y una red de consultores de carrera.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
