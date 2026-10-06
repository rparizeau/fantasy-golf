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

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
        <label style={{ ...list.searchWrap, flex: "0 1 320px" }}>
          <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search leagues</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.txt2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={list.searchIcon}>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input type="search" placeholder="Search leagues or owners..." value={query} onChange={(e) => setQuery(e.target.value)} style={list.searchInput} />
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FILTERS.map((f) => {
            const on = f === filter;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={on}
                onClick={() => setFilter(f)}
                style={{
                  height: 36,
                  padding: "0 14px",
                  borderRadius: 999,
                  border: `1px solid ${on ? C.txt : C.border}`,
                  background: on ? C.txt : C.card,
                  color: on ? "#fff" : C.txt,
                  fontSize: 13,
                  fontWeight: 500,
                  fontFamily: "inherit",
                  cursor: "pointer",
                }}
              >
                {f} <span style={{ fontWeight: 400, opacity: 0.75 }}>{counts[f] ?? 0}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <div style={{ ...list.empty, color: C.red }}>{error}</div>}

      {!error && (
        <div style={list.card}>
          <table style={list.table}>
            <thead>
              <tr>
                <th style={list.th}>League</th>
                <th style={list.th}>Owner</th>
                <th style={{ ...list.th, textAlign: "right" }}>Managers</th>
                <th style={list.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => (
                <tr key={l.id}>
                  <td style={{ ...list.td, fontWeight: 600 }}>{l.name}</td>
                  <td style={list.td}>
                    <div style={{ fontWeight: 500 }}>{l.ownerName}</div>
                    <div style={list.muted}>{l.ownerEmail}</div>
                  </td>
                  <td style={{ ...list.td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{l.managerCount}</td>
                  <td style={list.td}>
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
