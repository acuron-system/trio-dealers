"use client";

import React, { useState, useEffect } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Profile, UserRole } from "@/types/database";
import {
  Shield,
  Store,
  Truck,
  User,
  Plus,
  X,
  Building2,
  AlertCircle,
} from "lucide-react";

export default function AdminUsersPage() {
  const [userList, setUserList] = useState<
    Array<Profile & { disabled?: boolean }>
  >([]);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isTransporterModalOpen, setIsTransporterModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [newTransporter, setNewTransporter] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
  });

  useEffect(() => {
    async function loadUsers() {
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json();
        if (res.ok && data.users) {
          setUserList(data.users);
        } else if (data.error) {
          setErrorMsg(data.error);
        }
      } catch {
        setErrorMsg("Failed to fetch users from database.");
      } finally {
        setLoading(false);
      }
    }
    loadUsers();
  }, []);

  const filteredUsers = userList.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    return true;
  });

  const toggleDisableUser = async (id: string, currentlyDisabled?: boolean) => {
    setErrorMsg(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: Boolean(currentlyDisabled) }),
    });

    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Unable to update user status.");
      return;
    }

    setUserList((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              is_active: !currentlyDisabled,
              disabled: !currentlyDisabled,
            }
          : u
      )
    );
  };

  const handleCreateTransporter = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCreating(true);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: newTransporter.fullName,
        email: newTransporter.email,
        password: newTransporter.password,
        phone: newTransporter.phone,
        role: "transporter",
      }),
    });

    const data = await res.json();
    setCreating(false);

    if (!res.ok || !data.user) {
      setErrorMsg(data.error || "Failed to create transporter account.");
      return;
    }

    setUserList([data.user, ...userList]);
    setIsTransporterModalOpen(false);
    setNewTransporter({ fullName: "", email: "", password: "", phone: "" });
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "admin":
        return <Shield className="w-3.5 h-3.5 text-gold-400" />;
      case "shop":
        return <Store className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />;
      case "b2b":
        return (
          <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        );
      case "transporter":
        return (
          <Truck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        );
      default:
        return <User className="w-3.5 h-3.5 text-ink-secondary" />;
    }
  };

  return (
    <div className="bg-canvas min-h-screen space-y-8 pb-16">
      <AdminNav />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-ink">
              User & Transporter Management
            </h1>
            <p className="text-xs text-ink-secondary mt-1">
              Admin control over user accounts. Transporters are created here by administrator only.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTransporterModalOpen(true)}
            className="px-4 py-2.5 rounded-xl btn-gold-luxury text-xs uppercase tracking-wider flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Create Transporter Account
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/35 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex items-center gap-3 luxury-card p-4 rounded-2xl text-xs">
          <span className="text-ink-muted">Filter Role:</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-surface-input border border-edge text-ink rounded-xl px-3 py-2"
          >
            <option value="all">All Roles</option>
            <option value="admin">Admins</option>
            <option value="shop">Seller Shops</option>
            <option value="b2b">B2B Buyers</option>
            <option value="transporter">Transporters</option>
            <option value="user">Retail Users</option>
          </select>
        </div>

        <div className="luxury-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-subtle border-b border-edge text-ink-secondary uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">User</th>
                  <th className="py-3.5 px-4 font-semibold">Role</th>
                  <th className="py-3.5 px-4 font-semibold">Contact Phone</th>
                  <th className="py-3.5 px-4 font-semibold">Shop / Business</th>
                  <th className="py-3.5 px-4 font-semibold">Account State</th>
                  <th className="py-3.5 px-4 font-semibold text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge text-ink-secondary">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted">
                      Loading platform accounts...
                    </td>
                  </tr>
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-ink-muted">
                      No accounts matching filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className="hover:bg-surface-subtle/50 transition"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-ink">{u.full_name}</p>
                        {u.email && (
                          <p className="text-[11px] text-ink-muted">{u.email}</p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-subtle border border-edge text-[11px] capitalize font-medium text-ink">
                          {getRoleIcon(u.role)}
                          {u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-ink-secondary">
                        {u.phone || (
                          <span className="text-ink-muted">Not provided</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-ink-secondary">
                        {u.shop_name || "—"}
                      </td>

                      <td className="py-3.5 px-4">
                        {u.disabled ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold text-[10px] uppercase">
                            Disabled
                          </span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400 font-semibold text-[10px] uppercase">
                            Active
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {u.role !== "admin" && (
                          <button
                            type="button"
                            onClick={() => toggleDisableUser(u.id, u.disabled)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition ${
                              u.disabled
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/25"
                                : "bg-surface-subtle border border-edge text-ink-secondary hover:text-red-600 dark:hover:text-red-400"
                            }`}
                          >
                            {u.disabled ? "Enable" : "Disable"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isTransporterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="luxury-card-elevated border border-gold-500/35 rounded-3xl max-w-md w-full p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-edge">
              <h3 className="font-heading font-bold text-base text-ink flex items-center gap-2">
                <Truck className="w-4 h-4 text-gold-400" />
                Register Transporter Partner
              </h3>
              <button
                type="button"
                onClick={() => setIsTransporterModalOpen(false)}
                className="text-ink-muted hover:text-ink"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTransporter} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">
                  Logistics Agency / Driver Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTransporter.fullName}
                  onChange={(e) =>
                    setNewTransporter({
                      ...newTransporter,
                      fullName: e.target.value,
                    })
                  }
                  placeholder="e.g. Navkar Cargo Express"
                  className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">
                  Login Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newTransporter.email}
                  onChange={(e) =>
                    setNewTransporter({
                      ...newTransporter,
                      email: e.target.value,
                    })
                  }
                  placeholder="driver@logistics.com"
                  className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newTransporter.password}
                  onChange={(e) =>
                    setNewTransporter({
                      ...newTransporter,
                      password: e.target.value,
                    })
                  }
                  placeholder="Minimum 6 characters"
                  className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-ink-secondary font-medium">
                  Phone Number (WhatsApp) *
                </label>
                <input
                  type="tel"
                  required
                  value={newTransporter.phone}
                  onChange={(e) =>
                    setNewTransporter({
                      ...newTransporter,
                      phone: e.target.value,
                    })
                  }
                  placeholder="+91 98765 00003"
                  className="w-full bg-surface-input border border-edge rounded-xl px-3 py-2 text-ink focus:outline-none focus:border-gold-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsTransporterModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-subtle border border-edge text-ink-secondary font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 rounded-xl btn-gold-luxury uppercase tracking-wider disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Transporter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
