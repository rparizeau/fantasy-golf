import { useState } from "react";

const themes = {
  light: {
    bg: "#F4F5F7", card: "#FFFFFF", card2: "#F0F1F3", border: "#E2E5EA",
    green: "#2D8B52", greenDim: "#E8F5EE", greenBright: "#1E7A3F",
    gold: "#B8912E", goldDim: "#F5EDD8",
    red: "#D94438", redDim: "#FDECEB",
    blue: "#3A85CC", blueDim: "#E8F0FA",
    txt: "#1A1D21", txt2: "#5A6370", txt3: "#8E95A0",
    navBg: "#FFFFFFEF", shadow: "0 1px 4px rgba(0,0,0,0.06)"
  },
  dark: {
    bg: "#0B1014", card: "#131A1F", card2: "#1A2228", border: "#1E2D33",
    green: "#2D9B5E", greenDim: "#1A3D2A", greenBright: "#3DBB72",
    gold: "#B8912E", goldDim: "#332A14",
    red: "#E8564A", redDim: "#3D1A17",
    blue: "#4A9BE8", blueDim: "#1A2D3D",
    txt: "#F0F2F4", txt2: "#8A96A2", txt3: "#5A6570",
    navBg: "#131A1FF0", shadow: "none"
  }
};

const leagueData = {
  1: {
    id: 1, name: "Andys Amateurs", team: "Ricky Bobbys", rank: 3, of: 10,
    money: "$1,245,800", weekMoney: "$312,400", members: 10,
    tournament: "Arnold Palmer Inv.", course: "Bay Hill Club & Lodge",
    loc: "Orlando, FL", status: "live", round: 2, purse: "$10M",
    cut: "-1 (139)", weekNum: 1
  },
  2: {
    id: 2, name: "Work League Elites", team: "Bobby Big Wood", rank: 1, of: 8,
    money: "$1,892,100", weekMoney: "$445,200", members: 8,
    tournament: "Arnold Palmer Inv.", course: "Bay Hill Club & Lodge",
    loc: "Orlando, FL", status: "live", round: 2, purse: "$20M",
    cut: "-1 (139)", weekNum: 2
  }
};

