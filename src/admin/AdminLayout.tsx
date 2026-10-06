import { useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { themes } from "../theme";
import { useAuth } from "../context/AuthContext";
import { Login } from "../pages/Login";
import { AdminNav } from "./AdminNav";
import { SeasonBar } from "./SeasonBar";

const C = themes.light;
const COLLAPSED_KEY = "admin.nav.collapsed";

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

const css = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
.adm-wrap{position:sticky;top:0;z-index:10;flex:0 0 auto;height:100vh;min-height:640px}
.adm-side{position:absolute;top:0;left:0;height:100%;display:flex;flex-direction:column;gap:8px;padding:12px 10px;background:${C.card};border-right:1px solid ${C.border};overflow:hidden;transition:width .16s ease,box-shadow .16s ease}
.adm-nav{display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;height:40px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:#374151;font:inherit;font-size:14px;font-weight:500;white-space:nowrap;text-decoration:none;cursor:pointer}
.adm-nav:hover{background:#F0F1F3}
.adm-nav.on{background:#E8ECEF;color:${C.txt}}
.adm-user{height:48px}
.adm-nav:focus-visible,.adm-iconbtn:focus-visible{outline:2px solid ${C.green};outline-offset:2px}
.adm-iconbtn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:#4b5563;cursor:pointer}
.adm-iconbtn:hover{background:#F0F1F3}
.adm-rail .adm-lbl{display:none}
.adm-rail .adm-nav{padding:0;justify-content:center}
.adm-rail:not(.adm-closed):hover .adm-side,.adm-rail:has(:focus-visible) .adm-side{width:240px!important;box-shadow:8px 0 24px rgba(17,24,39,.12)}
.adm-rail:not(.adm-closed):hover .adm-lbl,.adm-rail:has(:focus-visible) .adm-lbl{display:inline-block}
.adm-rail:not(.adm-closed):hover .adm-nav,.adm-rail:has(:focus-visible) .adm-nav{padding:0 12px;justify-content:flex-start}
@media (max-width:760px){
  .adm-wrap{position:static!important;width:100%!important;height:auto!important;min-height:0!important}
  .adm-side{position:relative!important;width:100%!important;height:auto!important;box-shadow:none!important}
  .adm-rail .adm-lbl{display:inline-block!important}
  .adm-rail .adm-nav{padding:0 12px!important;justify-content:flex-start!important}
}
`;

/** Shell for every /admin/* route: nav + season bar + page outlet. Admin-only. */
export function AdminLayout() {
  const { user, manager, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: C.txt2, fontSize: 15 }}>Loading...</p>
      </div>
    );
  }
  if (!user || !manager) return <Login colors={C} />;
  // Client-side gate for UX only; /api/admin/* enforces requireAdmin on the server.
  if (!manager.isAdmin) return <Navigate to="/" replace />;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", minHeight: "100vh", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: C.txt }}>
      <style>{css}</style>
      <AdminNav collapsed={collapsed} onToggle={toggle} />
      <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column" }}>
        <SeasonBar />
        <main style={{ padding: "24px 32px 40px", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
