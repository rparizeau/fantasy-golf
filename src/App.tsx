import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { themes, type ThemeMode } from "./theme";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Lobby } from "./components/Lobby";
import { LeagueShell } from "./components/LeagueShell";

export default function App() {
  const [mode, setMode] = useState<ThemeMode>("light");
  const { leagueId: leagueIdParam, page: pageParam } = useParams();
  const navigate = useNavigate();

  const C = themes[mode];
  const isDark = mode === "dark";

  const { user, manager, loading } = useAuth();

  const toggleTheme = () => setMode((m) => (m === "light" ? "dark" : "light"));

  const leagueId = leagueIdParam ? Number(leagueIdParam) : null;
  const page = pageParam || "home";

  const enterLeague = (id: number) => navigate(`/league/${id}/home`);
  const enterLeaguePage = (id: number, p: string) => navigate(`/league/${id}/${p}`);
  const exitLeague = () => navigate("/");
  const changePage = (p: string) => navigate(`/league/${leagueId}/${p}`);

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
        display: leagueId ? "flex" : undefined,
        flexDirection: leagueId ? "column" : undefined,
      }}
    >
      <style>{`*{box-sizing:border-box}html,body{margin:0;padding:0;height:100%;overscroll-behavior:none}::-webkit-scrollbar{display:none}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes progress{from{width:0}to{width:100%}}`}</style>

      {leagueId ? (
        <LeagueShell
          leagueId={leagueId}
          activePage={page}
          isDark={isDark}
          colors={C}
          onToggleTheme={toggleTheme}
          onBack={exitLeague}
          onChangePage={changePage}
        />
      ) : (
        <Lobby isDark={isDark} colors={C} onToggleTheme={toggleTheme} onEnterLeague={enterLeague} onEnterLeaguePage={enterLeaguePage} />
      )}
    </div>
  );
}
