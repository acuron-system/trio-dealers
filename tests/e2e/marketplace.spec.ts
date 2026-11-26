// Playwright End-to-End Test Plan (run via `npx playwright test` when a staging server + DB are online)
export const E2E_FLOW_MATRIX = [
  {
    name: "Retail Buyer Flow",
    steps: [
      "Visit / (verify luxury dark #0A0A0A + gold emblem)",
      "Navigate to /catalog, filter categories & search fabrics via /api/search",
      "Inspect product detail page, check pincode via /api/service-areas, add variant to bag",
      "Sign in at /login, verify guest cart merges via /api/cart/merge, proceed to /checkout",
      "Validate coupon via /api/coupons/validate and complete COD or Razorpay flow",
    ],
  },
  {
    name: "Seller & Moderation Flow",
    steps: [
      "Sign in as approved Seller Shop -> open /seller/products -> create product + upload image -> Submit for Approval",
      "Sign in as Admin -> open /admin/moderation -> Approve product",
      "Seller advances sub-order at /shop-dashboard & prints GST Slip at /seller/orders/[id]/slip",
    ],
  },
  {
    name: "B2B Matrix & Reorder Flow",
    steps: [
      "Sign in as verified B2B buyer -> open /b2b/dashboard -> Size x Color Matrix tab",
      "Add batch lot across colors/sizes -> save list at /b2b/lists -> manage buyers at /b2b/team",
    ],
  },
  {
    name: "Transporter Two-Leg OTP Handover Flow",
    steps: [
      "Sign in as Transporter -> open /transporter",
      "Confirm Pickup OTP + Delivery OTP + private EXIF-stripped photo upload via /api/transporter/deliveries",
    ],
  },
];

