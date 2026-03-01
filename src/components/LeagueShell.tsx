import type { Theme } from "../theme";
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
  return (
    <>
      <LeagueHeader leagueId={leagueId} isDark={isDark} colors={C} onToggleTheme={onToggleTheme} onBack={onBack} />
      <PageContent page={activePage} leagueId={leagueId} colors={C} />
      <BottomNav activePage={activePage} colors={C} onChangePage={onChangePage} />
    </>
  );
}
