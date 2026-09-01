/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["echarts", "zrender", "echarts-for-react"],
  experimental: {
    serverComponentsExternalPackages: ["duckdb"],
  },
};

export default nextConfig;
