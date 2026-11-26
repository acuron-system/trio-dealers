import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin, getRequestAuditMeta } from "@/lib/security/csrf";
import { checkRateLimit } from "@/lib/security/rate-limit";

const validateSchema = z
  .object({
    code: z.string().trim().min(2).max(40),
    subtotal: z.number().nonnegative().max(100000000),
  })
  .strict();

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ valid: false, message: "Database not configured." }, { status: 503 });
  }

  const { ip } = getRequestAuditMeta(request);
  const rl = await checkRateLimit("coupon", ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { valid: false, message: "Too many coupon attempts. Please wait a few minutes." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ valid: false, message: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = validateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ valid: false, message: "Invalid coupon request." }, { status: 400 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const normalizedCode = parsed.data.code.toUpperCase();
  const { data: coupon, error } = await supabase
    .from("coupons")
    .select("*")
    .eq("code", normalizedCode)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !coupon) {
    return NextResponse.json(
      { valid: false, message: "Coupon code is invalid or expired." },
      { status: 404 }
    );
  }

  const now = Date.now();
  if (coupon.valid_from && new Date(coupon.valid_from).getTime() > now) {
    return NextResponse.json({ valid: false, message: "Coupon is not active yet." }, { status: 400 });
  }
  if (coupon.valid_to && new Date(coupon.valid_to).getTime() < now) {
    return NextResponse.json({ valid: false, message: "This coupon has expired." }, { status: 400 });
  }

  if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) {
    return NextResponse.json(
      { valid: false, message: "Coupon redemption limit has been reached." },
      { status: 400 }
    );
  }

  if (coupon.min_order_value && parsed.data.subtotal < Number(coupon.min_order_value)) {
    return NextResponse.json(
      {
        valid: false,
        message: `Minimum order of ₹${coupon.min_order_value} required for ${normalizedCode}.`,
      },
      { status: 400 }
    );
  }

  if (user) {
    const { data: existingUse } = await supabase
      .from("coupon_usages")
      .select("id")
      .eq("coupon_id", coupon.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingUse) {
      return NextResponse.json(
        { valid: false, message: "You have already redeemed this coupon." },
        { status: 400 }
      );
    }
  }

  const discountAmount =
    coupon.discount_type === "percentage"
      ? Math.min(
          Math.round((parsed.data.subtotal * Number(coupon.discount_value)) / 100),
          coupon.max_discount ? Number(coupon.max_discount) : parsed.data.subtotal
        )
      : Math.min(Number(coupon.discount_value), parsed.data.subtotal);

  return NextResponse.json({
    valid: true,
    coupon,
    discountAmount,
    message: `Applied ${normalizedCode} (-₹${discountAmount.toLocaleString("en-IN")})`,
  });
}

