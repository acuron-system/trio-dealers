import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertSameOrigin } from "@/lib/security/csrf";

const redeemGiftCardSchema = z
  .object({
    code: z.string().trim().min(4).max(40),
  })
  .strict();

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      walletBalance: 0,
      loyaltyPoints: 0,
      walletEntries: [],
      loyaltyEntries: [],
      referrals: [],
    });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const [walletRes, loyaltyRes, referralsRes] = await Promise.all([
    supabase
      .from("wallet_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("loyalty_ledger")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("referrals")
      .select("*")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const walletBalance = Number(walletRes.data?.[0]?.balance_after || 0);
  const loyaltyPoints = Number(loyaltyRes.data?.[0]?.balance_after || 0);

  return NextResponse.json({
    walletBalance,
    loyaltyPoints,
    walletEntries: walletRes.data || [],
    loyaltyEntries: loyaltyRes.data || [],
    referrals: referralsRes.data || [],
  });
}

export async function POST(request: Request) {
  const csrfError = assertSameOrigin(request);
  if (csrfError) return csrfError;

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured." }, { status: 503 });
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const parsed = redeemGiftCardSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid gift card code." }, { status: 400 });
  }

  const adminClient = createAdminClient();
  const db = adminClient || supabase;
  const code = parsed.data.code.toUpperCase();

  const { data: card } = await db
    .from("gift_cards")
    .select("*")
    .eq("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (!card || card.redeemed_by || Number(card.balance_remaining) <= 0) {
    return NextResponse.json(
      { error: "Gift card is invalid or has already been redeemed." },
      { status: 400 }
    );
  }

  if (card.expires_at && new Date(card.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Gift card has expired." }, { status: 400 });
  }

  const creditAmt = Number(card.balance_remaining);
  const { data: latestWallet } = await db
    .from("wallet_ledger")
    .select("balance_after")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const newBalance = Number(latestWallet?.balance_after || 0) + creditAmt;

  await db
    .from("gift_cards")
    .update({
      redeemed_by: user.id,
      redeemed_at: new Date().toISOString(),
      balance_remaining: 0,
      is_active: false,
    })
    .eq("id", card.id);

  await db.from("wallet_ledger").insert({
    user_id: user.id,
    amount_delta: creditAmt,
    balance_after: newBalance,
    entry_type: "credit_gift_card",
    reference_id: card.id,
    note: `Gift card ${code} redeemed`,
  });

  return NextResponse.json({
    redeemedAmount: creditAmt,
    walletBalance: newBalance,
    message: `Credited ₹${creditAmt.toLocaleString("en-IN")} to your Store Wallet.`,
  });
}

