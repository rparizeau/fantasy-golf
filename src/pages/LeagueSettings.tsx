import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getLeagueInfo, getSeasonStandings, type LeagueInfo } from "../api";
import type { Theme } from "../theme";

interface LeagueSettingsProps {
  leagueId: number;
  colors: Theme;
}

export function LeagueSettings({ leagueId, colors: C }: LeagueSettingsProps) {
  const navigate = useNavigate();
  const [leagueInfo, setLeagueInfo] = useState<LeagueInfo | null>(null);
  const [managerCount, setManagerCount] = useState(0);
  const [memberCount, setMemberCount] = useState(0);
  const [totalWeeks, setTotalWeeks] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getLeagueInfo(leagueId),
      getSeasonStandings(leagueId),
    ]).then(([info, data]) => {
      setLeagueInfo(info);
      setMemberCount(info.members.length);
      setManagerCount(data.managerCount ?? info.members.length);
      setTotalWeeks(data.totalWeeks);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [leagueId]);

  const s = leagueInfo?.settings;
  const scoringEntries = s?.scoringSettings ? Object.entries(s.scoringSettings) : [];

  const row = (label: string, value: string | number) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.txt2, fontSize: 13 }}>{label}</span>
      <span style={{ color: C.txt, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: C.bg }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${C.border}`, background: C.card, flexShrink: 0 }}>
        <button onClick={() => navigate(`/league/${leagueId}/league`)} style={{ background: "none", border: "none", color: C.txt2, fontSize: 14, cursor: "pointer", padding: 0 }}>
          Back
        </button>
        <span style={{ color: C.txt, fontSize: 14, fontWeight: 600 }}>League Settings</span>
        <div style={{ width: 40 }} />
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      ) : (
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {/* General */}
          <p style={{ color: C.txt, fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>General</p>
          {row("League Size", `${memberCount} / ${managerCount}`)}
          {row("Schedule", `${totalWeeks} weeks`)}
          {s && row("Active Squad", s.activeSize)}
          {s && row("Roster Size", s.rosterSize)}
          {s && row("Reserve", s.reserveSize)}

          {/* Members */}
          {leagueInfo && (
            <>
              <p style={{ color: C.txt, fontSize: 16, fontWeight: 700, margin: "20px 0 8px" }}>Members</p>
              {leagueInfo.members.map((m) => (
                <div key={m.teamId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: m.color ?? C.card2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ color: C.txt, fontSize: 13, fontWeight: 600, margin: 0 }}>{m.teamName}</p>
                    <p style={{ color: C.txt3, fontSize: 11, margin: "1px 0 0" }}>{m.managerName}</p>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Scoring */}
          {scoringEntries.length > 0 && (
            <>
              <p style={{ color: C.txt, fontSize: 16, fontWeight: 700, margin: "20px 0 8px" }}>Scoring</p>
              {scoringEntries.map(([key, val]) => row(formatScoringKey(key), val))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function formatScoringKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
