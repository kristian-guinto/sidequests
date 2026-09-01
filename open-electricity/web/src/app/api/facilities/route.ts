import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import masterFacilities from "../../../../../pipeline/data/generators_master.json";
import path from "path";
import fs from "fs";

export const dynamic = "force-dynamic";

function querySQLiteFacilities(region?: string | null) {
  const candidatePaths = [
    process.env.SQLITE_DB_PATH,
    path.resolve(process.cwd(), "..", "open_nem_ph.db"),
    path.resolve(process.cwd(), "open_nem_ph.db"),
  ].filter(Boolean) as string[];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const { DatabaseSync } = require("node:sqlite");
        const db = new DatabaseSync(p, { readOnly: true });
        let sql = "SELECT * FROM facilities";
        const params: any[] = [];
        if (region && region !== "ALL") {
          sql += " WHERE region = ?";
          params.push(region.toUpperCase());
        }
        return db.prepare(sql).all(...params);
      } catch (err) {
        console.warn("[SQLite] Facilities error:", err);
      }
    }
  }
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const region = searchParams.get("region");

  // 1. Try SQLite
  const sqliteData = querySQLiteFacilities(region);
  if (sqliteData && sqliteData.length > 0) {
    return NextResponse.json({ facilities: sqliteData, count: sqliteData.length, source: "sqlite_local" });
  }

  // 2. Try Supabase
  if (supabase) {
    try {
      let query = supabase.from("facilities").select("*");
      if (region && region !== "ALL") {
        query = query.eq("region", region.toUpperCase());
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return NextResponse.json({ facilities: data, count: data.length, source: "supabase" });
      }
    } catch (e) {
      console.warn("Supabase facilities fallback:", e);
    }
  }

  // 3. Fallback to static catalog
  let filtered = masterFacilities;
  if (region && region !== "ALL") {
    filtered = masterFacilities.filter((f) => f.region === region.toUpperCase());
  }

  return NextResponse.json({ facilities: filtered, count: filtered.length, source: "static_catalog" });
}
