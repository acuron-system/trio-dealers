"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Profile, UserRole, Shop, B2BAccount } from "@/types/database";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchExtendedProfile } from "@/lib/db";

export interface ExtendedProfile extends Profile {
  email?: string;
  is_approved?: boolean;
  shop_name?: string | null;
  gst_no?: string | null;
  credit_balance?: number;
  shop?: Shop;
  b2b_account?: B2BAccount;
}

interface AuthResult {
  error?: string;
  role?: UserRole;
  needsEmailConfirmation?: boolean;
  mfaRequired?: boolean;
}

interface AuthContextType {
  user: ExtendedProfile | null;
  role: UserRole | null;
  isLoading: boolean;
  isConfigured: boolean;
  signIn: (
    email: string,
    password: string,
    turnstileToken?: string | null,
    totpCode?: string | null
  ) => Promise<AuthResult>;
  signUp: (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    turnstileToken?: string | null;
  }) => Promise<AuthResult>;
  signUpShop: (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    shop_name: string;
    gstin?: string;
    gst_no?: string;
    pan?: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    turnstileToken?: string | null;
  }) => Promise<AuthResult>;
  signUpB2B: (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    business_name: string;
    gstin: string;
    pan?: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    turnstileToken?: string | null;
  }) => Promise<AuthResult>;
  sendPasswordReset: (
    email: string,
    turnstileToken?: string | null
  ) => Promise<{ error?: string; message?: string }>;
  updatePassword: (newPassword: string) => Promise<{ error?: string }>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutAllDevices: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DB_NOT_CONFIGURED_MSG =
  "Database connection is not configured. Please add your Supabase URL and keys in .env.local.";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ExtendedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const configured = isSupabaseConfigured();

  const supabase = createClient();

  const hydrateUser = useCallback(
    async (userId: string, email?: string): Promise<ExtendedProfile | null> => {
      const profile = await fetchExtendedProfile(supabase, userId, email);
      if (profile && !profile.is_active) {
        await supabase.auth.signOut();
        setUser(null);
        return null;
      }
      setUser(profile);
      return profile;
    },
    [supabase]
  );

  const refreshProfile = useCallback(async () => {
    if (!configured) return;
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    if (authUser) {
      await hydrateUser(authUser.id, authUser.email);
    } else {
      setUser(null);
    }
  }, [configured, supabase, hydrateUser]);

  useEffect(() => {
    // Clear any legacy local mock session flag
    if (typeof window !== "undefined") {
      localStorage.removeItem("trio_mock_role");
    }

    if (!configured) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    let mounted = true;

    async function initAuth() {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (!mounted) return;
        if (authUser) {
          await hydrateUser(authUser.id, authUser.email);
        } else {
          setUser(null);
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        await hydrateUser(session.user.id, session.user.email);
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [configured, supabase, hydrateUser]);

  const signIn = async (
    email: string,
    password: string,
    turnstileToken?: string | null,
    totpCode?: string | null
  ): Promise<AuthResult> => {
    if (!configured) {
      return { error: DB_NOT_CONFIGURED_MSG };
    }

    if (!email.trim() || !password) {
      return { error: "Please enter both your email address and password." };
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          turnstileToken: turnstileToken || undefined,
          totpCode: totpCode || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setIsLoading(false);
        return {
          error: payload?.error || "Invalid email or password.",
          mfaRequired: Boolean(payload?.mfaRequired),
        };
      }

      if (payload?.mfaRequired) {
        setIsLoading(false);
        return { mfaRequired: true, role: payload?.role };
      }

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        setIsLoading(false);
        return { error: "Session initialization failed. Please retry." };
      }

      const profile = await fetchExtendedProfile(supabase, authUser.id, authUser.email);
      if (!profile || !profile.is_active) {
        await supabase.auth.signOut();
        setUser(null);
        setIsLoading(false);
        return { error: "Unable to sign in with this account." };
      }

      setUser(profile);
      setIsLoading(false);
      return { role: profile.role };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Unable to sign in right now. Please try again." };
    }
  };

  const signUp = async (data: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    turnstileToken?: string | null;
  }): Promise<AuthResult> => {
    if (!configured) {
      return { error: DB_NOT_CONFIGURED_MSG };
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "user",
          email: data.email.trim().toLowerCase(),
          password: data.password,
          full_name: data.full_name.trim(),
          phone: data.phone?.trim() || undefined,
          turnstileToken: data.turnstileToken || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setIsLoading(false);
        return { error: payload?.error || "Failed to create account." };
      }

      if (!payload.needsEmailConfirmation) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          await hydrateUser(authUser.id, authUser.email);
        }
      }

      setIsLoading(false);
      return {
        role: payload.role || "user",
        needsEmailConfirmation: Boolean(payload.needsEmailConfirmation),
      };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Failed to create account." };
    }
  };

  const signUpShop = async (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    shop_name: string;
    gstin?: string;
    gst_no?: string;
    pan?: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    bank_name?: string;
    bank_account_no?: string;
    bank_ifsc?: string;
    turnstileToken?: string | null;
  }): Promise<AuthResult> => {
    if (!configured) {
      return { error: DB_NOT_CONFIGURED_MSG };
    }

    setIsLoading(true);
    try {
      const gstValue = data.gstin || data.gst_no || "";
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "shop",
          email: data.email.trim().toLowerCase(),
          password: data.password,
          full_name: data.full_name.trim(),
          phone: data.phone.trim(),
          shop_name: data.shop_name.trim(),
          gstin: gstValue.trim(),
          pan: data.pan?.trim() || "",
          address: data.address.trim(),
          city: data.city?.trim() || "Surat",
          state: data.state?.trim() || "Gujarat",
          pincode: data.pincode?.trim() || "395002",
          bank_name: data.bank_name?.trim() || "Pending",
          bank_account_no: data.bank_account_no?.trim() || "Pending",
          bank_ifsc: data.bank_ifsc?.trim() || "Pending",
          turnstileToken: data.turnstileToken || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setIsLoading(false);
        return { error: payload?.error || "Failed to register seller shop." };
      }

      if (!payload.needsEmailConfirmation) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          await hydrateUser(authUser.id, authUser.email);
        }
      }

      setIsLoading(false);
      return {
        role: "shop",
        needsEmailConfirmation: Boolean(payload.needsEmailConfirmation),
      };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Failed to register seller shop." };
    }
  };

  const signUpB2B = async (data: {
    email: string;
    password: string;
    full_name: string;
    phone: string;
    business_name: string;
    gstin: string;
    pan?: string;
    address: string;
    city?: string;
    state?: string;
    pincode?: string;
    turnstileToken?: string | null;
  }): Promise<AuthResult> => {
    if (!configured) {
      return { error: DB_NOT_CONFIGURED_MSG };
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountType: "b2b",
          email: data.email.trim().toLowerCase(),
          password: data.password,
          full_name: data.full_name.trim(),
          phone: data.phone.trim(),
          business_name: data.business_name.trim(),
          gstin: data.gstin.trim().toUpperCase(),
          pan: data.pan?.trim().toUpperCase() || "",
          address: data.address.trim(),
          city: data.city?.trim() || "Mumbai",
          state: data.state?.trim() || "Maharashtra",
          pincode: data.pincode?.trim() || "400001",
          turnstileToken: data.turnstileToken || undefined,
        }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setIsLoading(false);
        return { error: payload?.error || "Failed to register B2B trade account." };
      }

      if (!payload.needsEmailConfirmation) {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          await hydrateUser(authUser.id, authUser.email);
        }
      }

      setIsLoading(false);
      return {
        role: "b2b",
        needsEmailConfirmation: Boolean(payload.needsEmailConfirmation),
      };
    } catch (err: any) {
      setIsLoading(false);
      return { error: err?.message || "Failed to register B2B trade account." };
    }
  };

  const sendPasswordReset = async (
    email: string,
    turnstileToken?: string | null
  ): Promise<{ error?: string; message?: string }> => {
    if (!configured) return { error: DB_NOT_CONFIGURED_MSG };
    if (!email.trim()) return { error: "Please enter your account email address." };

    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          turnstileToken: turnstileToken || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) return { error: payload?.error || "Unable to send reset link." };
      return { message: payload?.message };
    } catch (err: any) {
      return { error: err?.message || "Failed to dispatch reset email." };
    }
  };

  const updatePassword = async (newPassword: string): Promise<{ error?: string }> => {
    if (!configured) return { error: DB_NOT_CONFIGURED_MSG };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: error.message };
    return {};
  };

  const signOut = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trio_mock_role");
    }
    setUser(null);
    if (!configured) return;
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore signOut errors
    }
  };

  const signOutAllDevices = async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("trio_mock_role");
    }
    setUser(null);
    if (!configured) return;
    try {
      await fetch("/api/auth/logout-all", { method: "POST" });
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role || null,
        isLoading,
        isConfigured: configured,
        signIn,
        signUp,
        signUpShop,
        signUpB2B,
        sendPasswordReset,
        updatePassword,
        refreshProfile,
        signOut,
        signOutAllDevices,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