const navItems = [
  { id: "home", label: "Home", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "currentColor" : "#8E95A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: "scorecard", label: "Roster", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "currentColor" : "#8E95A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg> },
  { id: "golfers", label: "Golfers", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "currentColor" : "#8E95A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { id: "league", label: "League", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "currentColor" : "#8E95A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/></svg> },
  { id: "chat", label: "Chat", icon: (a) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? "currentColor" : "#8E95A0"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> }
];

export default function App() {
  const [mode, setMode] = useState("light");
  const [activeLeague, setActiveLeague] = useState(null);
  const [page, setPage] = useState("home");

  const C = themes[mode];
  const dk = mode === "dark";
  const lg = activeLeague ? leagueData[activeLeague] : null;

  const enterLeague = (id) => { setActiveLeague(id); setPage("home"); };
  const exitLeague = () => { setActiveLeague(null); };

  const Toggle = () => (
    <button onClick={() => setMode(m => m === "light" ? "dark" : "light")} style={{
      width: 44, height: 26, borderRadius: 13, border: `1px solid ${C.border}`,
      background: dk ? C.greenDim : C.card2, cursor: "pointer", padding: 0,
      display: "flex", alignItems: "center", justifyContent: dk ? "flex-end" : "flex-start",
      paddingInline: 3, transition: "all .25s", flexShrink: 0
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: dk ? C.green : "#CBD0D6",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, transition: "all .25s"
      }}>{dk ? "🌙" : "☀️"}</div>
    </button>
  );

  // ════════════════════════════
  // ──── LANDING PAGE ─────────
  // ════════════════════════════
  if (!activeLeague) return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", transition: "background .3s" }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{display:none}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
      <div style={{ padding: "0 16px" }}>
        {/* SECTION HEADER — first row matches league header row 1 exactly */}
        <div style={{ paddingBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
            <p style={{ color: C.txt2, fontSize: 14, margin: 0 }}>Welcome back,</p>
            <Toggle />
          </div>
          <p style={{ color: C.txt, fontSize: 30, fontWeight: 700, margin: 0, letterSpacing: -0.5 }}>Bobby</p>
        </div>

        {/* SECTION BODY */}
        <p style={{ color: C.txt2, fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 12px" }}>Your Leagues</p>

        {/* League List */}
        {[leagueData[1], leagueData[2]].map(l => (
          <div key={l.id} onClick={() => enterLeague(l.id)} style={{
            background: C.card, borderRadius: 14, marginBottom: 12, border: `1px solid ${C.border}`,
            cursor: "pointer", boxShadow: C.shadow, overflow: "hidden", transition: "transform .1s"
          }}>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <p style={{ color: C.txt3, fontSize: 11, margin: "0 0 3px", textTransform: "uppercase", letterSpacing: 0.6 }}>{l.name}</p>
                  <p style={{ color: C.txt, fontSize: 18, fontWeight: 700, margin: 0 }}>{l.team}</p>
                </div>
                <span style={{
                  padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
                  color: l.rank <= 1 ? C.gold : C.greenBright,
                  background: l.rank <= 1 ? (dk ? C.goldDim : `${C.gold}15`) : C.greenDim
                }}>#{l.rank} of {l.of}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                {l.status === "live" && <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.greenBright, boxShadow: `0 0 6px ${C.green}`, animation: "pulse 2s infinite", flexShrink: 0 }} />}
                <p style={{ color: C.txt2, fontSize: 12, margin: 0 }}>
                  Wk {l.weekNum} • {l.tournament} • {l.purse}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", borderTop: `1px solid ${C.border}` }}>
              <div style={{ flex: 1, padding: "10px 16px", borderRight: `1px solid ${C.border}` }}>
                <p style={{ color: C.txt3, fontSize: 10, margin: "0 0 1px", textTransform: "uppercase" }}>Season</p>
                <p style={{ color: C.txt, fontSize: 14, fontWeight: 700, margin: 0 }}>{l.money}</p>
              </div>
              <div style={{ flex: 1, padding: "10px 16px", borderRight: `1px solid ${C.border}` }}>
                <p style={{ color: C.txt3, fontSize: 10, margin: "0 0 1px", textTransform: "uppercase" }}>This Week</p>
                <p style={{ color: C.greenBright, fontSize: 14, fontWeight: 700, margin: 0 }}>{l.weekMoney}</p>
              </div>
              <div style={{ width: 48, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: C.txt3, fontSize: 20 }}>›</span>
              </div>
            </div>
          </div>
        ))}

        {/* Create a League */}
        <div style={{
          background: C.card, borderRadius: 14, border: `2px dashed ${C.border}`,
          padding: "24px 20px", textAlign: "center", cursor: "pointer"
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, margin: "0 auto 10px",
            background: C.card2, border: `1px solid ${C.border}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, color: C.txt3
          }}>+</div>
          <p style={{ color: C.txt, fontSize: 15, fontWeight: 600, margin: "0 0 3px" }}>Create a League</p>
          <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>Set up a new league and invite your friends</p>
        </div>
      </div>
    </div>
  );

  // ════════════════════════════
  // ──── LEAGUE SHELL ─────────
  // ════════════════════════════
  const statusColor = lg.status === "live" ? C.greenBright : lg.status === "done" ? C.blue : C.txt3;
  const statusLabel = lg.status === "live" ? `Live • R${lg.round}` : lg.status === "done" ? "Final" : "Upcoming";

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", transition: "background .3s", display: "flex", flexDirection: "column" }}>
      <style>{`*{box-sizing:border-box}::-webkit-scrollbar{display:none}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {/* ── LEAGUE HEADER (fixed) ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: C.card, borderBottom: `1px solid ${C.border}`,
        padding: "0 16px 16px", boxShadow: dk ? "none" : "0 1px 3px rgba(0,0,0,0.04)"
      }}>
        {/* Row 1: Back + League Name | Toggle — 64px matches landing */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={exitLeague} style={{
              width: 30, height: 30, borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.card2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              color: C.txt2, fontSize: 16, fontWeight: 500, padding: 0
            }}>‹</button>
            <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{lg.name}</p>
          </div>
          <Toggle />
        </div>

        {/* Row 2: Tournament Name | Status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, marginBottom: 4 }}>
          <p style={{ color: C.txt, fontSize: 17, fontWeight: 700, margin: 0 }}>{lg.tournament}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              padding: "2px 8px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              color: statusColor, background: statusColor + (dk ? "20" : "15"),
              display: "flex", alignItems: "center", gap: 5
            }}>{lg.status === "live" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.greenBright, boxShadow: `0 0 6px ${C.green}`, animation: "pulse 2s infinite", flexShrink: 0 }} />}{statusLabel}</span>
          </div>
        </div>

        {/* Row 3: Course | Purse */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>{lg.course}</p>
          <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>Purse: {lg.purse}</p>
        </div>

        {/* Row 4: Location | Cut */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>📍 {lg.loc}</p>
          <p style={{ color: C.txt3, fontSize: 12, margin: 0 }}>Cut: {lg.cut}</p>
        </div>
      </div>

      {/* ── PAGE CONTENT ── */}
      <div style={{ flex: 1, padding: "20px 16px 100px" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          minHeight: 300, borderRadius: 14, border: `2px dashed ${C.border}`,
          background: C.card
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: C.txt, fontSize: 18, fontWeight: 600, margin: "0 0 4px", textTransform: "capitalize" }}>{page}</p>
            <p style={{ color: C.txt3, fontSize: 13, margin: 0 }}>{lg.team} • {lg.name}</p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM NAV (fixed) ── */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 430,
        background: C.navBg, backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
        borderTop: `1px solid ${C.border}`,
        display: "flex", padding: "8px 0 22px", zIndex: 50
      }}>
        {navItems.map(n => {
          const active = page === n.id;
          return (
            <button key={n.id} onClick={() => setPage(n.id)} style={{
              flex: 1, border: "none", background: "transparent", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 0",
              color: active ? C.greenBright : C.txt3, transition: "color .15s"
            }}>
              {n.icon(active)}
              <span style={{ fontSize: 10, fontWeight: 600 }}>{n.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
