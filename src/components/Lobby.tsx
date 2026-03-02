import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { LeagueSummary } from "../api";
import { getLeagues } from "../api";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

interface LobbyProps {
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onEnterLeague: (id: number, name: string, myTeamId: number) => void;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000).toLocaleString()}K`;
  return `$${n.toLocaleString()}`;
}

function formatPurse(n: number): string {
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${n.toLocaleString()}`;
}

export function Lobby({ isDark, colors: C, onToggleTheme, onEnterLeague }: LobbyProps) {
  const { manager, signOut } = useAuth();
  const [leagues, setLeagues] = useState<LeagueSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeagues()
      .then(setLeagues)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "0 16px" }}>
      {/* SECTION HEADER */}
      <div style={{ paddingBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
          <p style={{ color: C.txt2, fontSize: 14, margin: 0 }}>Welcome back,</p>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              onClick={signOut}
              style={{ color: C.txt3, fontSize: 12, cursor: "pointer", fontWeight: 500 }}
            >
              Sign Out
            </span>
            <ThemeToggle isDark={isDark} colors={C} onToggle={onToggleTheme} />
          </div>
        </div>
        <p style={{ color: C.txt, fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>{manager?.displayName ?? "Manager"}</p>
      </div>

      {/* SECTION BODY */}
      <p style={{ color: C.txt2, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 12px" }}>
        Your Leagues
      </p>

      {/* League Cards */}
      {loading
        ? [0, 1].map((i) => <SkeletonCard key={i} colors={C} />)
        : leagues.map((l) => (
            <LeagueCard key={l.id} league={l} isDark={isDark} colors={C} onTap={() => onEnterLeague(l.id, l.name, l.myTeamId)} />
          ))}

      {/* Create a League */}
      <div
        style={{
          background: C.card,
          borderRadius: 14,
          border: `2px dashed ${C.border}`,
          padding: "24px 20px",
          textAlign: "center",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            margin: "0 auto 10px",
            background: C.card2,
            border: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            color: C.txt3,
          }}
        >
          +
        </div>
        <p style={{ color: C.txt, fontSize: 15, fontWeight: 600, margin: "0 0 3px" }}>Create a League</p>
        <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>Set up a new league and invite your friends</p>
      </div>
    </div>
  );
}

function SkeletonCard({ colors: C }: { colors: Theme }) {
  const bar = (w: number | string, h = 14) => ({
    width: w,
    height: h,
    borderRadius: 6,
    background: C.border,
    animation: "pulse 2s infinite",
  });

  return (
    <div
      style={{
        background: C.card,
        borderRadius: 14,
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div style={bar(100, 10)} />
        <div style={{ ...bar(160, 18), marginTop: 8 }} />
        <div style={{ ...bar(180, 10), marginTop: 10 }} />
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
        <div style={{ flex: 1, padding: "10px 16px" }}>
          <div style={bar(50, 10)} />
          <div style={{ ...bar(70, 14), marginTop: 4 }} />
        </div>
        <div style={{ flex: 1, padding: "10px 16px" }}>
          <div style={bar(60, 10)} />
          <div style={{ ...bar(70, 14), marginTop: 4 }} />
        </div>
      </div>
    </div>
  );
}

function LeagueCard({
  league: l,
  isDark: dk,
  colors: C,
  onTap,
}: {
  league: LeagueSummary;
  isDark: boolean;
  colors: Theme;
  onTap: () => void;
}) {
  return (
    <div
      onClick={onTap}
      style={{
        background: C.card,
        borderRadius: 14,
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        cursor: "pointer",
        boxShadow: C.shadow,
        overflow: "hidden",
        transition: "transform .1s",
      }}
    >
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <div>
            <p style={{ color: C.txt3, fontSize: 11, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.6 }}>{l.name}</p>
            <p style={{ color: C.txt, fontSize: 18, fontWeight: 700, margin: 0 }}>{l.team}</p>
          </div>
          <span
            style={{
              padding: "3px 10px",
              borderRadius: 10,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              color: l.rank <= 1 ? C.gold : C.greenBright,
              background: l.rank <= 1 ? (dk ? C.goldDim : `${C.gold}15`) : C.greenDim,
            }}
          >
            #{l.rank} of {l.of}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          {l.status === "live" && (
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: C.greenBright,
                boxShadow: `0 0 6px ${C.green}`,
                animation: "pulse 2s infinite",
                flexShrink: 0,
              }}
            />
          )}
          <p style={{ color: C.txt2, fontSize: 12, margin: 0 }}>
            {l.tournament} • {formatPurse(l.purse)}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
        <div style={{ flex: 1, padding: "10px 16px", borderRight: `1px solid ${C.border}` }}>
          <p style={{ color: C.txt3, fontSize: 10, margin: "0 0 1px", textTransform: "uppercase" }}>Season</p>
          <p style={{ color: C.txt, fontSize: 14, fontWeight: 700, margin: 0 }}>{formatMoney(l.money)}</p>
        </div>
        <div style={{ flex: 1, padding: "10px 16px", borderRight: `1px solid ${C.border}` }}>
          <p style={{ color: C.txt3, fontSize: 10, margin: "0 0 1px", textTransform: "uppercase" }}>This Week</p>
          <p style={{ color: C.greenBright, fontSize: 14, fontWeight: 700, margin: 0 }}>{formatMoney(l.weekMoney)}</p>
        </div>
        <div style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: C.txt3, fontSize: 20 }}>›</span>
        </div>
      </div>
    </div>
  );
}
