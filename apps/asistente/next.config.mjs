/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @rcp/shared se importa como fuente TS (ver "main" en su package.json),
  // no como paquete pre-compilado: Next necesita transpilarlo él mismo.
  transpilePackages: ['@rcp/shared'],
};

export default nextConfig;
