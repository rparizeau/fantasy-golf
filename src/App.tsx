import { useState } from "react";
import { themes, type ThemeMode } from "./theme";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Lobby } from "./components/Lobby";
import { LeagueShell } from "./components/LeagueShell";

export default function App() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const [activeLeague, setActiveLeague] = useState<{ id: number; myTeamId: number } | null>(null);
  const [page, setPage] = useState("home");

  const C = themes[mode];
  const isDark = mode === "dark";

  const { user, manager, loading } = useAuth();

  const toggleTheme = () => setMode((m) => (m === "light" ? "dark" : "light"));
  const enterLeague = (id: number, _name: string, myTeamId: number) => {
    setActiveLeague({ id, myTeamId });
    setPage("home");
  };
  const exitLeague = () => setActiveLeague(null);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: C.txt2, fontSize: 15 }}>Loading...</p>
      </div>
    );
  }

  if (!user || !manager) {
    return <Login colors={C} />;
  }

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: C.card,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        transition: "background .3s",
        display: activeLeague ? "flex" : undefined,
        flexDirection: activeLeague ? "column" : undefined,
      }}
    >
      <style>{`*{box-sizing:border-box}html,body{margin:0;padding:0;height:100%;overscroll-behavior:none}::-webkit-scrollbar{display:none}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>

      {activeLeague ? (
        <LeagueShell
          leagueId={activeLeague.id}
          myTeamId={activeLeague.myTeamId}
          activePage={page}
          isDark={isDark}
          colors={C}
          onToggleTheme={toggleTheme}
          onBack={exitLeague}
          onChangePage={setPage}
        />
      ) : (
        <Lobby isDark={isDark} colors={C} onToggleTheme={toggleTheme} onEnterLeague={enterLeague} />
      )}
    </div>
  );
}
