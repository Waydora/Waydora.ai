import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/auth";
 
// ── Icona Google SVG ──────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}
 
// ── Input stilizzato ──────────────────────────────────────────────────────
function AuthInput({
  type, placeholder, value, onChange, icon: Icon, rightIcon, onRightClick,
}: {
  type: string; placeholder: string; value: string;
  onChange: (v: string) => void; icon: any;
  rightIcon?: any; onRightClick?: () => void;
}) {
  return (
    <div style={{ position: "relative" }}>
      <div style={{
        position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
        color: "rgba(255,255,255,0.35)", pointerEvents: "none",
      }}>
        <Icon style={{ width: "16px", height: "16px" }} />
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "12px 14px 12px 42px",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "12px", color: "#fff", fontSize: "14px",
          outline: "none", caretColor: "#fff",
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.3)")}
        onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
      />
      {rightIcon && (
        <button
          type="button"
          onClick={onRightClick}
          style={{
            position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.35)", padding: 0,
          }}
        >
          {rightIcon}
        </button>
      )}
    </div>
  );
}
 
// ── Modal principale ──────────────────────────────────────────────────────
interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}
 
export function AuthModal({ open, onClose }: AuthModalProps) {
  const [mode,       setMode]       = useState<"login" | "signup">("login");
  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [name,       setName]       = useState("");
  const [showPwd,    setShowPwd]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [pending,    setPending]    = useState(false);
  const [emailSent,  setEmailSent]  = useState(false);
 
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
 
  const reset = () => { setEmail(""); setPassword(""); setName(""); setError(null); setEmailSent(false); };
 
  const handleGoogle = async () => {
    setPending(true);
    setError(null);
    await loginWithGoogle();
    setPending(false);
  };
 
  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError("Compila tutti i campi"); return; }
    if (mode === "signup" && !name) { setError("Inserisci il tuo nome"); return; }
    setPending(true);
    setError(null);
    try {
      if (mode === "login") {
        await loginWithEmail(email, password);
        onClose();
      } else {
        await signupWithEmail(email, password, name);
        setEmailSent(true);
      }
    } catch (err: any) {
      const msg = err.message || "Qualcosa è andato storto";
      if (msg.includes("Invalid login")) setError("Email o password errati");
      else if (msg.includes("already registered")) setError("Email già registrata — prova ad accedere");
      else setError(msg);
    } finally {
      setPending(false);
    }
  };
 
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: "fixed", inset: 0, zIndex: 100,
              background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
            }}
          />
 
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{
              position: "fixed", inset: 0, zIndex: 101,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "16px",
            }}
          >
            <div style={{
              width: "100%", maxWidth: "400px",
              background: "rgba(16,10,28,0.97)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "24px", padding: "32px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              position: "relative",
            }}>
 
              {/* Close */}
              <button
                onClick={onClose}
                style={{
                  position: "absolute", top: "16px", right: "16px",
                  background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "50%", width: "32px", height: "32px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "rgba(255,255,255,0.6)",
                }}
              >
                <X style={{ width: "15px", height: "15px" }} />
              </button>
 
              {/* Logo + titolo */}
              <div style={{ textAlign: "center", marginBottom: "28px" }}>
                <div style={{
                  fontSize: "1.6rem", fontWeight: 900, color: "#fff",
                  letterSpacing: "-0.03em", marginBottom: "6px",
                }}>
                  waydora.
                </div>
                <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.45)" }}>
                  {mode === "login" ? "Bentornato 👋" : "Crea il tuo account"}
                </p>
              </div>
 
              {/* Email inviata */}
              {emailSent ? (
                <div style={{ textAlign: "center", padding: "20px 0" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>📬</div>
                  <p style={{ color: "#fff", fontWeight: 700, fontSize: "15px", marginBottom: "8px" }}>
                    Controlla la tua email
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px", lineHeight: 1.6 }}>
                    Ti abbiamo inviato un link di conferma a <strong style={{ color: "rgba(255,255,255,0.8)" }}>{email}</strong>
                  </p>
                  <button
                    onClick={() => { setMode("login"); reset(); }}
                    style={{
                      marginTop: "20px", background: "rgba(255,255,255,0.09)",
                      border: "1px solid rgba(255,255,255,0.15)", borderRadius: "10px",
                      padding: "10px 20px", color: "#fff", fontSize: "13px",
                      fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    Vai al login
                  </button>
                </div>
              ) : (
                <>
                  {/* Google */}
                  <button
                    onClick={handleGoogle}
                    disabled={pending}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                      gap: "10px", padding: "12px", borderRadius: "12px",
                      background: "#fff", border: "none", cursor: "pointer",
                      color: "#1a1a1a", fontWeight: 700, fontSize: "14px",
                      marginBottom: "20px", transition: "opacity 0.15s",
                      opacity: pending ? 0.7 : 1,
                      boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
                    }}
                  >
                    <GoogleIcon />
                    Continua con Google
                  </button>
 
                  {/* Divider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
                    <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", fontWeight: 600 }}>oppure</span>
                    <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.1)" }} />
                  </div>
 
                  {/* Form email */}
                  <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {mode === "signup" && (
                      <AuthInput type="text" placeholder="Il tuo nome" value={name} onChange={setName} icon={User} />
                    )}
                    <AuthInput type="email" placeholder="Email" value={email} onChange={setEmail} icon={Mail} />
                    <AuthInput
                      type={showPwd ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={setPassword}
                      icon={Lock}
                      rightIcon={showPwd
                        ? <EyeOff style={{ width: "15px", height: "15px" }} />
                        : <Eye style={{ width: "15px", height: "15px" }} />}
                      onRightClick={() => setShowPwd(!showPwd)}
                    />
 
                    {error && (
                      <p style={{ fontSize: "12px", color: "#f87171", textAlign: "center", margin: "0" }}>
                        {error}
                      </p>
                    )}
 
                    <button
                      type="submit"
                      disabled={pending}
                      style={{
                        width: "100%", padding: "13px",
                        background: "linear-gradient(135deg,#f97316,#a855f7)",
                        border: "none", borderRadius: "12px",
                        color: "#fff", fontWeight: 700, fontSize: "14px",
                        cursor: pending ? "not-allowed" : "pointer",
                        opacity: pending ? 0.7 : 1,
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        marginTop: "4px",
                        boxShadow: "0 4px 20px rgba(249,115,22,0.3)",
                      }}
                    >
                      {pending && <Loader2 style={{ width: "16px", height: "16px", animation: "spin 0.8s linear infinite" }} />}
                      {mode === "login" ? "Accedi" : "Crea account"}
                    </button>
                  </form>
 
                  {/* Switch mode */}
                  <p style={{ textAlign: "center", fontSize: "13px", color: "rgba(255,255,255,0.4)", marginTop: "20px" }}>
                    {mode === "login" ? "Non hai un account? " : "Hai già un account? "}
                    <button
                      onClick={() => { setMode(mode === "login" ? "signup" : "login"); reset(); }}
                      style={{
                        background: "none", border: "none", cursor: "pointer",
                        color: "rgba(255,255,255,0.8)", fontWeight: 700, fontSize: "13px",
                        textDecoration: "underline", padding: 0,
                      }}
                    >
                      {mode === "login" ? "Registrati" : "Accedi"}
                    </button>
                  </p>
                </>
              )}
 
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
 