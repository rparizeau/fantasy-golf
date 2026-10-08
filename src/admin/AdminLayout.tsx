import { useEffect, useState } from "react";
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

/*
 * Mobile first: the base rules are the phone layout (off-canvas nav drawer,
 * single column, stacked list cards). Everything at >=768px is an enhancement
 * (persistent collapsible nav rail, wider padding, real tables).
 */
const css = `
*{box-sizing:border-box}
html,body{margin:0;padding:0;height:100%}
.adm-shell{min-height:100vh;background:${C.bg};color:${C.txt};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.adm-col{min-width:0;display:flex;flex-direction:column}
.adm-main{min-width:0;padding:16px 16px 40px}

/* ---- nav: off-canvas drawer on phones ---- */
.adm-wrap{position:fixed;top:0;bottom:0;left:0;z-index:50;width:min(86vw,300px);transform:translateX(-100%);visibility:hidden;transition:transform .2s ease,visibility 0s linear .2s}
.adm-wrap.adm-open{transform:none;visibility:visible;transition:transform .2s ease,visibility 0s}
.adm-backdrop{position:fixed;inset:0;z-index:40;background:rgba(17,24,39,.4);opacity:0;pointer-events:none;transition:opacity .2s ease}
.adm-backdrop.adm-open{opacity:1;pointer-events:auto}
.adm-side{position:absolute;inset:0;display:flex;flex-direction:column;gap:8px;padding:12px 10px;background:${C.card};border-right:1px solid ${C.border};overflow-x:hidden;overflow-y:auto}
.adm-nav{display:flex;align-items:center;justify-content:flex-start;gap:12px;width:100%;height:48px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:#374151;font:inherit;font-size:15px;font-weight:500;white-space:nowrap;text-decoration:none;cursor:pointer}
.adm-nav:hover{background:#F0F1F3}
.adm-nav.on{background:#E8ECEF;color:${C.txt}}
.adm-user{height:56px}
.adm-nav:focus-visible,.adm-iconbtn:focus-visible,.adm-chip:focus-visible,.adm-plink:focus-visible{outline:2px solid ${C.green};outline-offset:2px}
.adm-iconbtn{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:8px;background:transparent;color:#4b5563;cursor:pointer}
.adm-iconbtn:hover{background:#F0F1F3}
.adm-toggle{display:none}

/* ---- top bar (menu button + season) ---- */
.adm-topbar{position:sticky;top:0;z-index:8;display:flex;align-items:center;gap:8px;min-height:56px;padding:6px 12px;background:${C.card};border-bottom:1px solid ${C.border}}
.adm-seasonlbl{display:none;font-size:12px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:${C.txt2}}
.adm-select{height:44px;min-width:0;padding:0 12px;border:1px solid ${C.border};border-radius:8px;background:${C.card};font:inherit;font-size:15px;font-weight:600;color:${C.txt}}
.adm-badge{display:none;align-items:center;gap:6px;padding:4px 12px;border-radius:999px;background:${C.greenDim};color:${C.greenBright};font-size:13px;font-weight:500}

/* ---- listings: stacked cards on phones ---- */
.adm-card{background:${C.card};border:1px solid ${C.border};border-radius:12px;overflow:hidden}
.adm-table{width:100%;border-collapse:collapse;font-size:14px}
.adm-table thead{display:none}
.adm-table tbody{display:block}
.adm-table tr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;align-items:center;padding:14px 16px;border-bottom:1px solid #EEF0F2}
.adm-table tr:last-child{border-bottom:0}
.adm-table td{display:block;min-width:0;padding:0;border:0}
.adm-table td[data-label]::before{content:attr(data-label) ": ";font-size:13px;color:${C.txt2}}
.adm-leagues tr{grid-template-areas:"name status" "owner owner" "count count"}
.adm-leagues .c-name{grid-area:name;font-weight:600}
.adm-leagues .c-owner{grid-area:owner}
.adm-leagues .c-count{grid-area:count;font-variant-numeric:tabular-nums}
.adm-leagues .c-status{grid-area:status}
.adm-users tr{grid-template-areas:"user preview" "email email" "teams teams"}
.adm-users .c-user{grid-area:user}
.adm-users .c-email{grid-area:email;color:${C.txt2};overflow-wrap:anywhere}
.adm-users .c-count{grid-area:teams;font-variant-numeric:tabular-nums}
.adm-users .c-preview{grid-area:preview}
.adm-sub{font-size:13px;color:${C.txt2};overflow-wrap:anywhere}
.adm-chip{display:flex;align-items:center;gap:6px;height:44px;padding:0 16px;border:1px solid ${C.border};border-radius:999px;background:${C.card};color:${C.txt};font:inherit;font-size:14px;font-weight:500;cursor:pointer}
.adm-chip.on{background:${C.txt};border-color:${C.txt};color:#fff}
.adm-plink{display:inline-flex;align-items:center;gap:6px;height:44px;padding:0 14px;border:1px solid ${C.border};border-radius:8px;background:${C.card};color:${C.txt};font-size:13px;font-weight:500;text-decoration:none;white-space:nowrap}
.adm-filters{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px}
.adm-chips{display:flex;flex-wrap:wrap;gap:8px}

@media (min-width:480px){
  .adm-badge{display:inline-flex}
}

/* ---- >=768px: persistent nav, collapsible to an icon rail ---- */
@media (min-width:768px){
  .adm-shell{display:flex;align-items:flex-start}
  .adm-col{flex:1 1 0}
  .adm-main{padding:24px 32px 40px}
  .adm-topbar{padding:6px 32px;gap:12px}
  .adm-menubtn,.adm-close{display:none}
  .adm-seasonlbl{display:block}
  .adm-select{height:40px;font-size:14px}

  .adm-wrap{position:sticky;top:0;bottom:auto;left:auto;z-index:10;flex:0 0 auto;width:240px;height:100vh;min-height:640px;transform:none;visibility:visible;transition:none}
  .adm-wrap.adm-rail{width:68px}
  .adm-backdrop{display:none}
  .adm-side{inset:auto;top:0;left:0;width:100%;height:100%;overflow:hidden;transition:width .16s ease,box-shadow .16s ease}
  .adm-toggle{display:block}
  .adm-nav{height:40px;font-size:14px}
  .adm-user{height:48px}
  .adm-rail .adm-lbl{display:none}
  .adm-rail .adm-nav{padding:0;justify-content:center}
  .adm-rail:not(.adm-closed):hover .adm-side,.adm-rail:has(:focus-visible) .adm-side{width:240px;box-shadow:8px 0 24px rgba(17,24,39,.12)}
  .adm-rail:not(.adm-closed):hover .adm-lbl,.adm-rail:has(:focus-visible) .adm-lbl{display:inline-block}
  .adm-rail:not(.adm-closed):hover .adm-nav,.adm-rail:has(:focus-visible) .adm-nav{padding:0 12px;justify-content:flex-start}

  .adm-chip{height:36px;padding:0 14px;font-size:13px}
  .adm-plink{height:36px;padding:0 12px}
  .adm-table thead{display:table-header-group}
  .adm-table tbody{display:table-row-group}
  .adm-table tr{display:table-row;padding:0}
  .adm-table th{height:40px;padding:0 20px;text-align:left;background:#FAFBFC;border-bottom:1px solid ${C.border};font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:${C.txt2};white-space:nowrap}
  .adm-table td{display:table-cell;height:64px;padding:0 20px;border-bottom:1px solid #EEF0F2;vertical-align:middle}
  .adm-table tr:last-child td{border-bottom:0}
  .adm-table td[data-label]::before{display:none}
  .adm-table .num{text-align:right}
  .adm-users .c-email{color:${C.txt2}}
}
`;

/** Shell for every /admin/* route: nav + season bar + page outlet. Admin-only. */
export function AdminLayout() {
  const { user, manager, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggle = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSED_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

  // Phone drawer: Escape closes it, and the page behind it doesn't scroll.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

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
    <div className="adm-shell">
      <style>{css}</style>
      <AdminNav
        collapsed={collapsed}
        onToggle={toggle}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="adm-col">
        <SeasonBar onOpenMenu={() => setMobileOpen(true)} menuOpen={mobileOpen} />
        <main className="adm-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
