import { useEffect, useMemo, useState } from "react";
import { getAdminLeagues, type AdminLeague, type AdminLeagueStatus } from "../../api";
import { themes } from "../../theme";
import { PageHeader } from "../PageHeader";
import { list } from "../listStyles";

const C = themes.light;

const STATUS_STYLE: Record<AdminLeagueStatus, { bg: string; fg: string }> = {
  Active: { bg: C.greenDim, fg: C.greenBright },
  Drafting: { bg: C.goldDim, fg: "#8A6A12" },
  Setup: { bg: C.card2, fg: C.txt2 },
};

const FILTERS: ("All" | AdminLeagueStatus)[] = ["All", "Active", "Drafting", "Setup"];

export function Leagues() {
  const [rows, setRows] = useState<AdminLeague[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    getAdminLeagues()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load leagues"));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: rows?.length ?? 0 };
    for (const r of rows ?? []) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter(
      (r) =>
        (filter === "All" || r.status === filter) &&
        (!q || `${r.name} ${r.ownerName} ${r.ownerEmail}`.toLowerCase().includes(q)),
    );
  }, [rows, query, filter]);

  const totalManagers = (rows ?? []).reduce((a, r) => a + r.managerCount, 0);

  return (
    <>
      <PageHeader
        title="Leagues"
        subtitle={rows ? `${rows.length} leagues · ${totalManagers} managers` : undefined}
      />

      <div className="adm-filters">
        <label style={{ ...list.searchWrap, flex: "1 1 260px" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search leagues</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.txt2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={list.searchIcon}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Search leagues or owners..." value={query} onChange={(e) => setQuery(e.target.value)} style={list.searchInput} />
        </label>
        <div className="adm-chips">
          {FILTERS.map((f) => (
            <button key={f} type="button" aria-pressed={f === filter} className={f === filter ? "adm-chip on" : "adm-chip"} onClick={() => setFilter(f)}>
              {f} <span style={{ fontWeight: 400, opacity: 0.75 }}>{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {error && <div style={{ ...list.empty, color: C.red }}>{error}</div>}

      {!error && (
        <div className="adm-card">
          <table className="adm-table adm-leagues">
            <thead>
              <tr>
                <th>League</th>
                <th>Owner</th>
                <th className="num">Managers</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id}>
                  <td className="c-name">{l.name}</td>
                  <td className="c-owner">
                    <div style={{ fontWeight: 500 }}>{l.ownerName}</div>
                    <div className="adm-sub">{l.ownerEmail}</div>
                  </td>
                  <td className="c-count num" data-label="Managers">{l.managerCount}</td>
                  <td className="c-status">
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "3px 10px", borderRadius: 999, fontSize: 13, fontWeight: 500, background: STATUS_STYLE[l.status].bg, color: STATUS_STYLE[l.status].fg }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: STATUS_STYLE[l.status].fg }} />
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows && <div style={list.empty}>Loading leagues...</div>}
          {rows && visible.length === 0 && <div style={list.empty}>No leagues match.</div>}
        </div>
      )}
    </>
  );
}
