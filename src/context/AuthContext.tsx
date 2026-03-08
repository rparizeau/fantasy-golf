import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface ManagerProfile {
  id: number;
  displayName: string;
  email: string;
  isAdmin: boolean;
  teams: { pk: number; leagueId: number; teamId: number; teamName: string }[];
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  manager: ManagerProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, displayName: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshManager: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

async function fetchManager(token: string): Promise<ManagerProfile | null> {
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [manager, setManager] = useState<ManagerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        fetchManager(s.access_token).then((m) => {
          setManager(m);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.access_token) {
        fetchManager(s.access_token).then(setManager);
      } else {
        setManager(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string, displayName: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;

    const token = data.session?.access_token;
    if (!token) return "Signup succeeded but no session returned — check your email to confirm.";

    // Create manager record in our DB
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName, email }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return body.error || "Failed to create manager profile";
    }

    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setManager(null);
  };

  const refreshManager = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    if (s?.access_token) {
      const m = await fetchManager(s.access_token);
      if (m) setManager(m);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, manager, loading, signIn, signUp, signOut, refreshManager }}>
      {children}
    </AuthContext.Provider>
  );
}
