import { useState, useEffect, useCallback } from "react";
import type { Theme } from "../theme";
import type { TournamentListItem } from "../api";
import { getTournamentList, getLeagues } from "../api";
import { LeagueHeader } from "./LeagueHeader";
import { PageContent } from "./PageContent";
import { BottomNav } from "./BottomNav";
import { PullToRefresh } from "./PullToRefresh";

interface LeagueShellProps {
  leagueId: number;
  activePage: string;
  isDark: boolean;
  colors: Theme;
  onToggleTheme: () => void;
  onBack: () => void;
  onChangePage: (id: string) => void;
}

export function LeagueShell({ leagueId, activePage, isDark, colors: C, onToggleTheme, onBack, onChangePage }: LeagueShellProps) {
  const [tournaments, setTournaments] = useState<TournamentListItem[]>([]);
  const [currentTournamentId, setCurrentTournamentId] = useState<number>(0);
  const [viewingWeek, setViewingWeek] = useState<number>(0);
  const [myTeamId, setMyTeamId] = useState<number | null>(null);
  const [seasonPoints, setSeasonPoints] = useState(0);

  useEffect(() => {
    getTournamentList().then((list) => {
      setTournaments(list);
      const current = list.find((t) => t.current) || list[0];
      if (current) {
        setCurrentTournamentId(current.id);
        const idx = list.findIndex((t) => t.id === current.id);
        setViewingWeek(idx >= 0 ? idx : 0);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    getLeagues().then((leagues) => {
      const league = leagues.find((l) => l.id === leagueId);
      if (league) {
        setMyTeamId(league.myTeamId);
        setSeasonPoints(league.points);
      }
    }).catch(() => {});
  }, [leagueId]);

  const viewedTournament = tournaments[viewingWeek] || null;

  const fullRefresh = useCallback(async () => {
    window.location.reload();
  }, []);

  if (myTeamId === null) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 12 }}>
        <div style={{
          width: 32, height: 32,
          border: `3px solid ${C.border}`,
          borderTopColor: C.green,
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }} />
        <p style={{ color: C.txt2, fontSize: 13, margin: 0 }}>Loading league...</p>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fullRefresh} colors={C}>
      <LeagueHeader
        leagueId={leagueId}
        isDark={isDark}
        colors={C}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        viewedTournament={viewedTournament}
        activePage={activePage}
        tournaments={tournaments}
        currentTournamentId={currentTournamentId}
        viewingWeek={viewingWeek}
        onChangeWeek={setViewingWeek}
        seasonPoints={seasonPoints}
      />
      <PageContent
        page={activePage}
        leagueId={leagueId}
        myTeamId={myTeamId}
        colors={C}
        tournaments={tournaments}
        currentTournamentId={currentTournamentId}
        viewingWeek={viewingWeek}
        onChangeWeek={setViewingWeek}
      />
      <BottomNav activePage={activePage} colors={C} onChangePage={onChangePage} />
    </PullToRefresh>
  );
}
