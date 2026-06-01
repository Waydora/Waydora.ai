import { useEffect, useState, useCallback } from "react";
import { supabase, toUserProfile, type UserProfile } from "@/lib/supabase";
import { identify, reset, track } from "@/lib/analytics";
 
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ? toUserProfile(session.user) : null);
      setLoading(false);
      // Identity cross-channel (spec §4): SIGNED_IN → identify(user_id) con merge
      // automatico dell'anon id; SIGNED_OUT → reset(). Niente PII nelle props.
      if (event === "SIGNED_IN" && session?.user) {
        identify(session.user.id, {
          auth_method: session.user.app_metadata?.provider ?? "email",
        });
      } else if (event === "SIGNED_OUT") {
        reset();
      }
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
    else track("login", { method: "google" });
  }, []);
 
  // ── Login con email/password ──
  const loginWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    track("login", { method: "email" });
  }, []);
 
  // ── Registrazione con email/password ──
  const signupWithEmail = useCallback(async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) throw new Error(error.message);
    track("signup", { method: "email" });
  }, []);
 
  // ── Logout ──
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);
 
  return { user, loading, loginWithGoogle, loginWithEmail, signupWithEmail, logout };
}
 