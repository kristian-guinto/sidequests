import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // DuckDB uses native Node bindings; exclude from webpack bundling
  serverExternalPackages: ["@duckdb/node-api", "@duckdb/node-bindings"],
};

export default nextConfig;
