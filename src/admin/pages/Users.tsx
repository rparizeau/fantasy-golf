import { useEffect, useMemo, useState } from "react";
import { getAdminUsers, type AdminUser } from "../../api";
import { themes } from "../../theme";
import { PageHeader } from "../PageHeader";
import { list } from "../listStyles";

const C = themes.light;

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export function Users() {
  const [rows, setRows] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAdminUsers()
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load users"));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q));
  }, [rows, query]);

  const totalTeams = (rows ?? []).reduce((a, r) => a + r.teamCount, 0);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle={rows ? `${rows.length} users · ${totalTeams} teams` : undefined}
      />

      <label style={{ ...list.searchWrap, marginBottom: 12 }}>
        <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Search users</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.txt2} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={list.searchIcon}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input type="search" placeholder="Search name or email..." value={query} onChange={(e) => setQuery(e.target.value)} style={list.searchInput} />
      </label>

      {error && <div style={{ ...list.empty, color: C.red }}>{error}</div>}

      {!error && (
        <div className="adm-card">
          <table className="adm-table adm-users">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th className="num">Teams</th>
                <th>App experience</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td className="c-user">
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ width: 32, height: 32, borderRadius: "50%", background: C.card2, color: C.txt2, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", flex: "0 0 auto" }}>
                        {initials(u.name)}
                      </span>
                      <span style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{u.name}</span>
                    </div>
                  </td>
                  <td className="c-email">{u.email}</td>
                  <td className="c-count num" data-label="Teams">{u.teamCount}</td>
                  <td className="c-preview">
                    {/* Stub: design only. Wiring (read-only preview + audit log) is a later phase. */}
                    <a href="#" className="adm-plink" onClick={(e) => e.preventDefault()} aria-label={`Preview app as ${u.name}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
                      </svg>
                      Preview app
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows && <div style={list.empty}>Loading users...</div>}
          {rows && visible.length === 0 && <div style={list.empty}>No users match that search.</div>}
        </div>
      )}
    </>
  );
}
