#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
  process.exit(1);
}

const TABLES = [
  "profiles",
  "shops",
  "b2b_accounts",
  "categories",
  "brands",
  "products",
  "product_variants",
  "price_slabs",
  "orders",
  "sub_orders",
  "order_items",
  "deliveries",
  "payouts",
  "commissions",
  "coupons",
  "cms_pages",
  "settings",
  "audit_logs",
];

async function runBackup() {
  const db = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = path.resolve(process.cwd(), "backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });

  for (const table of TABLES) {
    const { data, error } = await db.from(table).select("*").limit(50000);
    if (error) {
      console.warn(`Skipped ${table}: ${error.message}`);
      continue;
    }
    fs.writeFileSync(
      path.join(outDir, `${table}.json`),
      JSON.stringify(data || [], null, 2),
      "utf8"
    );
    console.log(`Backed up ${table}: ${(data || []).length} rows`);
  }

  console.log(`Backup completed at ${outDir}`);
}

runBackup().catch((err) => {
  console.error("Backup failed:", err?.message || err);
  process.exit(1);
});

