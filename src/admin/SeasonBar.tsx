interface SeasonBarProps {
  /** Opens the nav drawer (phones only — the button is hidden at >=768px). */
  onOpenMenu: () => void;
  menuOpen: boolean;
}

/**
 * Top bar: menu button (phones) + season switcher.
 * Season is a stub: only the current year is listed and nothing reads the
 * selection yet — the schema has no seasons table.
 */
export function SeasonBar({ onOpenMenu, menuOpen }: SeasonBarProps) {
  const year = new Date().getFullYear();

  return (
    <div className="adm-topbar">
      <button
        type="button"
        className="adm-iconbtn adm-menubtn"
        onClick={onOpenMenu}
        aria-label="Open menu"
        aria-expanded={menuOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <span className="adm-seasonlbl" aria-hidden="true">Season</span>
      <select className="adm-select" aria-label="Season" defaultValue={String(year)}>
        <option value={String(year)}>{year} Season</option>
      </select>
      <span className="adm-badge">
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2D8B52" }} />
        Current season
      </span>
    </div>
  );
}
