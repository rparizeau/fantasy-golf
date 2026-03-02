import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import type { TournamentListItem } from "../api";
import { getTournamentList } from "../api";
import { LeagueHeader } from "./LeagueHeader";
import { PageContent } from "./PageContent";
import { BottomNav } from "./BottomNav";

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

  const viewedTournament = tournaments[viewingWeek] || null;

  return (
    <>
      <LeagueHeader
        leagueId={leagueId}
        isDark={isDark}
        colors={C}
        onToggleTheme={onToggleTheme}
        onBack={onBack}
        viewedTournament={viewedTournament}
      />
      <PageContent
        page={activePage}
        leagueId={leagueId}
        colors={C}
        tournaments={tournaments}
        currentTournamentId={currentTournamentId}
        viewingWeek={viewingWeek}
        onChangeWeek={setViewingWeek}
      />
      <BottomNav activePage={activePage} colors={C} onChangePage={onChangePage} />
    </>
  );
}
