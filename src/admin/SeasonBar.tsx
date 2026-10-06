import { themes } from "../theme";

const C = themes.light;

/**
 * Season switcher. Stub: only the current year is listed and nothing reads the
 * selection yet — the schema has no seasons table.
 */
export function SeasonBar() {
  const year = new Date().getFullYear();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 8,
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
        minHeight: 56,
        padding: "6px 32px",
        background: C.card,
        borderBottom: `1px solid ${C.border}`,
      }}
    >
      <label htmlFor="adm-season" style={{ fontSize: 12, fontWeight: 600, letterSpacing: 0.8, textTransform: "uppercase", color: C.txt2 }}>
        Season
      </label>
      <select
        id="adm-season"
        defaultValue={String(year)}
        style={{ height: 40, padding: "0 12px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.card, fontSize: 14, fontWeight: 600, color: C.txt, fontFamily: "inherit" }}
      >
        <option value={String(year)}>{year} Season</option>
      </select>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: C.greenBright, background: C.greenDim, borderRadius: 999, padding: "4px 12px" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
        Current season
      </span>
    </div>
  );
}
