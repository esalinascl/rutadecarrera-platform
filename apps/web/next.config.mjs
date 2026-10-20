/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @rcp/shared se importa como fuente TS (ver "main" en su package.json),
  // no como paquete pre-compilado: Next necesita transpilarlo él mismo.
  transpilePackages: ['@rcp/shared'],
  // La Rueda de la Vida es una página estática en public/ruedadelavida/.
  // Next no sirve index.html de una carpeta de public/ por sí solo.
  async rewrites() {
    return [
      { source: '/ruedadelavida', destination: '/ruedadelavida/index.html' },
    ];
  },
};

export default nextConfig;
