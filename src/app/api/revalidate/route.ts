import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";

const revalidateSchema = z
  .object({
    tags: z
      .array(
        z.enum([
          "homepage",
          "banners",
          "products",
          "categories",
          "deals",
          "settings",
          "cms",
        ])
      )
      .min(1)
      .max(10),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ revalidated: false });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || !profile.is_active || !["admin", "shop"].includes(profile.role)) {
    return NextResponse.json({ error: "Insufficient permissions." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = revalidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cache tags." }, { status: 400 });
  }

  for (const tag of parsed.data.tags) {
    revalidateTag(tag);
  }

  return NextResponse.json({ revalidated: true, tags: parsed.data.tags });
}

