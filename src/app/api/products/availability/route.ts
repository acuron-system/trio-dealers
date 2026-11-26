import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ unavailableIds: [] });
  }

  try {
    const body = await request.json();
    const productIds: string[] = Array.isArray(body.productIds)
      ? Array.from(new Set(body.productIds.filter((x: unknown) => typeof x === "string" && x.length > 0)))
      : [];

    if (productIds.length === 0) {
      return NextResponse.json({ unavailableIds: [] });
    }

    const db = createAdminClient() || createClient();
    const { data: liveRows } = await db
      .from("products")
      .select("id, approval_status, is_active, is_archived, deleted_at, shop:shops(kyc_status)")
      .in("id", productIds);

    const liveSet = new Set(
      (liveRows || [])
        .filter((p: any) => {
          const shopStatus = Array.isArray(p.shop) ? p.shop[0]?.kyc_status : p.shop?.kyc_status;
          return (
            p.approval_status === "approved" &&
            p.is_active === true &&
            !p.is_archived &&
            !p.deleted_at &&
            (!shopStatus || shopStatus === "approved")
          );
        })
        .map((p: any) => p.id)
    );

    const unavailableIds = productIds.filter((id) => !liveSet.has(id));
    return NextResponse.json({ unavailableIds });
  } catch {
    return NextResponse.json({ unavailableIds: [] });
  }
}

