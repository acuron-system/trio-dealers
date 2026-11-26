"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchOrdersWithDetails } from "@/lib/db";
import { useAuth } from "@/context/auth-context";
import { Order, OrderStatus, Profile } from "@/types/database";
import { formatINR, getOrderStatusBadge } from "@/lib/utils";
import { Truck, ExternalLink, X, FileCheck } from "lucide-react";

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [transporters, setTransporters] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    async function loadOrdersData() {
      if (!isSupabaseConfigured()) {
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const [ords, transRes] = await Promise.all([
        fetchOrdersWithDetails(supabase),
        supabase
          .from("profiles")
          .select("*")
          .eq("role", "transporter")
          .eq("is_active", true),
      ]);
      setOrders(ords);
      setTransporters((transRes.data as Profile[]) || []);
      setLoading(false);
    }
    loadOrdersData();
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (
      statusFilter !== "all" &&
      o.status.toLowerCase() !== statusFilter.toLowerCase()
    )
      return false;
    if (typeFilter !== "all" && o.order_type !== typeFilter) return false;
    return true;
  });

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    const dbStatusMap: Record<string, string> = {
      Placed: "placed",
      Confirmed: "confirmed",
      Packed: "processing",
      "Assigned to Transporter": "processing",
      "Out for Delivery": "shipped",
      Delivered: "delivered",
      Cancelled: "cancelled",
    };
    const mappedDbStatus = dbStatusMap[newStatus] || newStatus.toLowerCase();

    const supabase = createClient();
    const { error } = await supabase
      .from("orders")
      .update({
        status: mappedDbStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (error) return;

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updated = { ...o, status: mappedDbStatus as OrderStatus };
          if (selectedOrder?.id === orderId) setSelectedOrder(updated);
          return updated;
        }
        return o;
      })
    );
  };

  const handleAssignTransporter = async (
    orderId: string,
    transporterId: string
  ) => {
    if (!transporterId) return;
    const supabase = createClient();
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const subOrders = order.sub_orders || [];
    for (const sub of subOrders) {
      await supabase
        .from("sub_orders")
        .update({
          transporter_id: transporterId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sub.id);

      const pickupOtp = String(Math.floor(1000 + Math.random() * 9000));
      const deliveryOtp = String(Math.floor(1000 + Math.random() * 9000));
      const codDue = order.payment_method === "cod" ? Number(sub.total) : 0;

      await supabase.from("deliveries").insert([
        {
          sub_order_id: sub.id,
          transporter_id: transporterId,
          leg: "pickup",
          status: "assigned",
          otp_code: pickupOtp,
          cod_amount: 0,
          cod_collected: false,
        },
        {
          sub_order_id: sub.id,
          transporter_id: transporterId,
          leg: "delivery",
          status: "assigned",
          otp_code: deliveryOtp,
          cod_amount: codDue,
          cod_collected: false,
        },
      ]);

      await supabase.from("order_status_history").insert({
        sub_order_id: sub.id,
        status: "ready_for_pickup",
        note: "Transporter assigned by Admin",
        changed_by: user?.id || null,
      });
    }

    await supabase
      .from("orders")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const updated: Order = {
            ...o,
            transporter_id: transporterId,
            status: "processing",
            sub_orders: (o.sub_orders || []).map((s) => ({
              ...s,
              transporter_id: transporterId,
            })),
          };
          if (selectedOrder?.id === orderId) setSelectedOrder(updated);
          return updated;
        }
        return o;
      })
    );
  };

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
            Order Fulfillment & Dispatch Hub
          </h1>
          <p className="text-xs text-ink-secondary mt-1">
            Track consignments, verify payment proofs, advance workflow statuses, and assign transporters.
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-4 luxury-card p-4 rounded-2xl text-xs">
          <div className="flex items-center gap-3">
            <span className="text-ink-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-input border border-edge text-ink rounded-xl px-3 py-2"
            >
              <option value="all">All Statuses</option>
              <option value="Placed">Placed</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Packed">Packed</option>
              <option value="Assigned to Transporter">
                Assigned to Transporter
              </option>
              <option value="Out for Delivery">Out for Delivery</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-ink-muted">Order Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-surface-input border border-edge text-ink rounded-xl px-3 py-2"
            >
              <option value="all">Retail & Wholesale</option>
              <option value="retail">Retail Only</option>
              <option value="wholesale">Wholesale B2B Only</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="luxury-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-edge text-ink-secondary uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Order No</th>
                  <th className="py-3.5 px-4 font-semibold">Customer / Shop</th>
                  <th className="py-3.5 px-4 font-semibold">Type</th>
                  <th className="py-3.5 px-4 font-semibold">Total Amount</th>
                  <th className="py-3.5 px-4 font-semibold">Payment</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold">Transporter</th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-ink-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-muted">
                      Loading orders...
                    </td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-ink-muted">
                      No orders found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((ord) => {
                    const badgeClass = getOrderStatusBadge(ord.status);
                    const assignedTransporterId =
                      ord.transporter_id || ord.sub_orders?.[0]?.transporter_id;
                    const assignedTransporter = transporters.find(
                      (t) => t.id === assignedTransporterId
                    );

                    return (
                      <tr
                        key={ord.id}
                        className="hover:bg-surface-subtle/50 transition"
                      >
                        <td className="py-3.5 px-4 font-mono font-bold text-ink">
                          {ord.order_no}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-ink">
                            {ord.address_snapshot.name}
                          </p>
                          <p className="text-[11px] text-ink-muted">
                            {ord.address_snapshot.city},{" "}
                            {ord.address_snapshot.state}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                              ord.order_type === "b2b" ||
                              ord.order_type === "wholesale"
                                ? "bg-gold-500/15 text-gold-400 border border-gold-500/35"
                                : "bg-surface-subtle text-ink-secondary border border-edge"
                            }`}
                          >
                            {ord.order_type}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-ink">
                          {formatINR(ord.total_amount || ord.total || 0)}
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="capitalize text-ink">
                            {ord.payment_method.replace(/_/g, " ")}
                          </p>
                          <span
                            className={`text-[10px] font-semibold ${
                              ord.payment_status === "paid"
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-700 dark:text-amber-400"
                            }`}
                          >
                            {ord.payment_status}
                          </span>
                          {ord.payment_proof_url && (
                            <span className="block text-[10px] text-gold-400">
                              Proof attached
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${badgeClass}`}
                          >
                            {ord.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          {assignedTransporter ? (
                            <span className="text-ink text-xs flex items-center gap-1 font-medium">
                              <Truck className="w-3.5 h-3.5 text-gold-400" />
                              {assignedTransporter.full_name}
                            </span>
                          ) : (
                            <span className="text-ink-muted italic">
                              Unassigned
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(ord)}
                            className="px-3 py-1.5 rounded-lg bg-surface-subtle border border-edge hover:bg-gold-500 hover:text-black text-ink font-semibold text-xs transition"
                          >
                            View & Update
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <div>
                <h3 className="font-heading font-bold text-lg text-ink">
                  Order Management: {selectedOrder.order_no}
                </h3>
                <p className="text-xs text-ink-secondary">
                  Customer: {selectedOrder.address_snapshot.name} (
                  {selectedOrder.address_snapshot.phone})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-gold-500/25 space-y-3">
              <span className="text-xs font-bold text-gold-400 uppercase tracking-wider block">
                Advance Order Status
              </span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Placed",
                    "Confirmed",
                    "Packed",
                    "Assigned to Transporter",
                    "Out for Delivery",
                    "Delivered",
                    "Cancelled",
                  ] as OrderStatus[]
                ).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                      selectedOrder.status === s
                        ? "bg-gold-500 text-black font-bold shadow-gold"
                        : "bg-surface border border-edge text-ink-secondary hover:text-ink"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-2">
              <span className="text-xs font-bold text-ink uppercase tracking-wider block">
                Assign Logistics Transporter
              </span>
              <div className="flex gap-3">
                <select
                  value={selectedOrder.transporter_id || ""}
                  onChange={(e) =>
                    handleAssignTransporter(selectedOrder.id, e.target.value)
                  }
                  className="flex-1 bg-surface-input border border-edge rounded-xl px-3 py-2 text-xs text-ink"
                >
                  <option value="">Select Transporter Partner...</option>
                  {transporters.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.full_name} ({t.phone})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedOrder.payment_proof_url && (
              <div className="p-4 rounded-2xl bg-surface-subtle border border-edge space-y-2">
                <span className="text-xs font-bold text-gold-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4" />
                  Customer Payment Proof (Screenshot)
                </span>
                <div className="relative w-full h-48 rounded-xl overflow-hidden border border-edge">
                  <Image
                    src={selectedOrder.payment_proof_url}
                    alt="Payment proof screenshot"
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-bold text-ink-secondary uppercase tracking-wider block">
                Items (
                {
                  (
                    selectedOrder.sub_orders?.flatMap((s) => s.items || []) ||
                    selectedOrder.items ||
                    []
                  ).length
                }
                )
              </span>
              <div className="space-y-2">
                {(
                  selectedOrder.sub_orders?.flatMap((s) => s.items || []) ||
                  selectedOrder.items ||
                  []
                ).map((it: any) => (
                  <div
                    key={it.id}
                    className="p-3 rounded-xl bg-surface-subtle text-xs flex justify-between"
                  >
                    <div>
                      <p className="font-semibold text-ink">
                        {it.product_name}
                      </p>
                      <p className="text-ink-muted">{it.variant_info}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-ink">
                        {formatINR(
                          it.line_total ||
                            it.total ||
                            (it.unit_price || it.price || 0) * it.quantity
                        )}
                      </p>
                      <p className="text-ink-muted">Qty: {it.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-edge text-xs">
              <Link
                href={`/orders/${selectedOrder.order_no}`}
                target="_blank"
                className="text-gold-400 hover:underline flex items-center gap-1"
              >
                View Public Customer Tracking Page{" "}
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
