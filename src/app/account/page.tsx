"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrdersWithDetails } from "@/lib/db";
import { Address, Order } from "@/types/database";
import { AccountHubAddons } from "@/components/account/account-hub-addons";
import { formatDate, formatINR, getOrderStatusBadge } from "@/lib/utils";
import {
  ShoppingBag,
  MapPin,
  User,
  LogOut,
  Truck,
  Plus,
  Trash2,
} from "lucide-react";

export default function AccountPage() {
  const { user, role, isLoading: authLoading, signOut } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"orders" | "addresses" | "profile">(
    "orders"
  );
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    line1: "",
    line2: "",
    city: "",
    state: "",
    pincode: "",
  });

  useEffect(() => {
    async function loadData() {
      if (!user || !isSupabaseConfigured()) {
        setLoadingData(false);
        return;
      }
      const supabase = createClient();
      const [ordersRes, addrRes] = await Promise.all([
        fetchOrdersWithDetails(supabase, user.id),
        supabase
          .from("addresses")
          .select("*")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false }),
      ]);
      setUserOrders(ordersRes);
      if (!addrRes.error && addrRes.data) {
        setAddresses(addrRes.data as Address[]);
      }
      setLoadingData(false);
    }
    if (!authLoading) {
      loadData();
    }
  }, [user, authLoading]);

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !isSupabaseConfigured()) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        name: user.full_name || "Customer",
        phone: user.phone || "",
        line1: newAddr.line1,
        line2: newAddr.line2 || null,
        city: newAddr.city,
        state: newAddr.state,
        pincode: newAddr.pincode,
        is_default: addresses.length === 0,
        address_type: "home",
      })
      .select("*")
      .single();

    if (!error && data) {
      setAddresses([data as Address, ...addresses]);
      setShowAddAddress(false);
      setNewAddr({ line1: "", line2: "", city: "", state: "", pincode: "" });
    }
  };

  const handleDeleteAddress = async (id: string) => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    await supabase.from("addresses").delete().eq("id", id);
    setAddresses((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (authLoading || loadingData) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-xs text-ink-muted">
        Loading your account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-24 px-4 text-center space-y-4">
        <h2 className="text-2xl font-bold text-ink font-heading">
          Sign In to View Account
        </h2>
        <p className="text-xs text-ink-secondary">
          Access your saved addresses, profile, and live consignment tracking.
        </p>
        <Link
          href="/login?redirect=/account"
          className="inline-block px-6 py-3 btn-gold-luxury text-xs rounded-xl"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-canvas py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Account Hero Card */}
        <div className="rounded-3xl luxury-card p-6 sm:p-8 border border-gold-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gold-500/12 border border-gold-500/40 flex items-center justify-center text-gold-400 font-heading font-black text-2xl shadow-gold">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-ink">
                {user?.full_name || "Trio Customer"}
              </h1>
              <p className="text-xs text-ink-secondary flex flex-wrap items-center gap-2">
                <span className="capitalize text-gold-400 font-semibold">
                  {role || "Customer"}
                </span>
                {user.email && (
                  <>
                    <span>•</span>
                    <span>{user.email}</span>
                  </>
                )}
                {user.phone && (
                  <>
                    <span>•</span>
                    <span>{user.phone}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-4 py-2 rounded-xl bg-surface-subtle hover:border-red-500/40 text-ink-secondary hover:text-red-600 dark:hover:text-red-400 border border-edge text-xs font-semibold transition flex items-center gap-2 self-start sm:self-auto"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-edge text-xs font-semibold gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "orders"
                ? "border-gold-500 text-gold-400"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            My Orders ({userOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("addresses")}
            className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "addresses"
                ? "border-gold-500 text-gold-400"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            <MapPin className="w-4 h-4" />
            Saved Addresses ({addresses.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-3 px-4 border-b-2 transition flex items-center gap-2 whitespace-nowrap ${
              activeTab === "profile"
                ? "border-gold-500 text-gold-400"
                : "border-transparent text-ink-secondary hover:text-ink"
            }`}
          >
            <User className="w-4 h-4" />
            Account Profile
          </button>
        </div>

        {/* TAB CONTENT */}
        {activeTab === "orders" && (
          <div className="space-y-4">
            {userOrders.length === 0 ? (
              <div className="p-12 rounded-2xl luxury-card text-center space-y-3">
                <ShoppingBag className="w-10 h-10 text-ink-muted mx-auto" />
                <h3 className="text-ink font-medium text-sm">
                  No orders placed yet
                </h3>
                <p className="text-xs text-ink-muted">
                  Discover our fine silk sarees and designer suits.
                </p>
                <Link
                  href="/catalog"
                  className="inline-block px-5 py-2.5 btn-gold-luxury text-xs rounded-xl"
                >
                  Browse Catalog
                </Link>
              </div>
            ) : (
              userOrders.map((ord) => {
                const badgeClass = getOrderStatusBadge(ord.status);

                return (
                  <div
                    key={ord.id}
                    className="p-5 sm:p-6 rounded-2xl luxury-card space-y-4 hover:border-gold-500/35 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-edge">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-sm text-gold-400">
                          {ord.order_no}
                        </span>
                        <span className="text-xs text-ink-muted">
                          Placed on {formatDate(ord.created_at)}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}`}
                        >
                          {ord.status}
                        </span>
                        <span className="text-sm font-mono font-bold text-ink">
                          {formatINR(ord.total_amount || ord.total || 0)}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(
                        ord.sub_orders?.flatMap((s) => s.items || []) ||
                        ord.items ||
                        []
                      ).map((it: any) => (
                        <div
                          key={it.id}
                          className="flex justify-between items-center text-xs"
                        >
                          <div>
                            <p className="text-ink font-medium">
                              {it.product_name}
                            </p>
                            <p className="text-[11px] text-ink-secondary">
                              {it.variant_info}
                            </p>
                          </div>
                          <span className="text-ink-secondary font-mono">
                            {formatINR(it.unit_price || it.price || 0)} x{" "}
                            {it.quantity}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 border-t border-edge flex flex-wrap items-center justify-between gap-3 text-xs">
                      <p className="text-ink-muted">
                        Delivering to:{" "}
                        <span className="text-ink-secondary">
                          {ord.address_snapshot.city},{" "}
                          {ord.address_snapshot.state}
                        </span>
                      </p>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/orders/${ord.order_no}`}
                          className="px-4 py-2 rounded-xl btn-gold-luxury text-xs flex items-center gap-1.5"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Track Timeline & Invoice
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === "addresses" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink uppercase tracking-wider">
                Saved Shipping Addresses
              </h3>
              <button
                type="button"
                onClick={() => setShowAddAddress(!showAddAddress)}
                className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-subtle text-gold-400 border border-gold-500/35 text-xs font-semibold transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Address
              </button>
            </div>

            {showAddAddress && (
              <form
                onSubmit={handleAddAddress}
                className="p-6 rounded-2xl luxury-card border border-gold-500/35 space-y-4 text-xs"
              >
                <h4 className="font-bold text-ink text-sm">
                  New Delivery Address
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-ink-secondary font-medium">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddr.line1}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, line1: e.target.value })
                      }
                      className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-ink-secondary font-medium">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddr.city}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, city: e.target.value })
                      }
                      className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-ink-secondary font-medium">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddr.state}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, state: e.target.value })
                      }
                      className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-ink-secondary font-medium">
                      PIN Code *
                    </label>
                    <input
                      type="text"
                      required
                      value={newAddr.pincode}
                      onChange={(e) =>
                        setNewAddr({ ...newAddr, pincode: e.target.value })
                      }
                      className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAddress(false)}
                    className="px-4 py-2 bg-surface-subtle border border-edge text-ink-secondary rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 btn-gold-luxury rounded-xl"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            )}

            {addresses.length === 0 ? (
              <div className="p-8 rounded-2xl luxury-card text-center text-xs text-ink-muted">
                No saved addresses yet. Add a delivery address for faster checkout.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-5 rounded-2xl luxury-card text-xs space-y-2 relative"
                  >
                    <div className="flex items-center justify-between">
                      {addr.is_default ? (
                        <span className="text-[10px] bg-gold-500/15 text-gold-400 font-bold px-2 py-0.5 rounded border border-gold-500/35">
                          Default
                        </span>
                      ) : (
                        <span className="text-[10px] text-ink-muted uppercase">
                          {addr.address_type}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="text-ink-muted hover:text-red-600 dark:hover:text-red-400 transition p-1"
                        title="Remove address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="font-semibold text-ink pt-1">{addr.line1}</p>
                    {addr.line2 && (
                      <p className="text-ink-secondary">{addr.line2}</p>
                    )}
                    <p className="text-ink-secondary">
                      {addr.city}, {addr.state} - {addr.pincode}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "profile" && (
          <div className="max-w-xl p-6 rounded-2xl luxury-card space-y-4 text-xs">
            <h3 className="font-heading font-bold text-base text-ink">
              Profile Details
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-ink-muted block">Full Name:</span>
                <span className="text-ink font-medium text-sm">
                  {user.full_name}
                </span>
              </div>
              {user.email && (
                <div>
                  <span className="text-ink-muted block">Email Address:</span>
                  <span className="text-ink font-medium text-sm">
                    {user.email}
                  </span>
                </div>
              )}
              <div>
                <span className="text-ink-muted block">Phone (WhatsApp):</span>
                <span className="text-ink font-medium text-sm">
                  {user.phone || "Not set"}
                </span>
              </div>
              <div>
                <span className="text-ink-muted block">Role:</span>
                <span className="text-gold-400 font-semibold uppercase">
                  {role || "user"}
                </span>
              </div>
            </div>
          </div>
        )}

        <AccountHubAddons orders={userOrders} />
      </div>
    </div>
  );
}
