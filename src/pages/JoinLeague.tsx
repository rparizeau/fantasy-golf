import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getInvitePreview, joinLeague, type InvitePreview } from "../api";
import { themes } from "../theme";

export function JoinLeague() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { manager, loading: authLoading, refreshManager } = useAuth();
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const C = isDark ? themes.dark : themes.light;

  useEffect(() => {
    if (authLoading) return;
    if (!manager) {
      sessionStorage.setItem("pendingInvite", code || "");
      navigate("/");
      return;
    }
    if (code) {
      getInvitePreview(code)
        .then(setPreview)
        .catch(() => setLoadError("Invalid or expired invite code"));
    }
  }, [code, manager, authLoading, navigate]);

  const handleJoin = async () => {
    if (!code) return;
    setJoining(true);
    setError(null);
    try {
      await joinLeague(code, teamName.trim() || undefined);
      await refreshManager();
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to join league");
    } finally {
      setJoining(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: C.txt2, fontSize: 14 }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ background: C.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", padding: "60px 16px" }}>
      {loadError ? (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.red, fontSize: 16, fontWeight: 600 }}>{loadError}</p>
          <button onClick={() => navigate("/")} style={{ marginTop: 16, background: C.card2, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 20px", color: C.txt, fontSize: 14, cursor: "pointer" }}>
            Go Home
          </button>
        </div>
      ) : preview ? (
        <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, padding: "24px 20px" }}>
          <p style={{ color: C.txt, fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Join League</p>
          <p style={{ color: C.txt2, fontSize: 13, margin: "0 0 24px" }}>You've been invited to join a league</p>

          <div style={{ background: C.card2, borderRadius: 10, padding: "14px 16px", marginBottom: 20 }}>
            <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: "0 0 4px" }}>{preview.name}</p>
            <p style={{ color: C.txt2, fontSize: 12, margin: 0 }}>Created by {preview.creatorName} &middot; {preview.members}/{preview.maxMembers} members</p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <p style={{ color: C.txt2, fontSize: 12, fontWeight: 600, margin: "0 0 6px" }}>Team Name (optional)</p>
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Eagle Eyes"
              style={{
                width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8,
                border: `1px solid ${C.border}`, background: C.card2, color: C.txt, fontSize: 15, outline: "none",
              }}
            />
          </div>

          {error && <p style={{ color: C.red, fontSize: 13, margin: "0 0 12px" }}>{error}</p>}

          <button
            onClick={handleJoin}
            disabled={joining}
            style={{
              width: "100%", padding: "14px", borderRadius: 10, border: "none",
              background: joining ? C.border : C.green,
              color: joining ? C.txt3 : "#fff",
              fontSize: 15, fontWeight: 700, cursor: joining ? "default" : "pointer",
            }}
          >
            {joining ? "Joining..." : "Join League"}
          </button>
        </div>
      ) : (
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.txt2, fontSize: 14 }}>Loading invite...</p>
        </div>
      )}
    </div>
  );
}
