import { useEffect, useState, useCallback } from "react";
import { supabase, toUserProfile, type UserProfile } from "@/lib/supabase";
 
// ── Hook principale autenticazione ────────────────────────────────────────
export function useAuth() {
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
 
  useEffect(() => {
    // Recupera sessione attuale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ? toUserProfile(session.user) : null);
      setLoading(false);
    });
 
    // Ascolta cambi di stato auth (login, logout, refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toUserProfile(session.user) : null);
      setLoading(false);
    });
 
    return () => subscription.unsubscribe();
  }, []);
 
  // ── Login con Google ──
  const loginWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) console.error("Errore login Google:", error.message);
  }, []);
 
  // ── Login con email/password ──
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);
 
  // ── Registrazione con email/password ──
  const signupWithEmail = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
  }, []);
 
  // ── Logout ──
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);
 
  return { user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout };
}
 