import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

async function main() {
  loadEnvLocal();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey ||
    supabaseUrl.includes("placeholder") ||
    serviceRoleKey.includes("placeholder")
  ) {
    console.error(
      "Missing real NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local."
    );
    process.exit(1);
  }

  const adminEmail = process.env.ADMIN_EMAIL || "annuncio8427@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error("Set ADMIN_PASSWORD environment variable before running setup-admin.mjs.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let existing = null;
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers();
  if (!listErr && listData?.users) {
    existing = listData.users.find(
      (u) => u.email?.toLowerCase() === adminEmail.toLowerCase()
    );
  } else {
    const { data: profileMatch } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", adminEmail)
      .maybeSingle();
    if (profileMatch?.id) {
      const { data: byIdData } = await supabase.auth.admin.getUserById(profileMatch.id);
      existing = byIdData?.user || null;
    } else if (listErr) {
      console.error("Failed to list users:", listErr.message);
      process.exit(1);
    }
  }

  let userId;
  if (existing) {
    const { data: updated, error: updateErr } = await supabase.auth.admin.updateUserById(
      existing.id,
      {
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          ...existing.user_metadata,
          full_name: "Trio Dealers Admin",
          role: "admin",
        },
      }
    );
    if (updateErr || !updated.user) {
      console.error("Failed to update admin user:", updateErr?.message);
      process.exit(1);
    }
    userId = updated.user.id;
    console.log(`Updated existing auth user for ${adminEmail}`);
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "Trio Dealers Admin",
        role: "admin",
      },
    });
    if (createErr || !created.user) {
      console.error("Failed to create admin user:", createErr?.message);
      process.exit(1);
    }
    userId = created.user.id;
    console.log(`Created auth user for ${adminEmail}`);
  }

  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: adminEmail,
      full_name: "Trio Dealers Admin",
      role: "admin",
      is_active: true,
    },
    { onConflict: "id" }
  );

  if (profileErr) {
    console.error("Failed to grant admin role in profiles:", profileErr.message);
    process.exit(1);
  }

  console.log(`Admin access granted to ${adminEmail} (${userId}).`);
}

main();

