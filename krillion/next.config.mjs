/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: '/archive/:path*',
        destination: '/',
        permanent: false,
      },
      {
        source: '/unlimited',
        destination: '/',
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
