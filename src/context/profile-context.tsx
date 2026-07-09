"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import { canWrite, isAdmin, isSupplier, type UserRole } from "@/lib/permissions";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getSupabaseErrorMessage } from "@/lib/supabase/errors";

type ProfileState = {
  id: string;
  full_name: string | null;
  role: UserRole;
  supplier_id: string | null;
};

type ProfileContextValue = {
  profile: ProfileState | null;
  user: User | null;
  role: UserRole | "";
  supplierId: string | null;
  loading: boolean;
  canWrite: boolean;
  isAdmin: boolean;
  isSupplier: boolean;
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

async function loadProfileForUser(
  supabase: ReturnType<typeof createClient>,
  user: User
): Promise<ProfileState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role, supplier_id")
    .eq("id", user.id)
    .maybeSingle();

  if (data?.role) {
    return {
      id: data.id,
      full_name: data.full_name,
      role: data.role as UserRole,
      supplier_id: (data as { supplier_id?: string | null }).supplier_id ?? null,
    };
  }

  if (error) {
    console.warn("[profile] load failed:", error.message);
  }

  const { data: ensured, error: ensureError } = await supabase.rpc("ensure_my_profile");

  if (ensureError) {
    console.warn("[profile] ensure_my_profile failed:", ensureError.message);
    return {
      id: user.id,
      full_name: user.user_metadata?.full_name ?? user.email ?? null,
      role: "viewer",
      supplier_id: null,
    };
  }

  const row = ensured as { id: string; full_name: string | null; role: UserRole; supplier_id?: string | null } | null;
  if (row?.role) {
    return {
      id: row.id,
      full_name: row.full_name,
      role: row.role,
      supplier_id: row.supplier_id ?? null,
    };
  }

  return {
    id: user.id,
    full_name: user.user_metadata?.full_name ?? user.email ?? null,
    role: "viewer",
    supplier_id: null,
  };
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/login";
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      queueMicrotask(() => {
        setUser(null);
        setProfile(null);
        setLoading(false);
      });
      return;
    }

    const supabase = createClient();
    let mounted = true;

    async function applySession(session: Session | null) {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session.user);
      const nextProfile = await loadProfileForUser(supabase, session.user);
      if (!mounted) return;
      setProfile(nextProfile);
      setLoading(false);
    }

    void (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await applySession(session);
      } catch (sessionError) {
        console.warn("[profile] session failed:", getSupabaseErrorMessage(sessionError));
        await applySession(null);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void applySession(session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const role: UserRole | "" = profile?.role ?? "";

  useEffect(() => {
    if (loading || !isSupabaseConfigured()) return;

    if (!user && !isLogin) {
      router.replace("/login");
      return;
    }

    if (user && isLogin) {
      router.replace(isSupplier(role) ? "/supplier" : "/");
    }
  }, [loading, user, isLogin, router, role]);

  const refresh = async () => {
    if (!isSupabaseConfigured()) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = createClient();
    let session: Session | null = null;
    try {
      const result = await supabase.auth.getSession();
      session = result.data.session;
    } catch (sessionError) {
      console.warn("[profile] refresh failed:", getSupabaseErrorMessage(sessionError));
    }

    if (!session?.user) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    setUser(session.user);
    setProfile(await loadProfileForUser(supabase, session.user));
    setLoading(false);
  };

  const value = useMemo(
    () => ({
      profile,
      user,
      role,
      supplierId: profile?.supplier_id ?? null,
      loading,
      canWrite: canWrite(role),
      isAdmin: isAdmin(role),
      isSupplier: isSupplier(role),
      refresh,
    }),
    [profile, user, role, loading]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}
