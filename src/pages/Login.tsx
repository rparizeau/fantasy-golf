import { useState } from "react";
import type { Theme } from "../theme";
import { useAuth } from "../context/AuthContext";

interface LoginProps {
  colors: Theme;
}

export function Login({ colors: C }: LoginProps) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const err = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, displayName);

    if (err) setError(err);
    setSubmitting(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 430 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <p style={{ fontSize: 32, fontWeight: 700, color: C.txt, margin: "0 0 4px" }}>Fantasy Golf</p>
          <p style={{ fontSize: 14, color: C.txt2, margin: 0 }}>{mode === "signin" ? "Sign in to your account" : "Create your account"}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "24px 20px", boxShadow: C.shadow }}>
          {mode === "signup" && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.txt2, marginBottom: 6 }}>Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                style={{
                  width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 8,
                  border: `1px solid ${C.border}`, background: C.card2, color: C.txt,
                  outline: "none", boxSizing: "border-box",
                }}
                placeholder="Your name"
              />
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.txt2, marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.card2, color: C.txt,
                outline: "none", boxSizing: "border-box",
              }}
              placeholder="you@example.com"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.txt2, marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              style={{
                width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.card2, color: C.txt,
                outline: "none", boxSizing: "border-box",
              }}
              placeholder="Min 6 characters"
            />
          </div>

          {error && (
            <div style={{ background: C.redDim, color: C.red, fontSize: 13, padding: "8px 12px", borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            style={{
              width: "100%", padding: "12px 0", fontSize: 15, fontWeight: 600,
              borderRadius: 10, border: "none", cursor: submitting ? "default" : "pointer",
              background: C.green, color: "#fff",
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? "..." : mode === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 14, color: C.txt2 }}>
          {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
          <span
            onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}
            style={{ color: C.green, fontWeight: 600, cursor: "pointer" }}
          >
            {mode === "signin" ? "Sign Up" : "Sign In"}
          </span>
        </p>
      </div>
    </div>
  );
}
