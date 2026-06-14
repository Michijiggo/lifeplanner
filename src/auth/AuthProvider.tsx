import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

// Aus dem 4-stelligen PIN wird ein gültiges Supabase-Passwort abgeleitet.
// (Supabase verlangt mind. 6 Zeichen – wir erweitern den PIN deterministisch.)
function pinToPassword(pin: string): string {
  return `ekp::${pin}`;
}

const LAST_EMAIL_KEY = "ekp.lastEmail";

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  lastEmail: string | null;
  register: (email: string, pin: string) => Promise<void>;
  login: (email: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastEmail, setLastEmail] = useState<string | null>(
    () => localStorage.getItem(LAST_EMAIL_KEY)
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function rememberEmail(email: string) {
    localStorage.setItem(LAST_EMAIL_KEY, email);
    setLastEmail(email);
  }

  async function register(email: string, pin: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password: pinToPassword(pin),
    });
    if (error) throw error;
    rememberEmail(cleanEmail);
    // Falls E-Mail-Bestätigung deaktiviert ist, gibt es direkt eine Session.
    // Andernfalls melden wir uns gleich an (erfordert deaktivierte Bestätigung).
    await login(cleanEmail, pin);
  }

  async function login(email: string, pin: string) {
    const cleanEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: pinToPassword(pin),
    });
    if (error) throw error;
    rememberEmail(cleanEmail);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, lastEmail, register, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
