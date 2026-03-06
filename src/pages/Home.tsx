import { useState, useEffect, useCallback } from "react";
import { getFantasyLeaderboard, type FantasyTeamSummary, type TournamentListItem } from "../api";
import { StandingsList } from "../components/StandingsList";
import { MatchSquad } from "../components/MatchSquad";
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
  const [lbLoading, setLbLoading] = useState(true);
  const [squadLoaded, setSquadLoaded] = useState(false);
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
      setLbLoading(false);
    }
  }, [leagueId, tid]);

  useEffect(() => {
    setLbLoading(true);
    setSquadLoaded(false);
    refresh();
  }, [refresh]);

  // Silent re-fetch on sim tick (no loading spinner)
  useEffect(() => {
    if (simTick > 0) refresh();
  }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentWeekIdx = tournaments.findIndex((t) => t.id === currentTournamentId);
  const isFuture = viewingWeek > currentWeekIdx;
  const loading = lbLoading || !squadLoaded;

  return (
    <div>
      {/* MatchSquad always mounted so it fetches in parallel, hidden until both ready */}
      <div style={{ display: loading ? "none" : undefined }}>
        {tid && (
          <MatchSquad
            leagueId={leagueId}
            teamId={myTeamId}
            colors={C}
            tournamentId={tid}
            tournamentColor={tournaments[viewingWeek]?.color}
            simTick={simTick}
            onLoaded={() => setSquadLoaded(true)}
          />
        )}
        <div style={{ padding: "12px 16px 100px" }}>
          {error ? (
            <div style={{ background: C.redDim, color: C.red, padding: "12px 16px", borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          ) : (
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
          )}
        </div>
      </div>
      {loading && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      )}
    </div>
  );
}
