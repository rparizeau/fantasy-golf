import { useState, useEffect, useCallback } from "react";
import { getFantasyLeaderboard, type FantasyTeamSummary, type TournamentListItem } from "../api";
import { StandingsList } from "../components/StandingsList";
import type { Theme } from "../theme";

interface HomeProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  simTick: number;
}

export function Home({ leagueId, myTeamId, colors: C, tournaments, currentTournamentId, viewingWeek, simTick }: HomeProps) {
  const [teams, setTeams] = useState<FantasyTeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tid = tournaments[viewingWeek]?.id;

  const refresh = useCallback(async () => {
    if (!tid) return;
    try {
      const lb = await getFantasyLeaderboard(leagueId, tid);
      setTeams(lb.teams);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId, tid]);

  useEffect(() => {
    setLoading(true);
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

  const currentWeekIdx = tournaments.findIndex((t) => t.id === currentTournamentId);
  const isFuture = viewingWeek > currentWeekIdx;

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      <StandingsList
        title="Leaderboard"
        entries={teams}
        colors={C}
        myTeamId={myTeamId}
        showThru={false}
        showRounds={true}
        badgeColor={tournaments[viewingWeek]?.color}
        emptyMessage={isFuture ? "Tournament hasn't started yet." : "No leaderboard data yet. Sim a round to see results."}
      />
    </div>
  );
}
