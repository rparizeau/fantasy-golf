import type React from "react";
import { themes } from "../theme";

const C = themes.light;

/**
 * Inline bits shared by the admin listing pages (Leagues, Users). The
 * responsive table/card, chip and link styles are classes (.adm-*) in AdminLayout.
 */
export const list: Record<string, React.CSSProperties> = {
  searchWrap: { position: "relative", display: "block", width: "100%", maxWidth: 360 },
  searchInput: {
    width: "100%",
    height: 44,
    padding: "0 14px 0 38px",
    border: `1px solid ${C.border}`,
    borderRadius: 10,
    background: C.card,
    fontSize: 16, // 16px keeps iOS Safari from zooming the page on focus
    fontFamily: "inherit",
    color: C.txt,
  },
  searchIcon: { position: "absolute", left: 14, top: 14, pointerEvents: "none" },
  empty: { padding: "48px 16px", textAlign: "center", color: C.txt2, fontSize: 14 },
};
