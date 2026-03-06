import type { Theme } from "../theme";
import type { TournamentListItem } from "../api";
import { Home } from "../pages/Home";
import { Roster } from "../pages/Roster";
import { Golfers } from "../pages/Golfers";
import { LeagueStandings } from "../pages/League";
import { Chat } from "../pages/Chat";

interface PageContentProps {
  page: string;
  leagueId: number;
  myTeamId: number;
  colors: Theme;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  onChangeWeek: (week: number) => void;
  simTick: number;
}

export function PageContent({ page, leagueId, myTeamId, colors: C, tournaments, currentTournamentId, viewingWeek, onChangeWeek, simTick }: PageContentProps) {

  switch (page) {
    case "match":
      return (
        <div style={{ flex: 1 }}>
          <Home leagueId={leagueId} myTeamId={myTeamId} colors={C} tournaments={tournaments} currentTournamentId={currentTournamentId} viewingWeek={viewingWeek} simTick={simTick} />
        </div>
      );
    case "scorecard":
      return (
        <div style={{ flex: 1 }}>
          <Roster
            leagueId={leagueId}
            teamId={myTeamId}
            colors={C}
            tournaments={tournaments}
            currentTournamentId={currentTournamentId}
            viewingWeek={viewingWeek}
            onChangeWeek={onChangeWeek}
            isMajor={tournaments[viewingWeek]?.isMajor ?? false}
            simTick={simTick}
          />
        </div>
      );
    case "golfers":
      return (
        <div style={{ flex: 1 }}>
          <Golfers leagueId={leagueId} teamId={myTeamId} colors={C} simTick={simTick} />
        </div>
      );
    case "league":
      return (
        <div style={{ flex: 1 }}>
          <LeagueStandings leagueId={leagueId} myTeamId={myTeamId} colors={C} simTick={simTick} />
        </div>
      );
    case "chat":
      return (
        <div style={{ flex: 1 }}>
          <Chat leagueId={leagueId} teamId={myTeamId} colors={C} />
        </div>
      );
    default:
      return (
        <div style={{ flex: 1, padding: "20px 16px 100px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minHeight: 300,
              borderRadius: 14,
              border: `2px dashed ${C.border}`,
              background: C.card,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ color: C.txt, fontSize: 18, fontWeight: 600, margin: "0 0 4px", textTransform: "capitalize" }}>{page}</p>
              <p style={{ color: C.txt3, fontSize: 13, margin: 0 }}>Coming soon</p>
            </div>
          </div>
        </div>
      );
  }
}
