import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const pincode = (searchParams.get("pincode") || "").trim();

  if (!/^\d{6}$/.test(pincode)) {
    return NextResponse.json(
      { error: "Enter a valid 6-digit Indian pincode." },
      { status: 400 }
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      serviceable: false,
      message: "Connect database to verify live pincode serviceability.",
    });
  }

  const supabase = createClient();
  const { data: area } = await supabase
    .from("service_areas")
    .select("*")
    .eq("pincode", pincode)
    .eq("is_serviceable", true)
    .maybeSingle();

  if (area) {
    return NextResponse.json({
      serviceable: true,
      pincode: area.pincode,
      city: area.city,
      state: area.state,
      codAvailable: Boolean(area.cod_available),
      estimatedDays: area.estimated_days || 4,
      shippingCharge: area.shipping_charge ?? null,
    });
  }

  // Check default national shipping settings from DB if explicit pincode row isn't restricted
  const { data: setting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "shipping_rules")
    .maybeSingle();

  const rules = (setting?.value || {}) as Record<string, any>;
  if (rules.strict_pincode_allowlist === true) {
    return NextResponse.json({
      serviceable: false,
      pincode,
      message: `Delivery is currently unavailable for pincode ${pincode}.`,
    });
  }

  return NextResponse.json({
    serviceable: true,
    pincode,
    city: null,
    state: null,
    codAvailable: rules.cod_enabled !== false,
    estimatedDays: Number(rules.default_eta_days || 5),
    shippingCharge:
      typeof rules.default_charge === "number" ? rules.default_charge : null,
    freeAbove: typeof rules.free_above === "number" ? rules.free_above : null,
  });
}

