import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB uses native Node bindings; exclude from webpack bundling
  serverExternalPackages: ["duckdb", "duckdb-async"],
};

export default nextConfig;
