import { useState, useEffect, useCallback } from "react";
import { getSeasonStandings, type SeasonStanding } from "../api";
import { StandingsList } from "../components/StandingsList";
import type { Theme } from "../theme";

interface LeagueStandingsProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
}

export function LeagueStandings({ leagueId, myTeamId, colors: C }: LeagueStandingsProps) {
  const [standings, setStandings] = useState<SeasonStanding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getSeasonStandings(leagueId);
      setStandings(data);
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
      <StandingsList
        title="Standings"
        entries={standings}
        colors={C}
        myTeamId={myTeamId}
        emptyMessage="No standings data yet. Complete a tournament to see results."
      />
    </div>
  );
}
