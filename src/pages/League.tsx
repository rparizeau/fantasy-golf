import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSeasonStandings, type SeasonStanding } from "../api";
import { StandingsList } from "../components/StandingsList";
import type { Theme } from "../theme";

interface LeagueStandingsProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
  simTick: number;
}

export function LeagueStandings({ leagueId, myTeamId, colors: C, simTick }: LeagueStandingsProps) {
  const navigate = useNavigate();
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [managerCount, setManagerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSeasonStandings(leagueId);
      setStandings(data.standings);
      setManagerCount(data.managerCount ?? data.standings.length);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Silent re-fetch on sim tick (no loading spinner)
  useEffect(() => {
    if (simTick > 0) refresh();
  }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "20px 16px 100px" }}>
        <div style={{ background: C.redDim, color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {/* League settings card */}
      <div
        onClick={() => navigate(`/league/${leagueId}/settings`)}
        style={{
          background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
          padding: "14px 16px", marginBottom: 14, display: "flex", alignItems: "center",
          cursor: "pointer",
        }}
      >
        <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0, flex: 1 }}>League Settings</p>
        <span style={{ color: C.txt3, fontSize: 18, flexShrink: 0 }}>&rsaquo;</span>
      </div>

      <StandingsList
        title="Standings"
        entries={standings}
        colors={C}
        myTeamId={myTeamId}
        emptyMessage="No standings data yet. Complete a tournament to see results."
        emptySlots={Math.max(0, managerCount - standings.length)}
      />
    </div>
  );
}
