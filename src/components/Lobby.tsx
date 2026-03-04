import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { LeagueSummary } from "../api";
import { getLeagues } from "../api";
import { useAuth } from "../context/AuthContext";
import { ProfileMenu } from "./ProfileMenu";
import { ManagerIcon } from "./ManagerIcon";

interface LobbyProps {
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onEnterLeague: (id: number) => void;
  onEnterLeaguePage: (id: number, page: string) => void;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function Lobby({ isDark, colors: C, onToggleTheme, onEnterLeague, onEnterLeaguePage }: LobbyProps) {
  const { manager } = useAuth();
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
          <ProfileMenu isDark={isDark} colors={C} onToggleTheme={onToggleTheme} />
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
            <LeagueCard key={l.id} league={l} isDark={isDark} colors={C} onTap={() => onEnterLeague(l.id)} onNav={(page) => onEnterLeaguePage(l.id, page)} />
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
      <div style={{ padding: "10px 16px" }}>
        <div style={bar(100, 10)} />
      </div>
      <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: C.border }} />
          <div>
            <div style={bar(120, 18)} />
            <div style={{ ...bar(90, 10), marginTop: 6 }} />
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={bar(60, 10)} />
          <div style={{ ...bar(50, 18), marginTop: 4 }} />
        </div>
      </div>
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 0", borderLeft: i > 0 ? `1px solid ${C.border}` : undefined }}>
            <div style={bar(18, 18)} />
            <div style={bar(32, 8)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NavIcon({ id, color }: { id: string; color: string }) {
  const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (id) {
    case "scorecard": return <svg {...s}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>;
    case "golfers": return <svg {...s}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "league": return <svg {...s}><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" /><line x1="9" y1="3" x2="9" y2="21" /></svg>;
    case "chat": return <svg {...s}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
    default: return null;
  }
}

const navLinks = [
  { id: "scorecard", label: "Roster" },
  { id: "golfers", label: "Golfers" },
  { id: "league", label: "League" },
  { id: "chat", label: "Chat" },
];

function LeagueCard({
  league: l,
  isDark: _dk,
  colors: C,
  onTap,
  onNav,
}: {
  league: LeagueSummary;
  isDark: boolean;
  colors: Theme;
  onTap: () => void;
  onNav: (page: string) => void;
}) {
  return (
    <div
      style={{
        background: C.card,
        borderRadius: 14,
        marginBottom: 12,
        border: `1px solid ${C.border}`,
        boxShadow: C.shadow,
        overflow: "hidden",
      }}
    >
      {/* League name title */}
      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ color: C.txt3, fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>{l.name}</p>
        <p style={{ color: C.txt3, fontSize: 11, margin: 0, textTransform: "uppercase", letterSpacing: 0.6, fontWeight: 600 }}>Week {l.week}</p>
      </div>
      {/* Home — team info */}
      <div onClick={onTap} style={{ padding: "12px 16px", cursor: "pointer" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <ManagerIcon size={42} bgColor={l.teamColor ?? "#003C80"} ballColor={l.teamSecondaryColor ?? "#FFFFFF"} />
            <div style={{ minWidth: 0 }}>
              <p style={{ color: C.txt, fontSize: 18, fontWeight: 700, margin: 0 }}>{l.team}</p>
              <p style={{ color: C.txt2, fontSize: 12, fontWeight: 500, margin: "2px 0 0" }}>
                {ordinal(l.rank)} Place · {l.points} pts
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 12 }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0 }}>{l.weekPoints} pts</p>
            {l.weekRank > 0 && <p style={{ fontSize: 11, color: C.txt3, margin: "2px 0 0", fontWeight: 600 }}>{ordinal(l.weekRank)} Place</p>}
          </div>
        </div>
      </div>
      {/* Nav links */}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
        {navLinks.map((link, i) => (
          <div
            key={link.id}
            onClick={() => onNav(link.id)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "10px 0",
              cursor: "pointer",
              borderLeft: i > 0 ? `1px solid ${C.border}` : undefined,
            }}
          >
            <NavIcon id={link.id} color={C.txt3} />
            <span style={{ fontSize: 10, fontWeight: 600, color: C.txt2 }}>{link.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
