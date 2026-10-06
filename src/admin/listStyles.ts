import type React from "react";
import { themes } from "../theme";

const C = themes.light;

/** Shared styles for the admin listing pages (Leagues, Users). */
export const list: Record<string, React.CSSProperties> = {
  searchWrap: { position: "relative", display: "block", width: "100%", maxWidth: 360 },
  searchInput: {
    width: "100%",
    height: 44,
    padding: "0 14px 0 38px",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    background: C.card,
    fontSize: 14,
    fontFamily: "inherit",
    color: C.txt,
  },
  searchIcon: { position: "absolute", left: 14, top: 14, pointerEvents: "none" },
  card: { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflowX: "auto" },
  table: { width: "100%", minWidth: 640, borderCollapse: "collapse", fontSize: 14 },
  th: {
    height: 40,
    padding: "0 20px",
    textAlign: "left",
    background: "#FAFBFC",
    borderBottom: `1px solid ${C.border}`,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: C.txt2,
    whiteSpace: "nowrap",
  },
  td: { height: 64, padding: "0 20px", borderBottom: "1px solid #EEF0F2", verticalAlign: "middle" },
  muted: { fontSize: 13, color: C.txt2 },
  empty: { padding: "48px 16px", textAlign: "center", color: C.txt2, fontSize: 14 },
};
