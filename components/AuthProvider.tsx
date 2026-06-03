"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { normalizeRole, type UserRole } from "@/lib/permissions";

type AppUser = {
  id: string;
  email: string;
  nombre: string;
  rol: UserRole;
};

type AuthContextValue = {
  loading: boolean;
  session: Session | null;
  user: AppUser | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);

  async function loadUser(nextSession: Session | null) {
    setSession(nextSession);

    if (!nextSession?.user.email) {
      setUser(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("usuarios")
      .select("id, email, nombre, rol, activo")
      .eq("email", nextSession.user.email)
      .maybeSingle();

    if (error || !data || data.activo === false) {
      setUser(null);
      setLoading(false);
      return;
    }

    setUser({
      id: data.id,
      email: data.email,
      nombre: data.nombre || data.email,
      rol: normalizeRole(data.rol),
    });
    setLoading(false);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      void loadUser(data.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        void loadUser(nextSession);
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoading(false);
      return error.message;
    }

    return null;
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  }

  async function refreshUser() {
    const { data } = await supabase.auth.getSession();
    await loadUser(data.session);
  }

  const value = {
    loading,
    session,
    user,
    signIn,
    signOut,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }

  return context;
}
