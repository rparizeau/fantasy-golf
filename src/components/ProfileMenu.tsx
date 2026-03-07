import { useState, useRef, useEffect } from "react";
import type { Theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import { ThemeToggle } from "./ThemeToggle";

interface ProfileMenuProps {
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
}

export function ProfileMenu({ isDark, colors: C, onToggleTheme }: ProfileMenuProps) {
  const { manager, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const initials = (manager?.displayName ?? "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "none",
          background: "linear-gradient(135deg, #1A3A2A, #0F2418)",
          color: "#D4AF37",
          fontSize: 11,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          flexShrink: 0,
        }}
      >
        {initials}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 36,
            right: 0,
            zIndex: 50,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            boxShadow: isDark ? "0 4px 20px rgba(0,0,0,.4)" : "0 4px 20px rgba(0,0,0,.12)",
            width: 220,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
            <p style={{ color: C.txt, fontSize: 13, fontWeight: 600, margin: 0 }}>
              {manager?.displayName ?? "Manager"}
            </p>
            <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>
              {manager?.email ?? ""}
            </p>
          </div>

          {/* Theme row */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
            }}
          >
            <span style={{ color: C.txt2, fontSize: 13 }}>Theme</span>
            <ThemeToggle isDark={isDark} colors={C} onToggle={onToggleTheme} />
          </div>

          {/* Edit Profile */}
          <div
            style={{
              padding: "10px 14px",
              cursor: "default",
            }}
          >
            <span style={{ color: C.txt3, fontSize: 13 }}>Edit Profile</span>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: C.border }} />

          {/* Sign Out */}
          <div
            onClick={() => { setOpen(false); signOut(); }}
            style={{
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            <span style={{ color: C.red, fontSize: 13, fontWeight: 500 }}>Sign Out</span>
          </div>
        </div>
      )}
    </div>
  );
}
