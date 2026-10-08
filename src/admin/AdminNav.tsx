import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { themes } from "../theme";
import { useAuth } from "../context/AuthContext";

const C = themes.light;

const NAV_ITEMS = [
  { to: "/admin/overview", label: "Overview", icon: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z" },
  { to: "/admin/leagues", label: "Leagues", icon: "M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z" },
  { to: "/admin/users", label: "Users", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { to: "/admin/simulator", label: "Simulator", icon: "M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" },
  { to: "/admin/stat-corrections", label: "Stat Corrections", icon: "M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" },
  { to: "/admin/reporting", label: "Reporting", icon: "M3 3v18h18M18 17V9M13 17V5M8 17v-3" },
  { to: "/admin/api-integrations", label: "API Integrations", icon: "m16 18 6-6-6-6M8 6l-6 6 6 6" },
];

interface AdminNavProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Phone drawer state (the rail/collapse behavior only applies at >=768px). */
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

/**
 * Left nav. Expanded: 240px. Collapsed ("rail"): 68px, icons only; hovering or
 * focusing the rail expands it over the page without reflowing the content
 * (see the .adm-* rules in AdminLayout).
 */
export function AdminNav({ collapsed, onToggle, mobileOpen, onCloseMobile }: AdminNavProps) {
  const { manager } = useAuth();
  // After a nav click, keep the rail closed until the pointer leaves it.
  const [closed, setClosed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Move focus into the drawer when it opens on a phone.
  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
  }, [mobileOpen]);

  const wrapClass = ["adm-wrap", collapsed ? "adm-rail" : "", collapsed && closed ? "adm-closed" : "", mobileOpen ? "adm-open" : ""]
    .filter(Boolean)
    .join(" ");
  const name = manager?.displayName ?? "";
  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

  return (
    <>
    <div className={`adm-backdrop${mobileOpen ? " adm-open" : ""}`} onClick={onCloseMobile} aria-hidden="true" />
    <div className={wrapClass} onMouseLeave={() => setClosed(false)}>
      <aside className="adm-side" aria-label="Admin navigation">
        <div style={{ display: "flex", alignItems: "center", gap: 4, height: 44 }}>
          <div style={{ width: 48, flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <img src="/icon.svg" alt="Fantasy Golf" width={32} height={32} style={{ display: "block" }} />
          </div>
          <div className="adm-lbl" style={{ flex: 1, minWidth: 0, lineHeight: 1.15, whiteSpace: "nowrap" }}>
            <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: C.txt }}>Fantasy Golf</span>
            <span style={{ display: "block", fontSize: 12, color: C.txt2 }}>Admin</span>
          </div>
          <div className="adm-close">
            <button ref={closeRef} type="button" className="adm-iconbtn" onClick={onCloseMobile} aria-label="Close menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="adm-lbl adm-toggle">
            <button
              type="button"
              className="adm-iconbtn"
              onClick={onToggle}
              aria-label={collapsed ? "Keep navigation open" : "Collapse navigation"}
              aria-expanded={!collapsed}
              title={collapsed ? "Keep navigation open" : "Collapse navigation"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
          </div>
        </div>

        <nav aria-label="Admin" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 4 }}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? "adm-nav on" : "adm-nav")}
              aria-label={item.label}
              onClick={() => { setClosed(true); onCloseMobile(); }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                <path d={item.icon} />
              </svg>
              <span className="adm-lbl" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* User button — always last, pinned to the bottom. Stub: no menu yet. */}
        <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <button type="button" className="adm-nav adm-user" aria-label={`Account: ${name}`}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #1A3A2A, #0F2418)", color: "#D4AF37", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
              {initials}
            </span>
            <span className="adm-lbl" style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</span>
          </button>
          {/* TODO: account menu (name, email, password, sign out) */}
        </div>
      </aside>
    </div>
    </>
  );
}
