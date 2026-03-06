import { useState, useEffect, useCallback, useRef } from "react";
import { getRoster, setLineup, getFantasyLeaderboard, getLeagues, getLeagueInfo, type RosterPlayer, type RosterData, type TournamentListItem, type LeagueInfo } from "../api";
import { PlayerModal } from "../components/PlayerModal";
import { ManagerIcon } from "../components/ManagerIcon";
import type { Theme } from "../theme";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

interface RosterProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  onChangeWeek: (week: number) => void;
  isMajor: boolean;
  simTick: number;
}

interface CachedWeek {
  data: RosterData;
  rank: { myRank: number; myRankTied: boolean; myPoints: number; totalTeams: number; projectedTotal: number; rivalAbove: { name: string; points: number; rank: number } | null; rivalBelow: { name: string; points: number; rank: number } | null } | null;
}

export function Roster({ leagueId, teamId, colors: C, tournaments, currentTournamentId, viewingWeek, onChangeWeek: _onChangeWeek, isMajor: _isMajor, simTick }: RosterProps) {
  const [data, setData] = useState<RosterData | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [reserve, setReserve] = useState<RosterPlayer[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);
  const [myRank, setMyRank] = useState(0);
  const [, setMyRankTied] = useState(false);
  const [totalTeams, setTotalTeams] = useState(0);
  const [myPoints, setMyPoints] = useState(0);
  const [rivalAbove, setRivalAbove] = useState<{ name: string; points: number; rank: number } | null>(null);
  const [rivalBelow, setRivalBelow] = useState<{ name: string; points: number; rank: number } | null>(null);
  const [projectedTotal, setProjectedTotal] = useState(0);
  const [seasonRank, setSeasonRank] = useState(0);
  const [seasonRankTied, setSeasonRankTied] = useState(false);
  const [, setSeasonPoints] = useState(0);
  const cacheRef = useRef(new Map<string, CachedWeek>());
  const initialLoadRef = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const silentRef = useRef(false);
  const [viewingTeamId, setViewingTeamId] = useState(teamId);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [members, setMembers] = useState<LeagueInfo["members"]>([]);
  const teamDropdownRef = useRef<HTMLDivElement>(null);

  const applyData = useCallback((d: RosterData, rankData: CachedWeek["rank"]) => {
    setData(d);
    setRoster(d.roster);
    setReserve(d.reserve);
    setLocked(d.locked);
    setError(null);
    const weekPts = d.roster.filter((p) => p.isActive).reduce((sum, p) => sum + p.points, 0);
    setMyPoints(weekPts);
    if (rankData) {
      setMyRank(rankData.myRank);
      setMyRankTied(rankData.myRankTied);
      setTotalTeams(rankData.totalTeams);
      setProjectedTotal(rankData.projectedTotal);
      setRivalAbove(rankData.rivalAbove);
      setRivalBelow(rankData.rivalBelow);
    } else {
      setMyRank(0);
      setMyRankTied(false);
      setTotalTeams(0);
      setProjectedTotal(0);
      setRivalAbove(null);
      setRivalBelow(null);
    }
  }, []);

  const refresh = useCallback(async () => {
    const tid = tournaments[viewingWeek]?.id;
    if (tid == null) return;
    const currentWeekIdx = tournaments.findIndex((t) => t.id === currentTournamentId);
    const isCurrentWeek = viewingWeek === currentWeekIdx;
    const cacheKey = `${tid}:${viewingTeamId}`;
    const cached = cacheRef.current.get(cacheKey);

    // Cancel any in-flight request
    abortRef.current?.abort();

    // Cache hit for past/future week — use cached data, skip fetch
    if (cached && !isCurrentWeek) {
      applyData(cached.data, cached.rank);
      setLoading(false);
      setFetching(false);
      return;
    }

    // Cache hit for current week — show cached data immediately, fetch in background
    if (cached && isCurrentWeek) {
      applyData(cached.data, cached.rank);
      setLoading(false);
    }

    // No cache — show fetching overlay (skip on initial load and silent sim refreshes)
    if (!cached) {
      if (!initialLoadRef.current && !silentRef.current) setFetching(true);
    }
    silentRef.current = false;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const [d, lb] = await Promise.all([
        getRoster(leagueId, viewingTeamId, tid, { signal: controller.signal }),
        getFantasyLeaderboard(leagueId, tid, { signal: controller.signal }),
      ]);

      // If aborted while awaiting, don't apply stale data
      if (controller.signal.aborted) return;

      let rankData: CachedWeek["rank"] = null;
      if (lb) {
        const hasScores = lb.teams.some(t => t.totalPoints !== 0);
        if (hasScores) {
          const sorted = lb.teams;
          const myIdx = sorted.findIndex(t => t.teamId === viewingTeamId);
          if (myIdx >= 0) {
            type Rival = { name: string; points: number; rank: number } | null;
            const myPts = sorted[myIdx].totalPoints;
            // Find rival above: skip teams with same points (tied)
            let above: Rival = null;
            for (let i = myIdx - 1; i >= 0; i--) {
              if (sorted[i].totalPoints !== myPts) {
                above = { name: sorted[i].teamName, points: sorted[i].totalPoints, rank: i + 1 };
                break;
              }
            }
            // Find rival below: skip teams with same points (tied)
            let below: Rival = null;
            for (let i = myIdx + 1; i < sorted.length; i++) {
              if (sorted[i].totalPoints !== myPts) {
                below = { name: sorted[i].teamName, points: sorted[i].totalPoints, rank: i + 1 };
                break;
              }
            }
            const myTeamLb = sorted[myIdx];
            const projTotal = myTeamLb.projectedRoundPoints.reduce((a, b) => a + b, 0);
            const tied = sorted.filter((t) => t.totalPoints === myPts).length > 1;
            rankData = {
              myRank: sorted.findIndex((t) => t.totalPoints === myPts) + 1,
              myRankTied: tied,
              myPoints: d.roster.filter((p) => p.isActive).reduce((sum, p) => sum + p.points, 0),
              totalTeams: sorted.length,
              projectedTotal: projTotal,
              rivalAbove: above,
              rivalBelow: below,
            };
          }
        }
      }

      cacheRef.current.set(cacheKey, { data: d, rank: rankData });
      applyData(d, rankData);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
        setFetching(false);
        initialLoadRef.current = false;
      }
    }
  }, [leagueId, teamId, viewingTeamId, viewingWeek, tournaments, currentTournamentId, applyData]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Silent re-fetch on sim tick (no loading/fetching spinner), invalidate current-week cache first
  useEffect(() => {
    if (simTick > 0) {
      const currentWeekIdx = tournaments.findIndex((t) => t.id === currentTournamentId);
      const currentTid = tournaments[currentWeekIdx]?.id;
      if (currentTid != null) {
        for (const key of cacheRef.current.keys()) {
          if (key.startsWith(`${currentTid}:`)) cacheRef.current.delete(key);
        }
      }
      silentRef.current = true;
      refresh();
    }
  }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch season rank/points on mount and when week changes (data may update after completing a week)
  useEffect(() => {
    getLeagues().then((leagues) => {
      const mine = leagues.find((l) => l.id === leagueId);
      if (mine) {
        setSeasonRank(mine.rank);
        setSeasonRankTied(mine.rankTied);
        setSeasonPoints(mine.points);
      }
    }).catch(() => {});
  }, [leagueId, viewingWeek]);

  // Fetch league members for team dropdown
  useEffect(() => {
    getLeagueInfo(leagueId).then((info) => setMembers(info.members)).catch(() => {});
  }, [leagueId]);

  // Reset viewingTeamId when own team changes (league switch)
  useEffect(() => {
    setViewingTeamId(teamId);
    setTeamDropdownOpen(false);
  }, [teamId]);

  // Outside-click to close team dropdown
  useEffect(() => {
    if (!teamDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [teamDropdownOpen]);

  const settings = data?.settings;
  const activeSize = settings?.activeSize ?? 5;
  const rosterSize = settings?.rosterSize ?? 12;
  const reserveSize = settings?.reserveSize ?? 3;
  const benchSize = rosterSize - activeSize;

  const autoSave = (newRoster: RosterPlayer[]) => {
    if (viewingTeamId !== teamId) return;
    const activeIds = newRoster.filter((p) => p.isActive).map((p) => p.playerId);
    if (activeIds.length !== activeSize) return;
    const tid = tournaments[viewingWeek]?.id;
    if (tid != null) cacheRef.current.delete(`${tid}:${viewingTeamId}`);
    setLineup(leagueId, teamId, activeIds, tid).catch((e) => {
      setError(e instanceof Error ? e.message : "Failed to save lineup");
    });
  };

  const handleMoveBtn = (playerId: number) => {
    if (locked) return;

    // Toggle off if same player
    if (moving === playerId) { setMoving(null); return; }

    // No active move — start one
    if (moving === null) { setMoving(playerId); return; }

    // Complete the swap
    const selInRoster = roster.find((p) => p.playerId === moving);
    const selInReserve = reserve.find((p) => p.playerId === moving);
    const tgtInRoster = roster.find((p) => p.playerId === playerId);
    const tgtInReserve = reserve.find((p) => p.playerId === playerId);

    if (!(selInRoster || selInReserve) || !(tgtInRoster || tgtInReserve)) {
      setMoving(null);
      return;
    }

    if (selInRoster && tgtInRoster) {
      if (selInRoster.isActive !== tgtInRoster.isActive) {
        const newRoster = roster.map((p) => {
          if (p.playerId === moving) return { ...p, isActive: tgtInRoster.isActive };
          if (p.playerId === playerId) return { ...p, isActive: selInRoster.isActive };
          return p;
        });
        setRoster(newRoster);
        autoSave(newRoster);
      } else {
        const newRoster = [...roster];
        const i = newRoster.findIndex((p) => p.playerId === moving);
        const j = newRoster.findIndex((p) => p.playerId === playerId);
        [newRoster[i], newRoster[j]] = [newRoster[j], newRoster[i]];
        setRoster(newRoster);
        autoSave(newRoster);
      }
    } else if (selInReserve && tgtInReserve) {
      const newReserve = [...reserve];
      const i = newReserve.findIndex((p) => p.playerId === moving);
      const j = newReserve.findIndex((p) => p.playerId === playerId);
      [newReserve[i], newReserve[j]] = [newReserve[j], newReserve[i]];
      setReserve(newReserve);
    } else {
      const rosterPlayer = (selInRoster || tgtInRoster)!;
      const reservePlayer = (selInReserve || tgtInReserve)!;
      const newRoster = roster.map((p) =>
        p.playerId === rosterPlayer.playerId
          ? { ...reservePlayer, isActive: rosterPlayer.isActive }
          : p
      );
      const newReserve = reserve.map((p) =>
        p.playerId === reservePlayer.playerId ? { ...rosterPlayer, isActive: false } : p
      );
      setRoster(newRoster);
      setReserve(newReserve);
      autoSave(newRoster);
    }
    setMoving(null);
  };

  const handleEmptySlotDrop = (section: "active" | "bench" | "reserve") => {
    if (locked || moving === null) return;

    const selInRoster = roster.find((p) => p.playerId === moving);
    const selInReserve = reserve.find((p) => p.playerId === moving);
    const player = selInRoster || selInReserve;
    if (!player) { setMoving(null); return; }

    if (section === "reserve") {
      if (selInReserve) { setMoving(null); return; }
      const newRoster = roster.filter((p) => p.playerId !== moving);
      const newReserve = [{ ...player, isActive: false }, ...reserve];
      setRoster(newRoster);
      setReserve(newReserve);
      autoSave(newRoster);
    } else {
      const wantActive = section === "active";
      if (selInRoster) {
        if (player.isActive === wantActive) { setMoving(null); return; }
        if (wantActive && roster.filter((p) => p.isActive).length >= activeSize) {
          setMoving(null);
          return;
        }
        const updated = roster.map((p) =>
          p.playerId === moving ? { ...p, isActive: wantActive } : p
        );
        setRoster(updated);
        autoSave(updated);
      } else {
        if (wantActive && roster.filter((p) => p.isActive).length >= activeSize) {
          setMoving(null);
          return;
        }
        const newRoster = [{ ...player, isActive: wantActive }, ...roster];
        const newReserve = reserve.filter((p) => p.playerId !== moving);
        setRoster(newRoster);
        setReserve(newReserve);
        autoSave(newRoster);
      }
    }
    setMoving(null);
  };

  const activePlayers = roster.filter((p) => p.isActive).sort((a, b) => a.ranking - b.ranking);
  const benchPlayers = roster.filter((p) => !p.isActive).sort((a, b) => a.ranking - b.ranking);
  const sortedReserve = [...reserve].sort((a, b) => a.ranking - b.ranking);
  const emptyActive = Math.max(0, activeSize - activePlayers.length);
  const movingIsActive = moving !== null && roster.find((p) => p.playerId === moving)?.isActive;
  const emptyBench = Math.max(0, benchSize - benchPlayers.length) || (movingIsActive ? 1 : 0);
  const emptyReserve = Math.max(0, reserveSize - reserve.length);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  const colStyle: React.CSSProperties = { color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };

  const sectionHeader = (label: string, extra?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", padding: "20px 16px 8px" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <p style={{ ...colStyle, margin: 0, whiteSpace: "nowrap" }}>{label}</p>
        {extra}
      </div>
      <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, marginRight: 15 }}>
        {["R1", "R2", "R3", "R4"].map((l) => (
          <div key={l} style={{ width: COL.r, textAlign: "center" }}><span style={colStyle}>{l}</span></div>
        ))}
        <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PTS</span></div>
      </div>
    </div>
  );

  const currentWeekIndex = tournaments.findIndex((t) => t.id === currentTournamentId);
  const isPastWeek = viewingWeek < currentWeekIndex;
  const isFutureWeek = viewingWeek > currentWeekIndex;
  const isOwnTeam = viewingTeamId === teamId;
  const canMove = !locked && !isPastWeek && isOwnTeam;
  const par = tournaments[viewingWeek]?.par ?? 72;
  const viewedMember = members.find((m) => m.teamId === viewingTeamId);
  const firstName = viewedMember?.managerName?.split(" ")[0] ?? "";

  // Team round totals from active roster
  const teamRoundPoints = [0, 1, 2, 3].map((ri) =>
    roster.filter((p) => p.isActive).reduce((sum, p) => sum + (p.roundPoints[ri] ?? 0), 0)
  );
  const teamProjRoundPoints = [0, 1, 2, 3].map((ri) =>
    roster.filter((p) => p.isActive).reduce((sum, p) => sum + (p.projectedRoundPoints?.[ri] ?? 0), 0)
  );

  return (
    <div style={{ position: "relative" }}>
      {fetching && !loading && (
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 10,
          background: `${C.bg}88`,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: 80,
        }}>
          <div style={{ width: 24, height: 24, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
        </div>
      )}
      {error && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ background: C.redDim, color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        </div>
      )}

      {/* Active lineup */}
      <div style={{ background: `${tournaments[viewingWeek]?.color ?? "#003C80"}15` }}>
        {/* Summary card */}
        {data && (
          <div style={{ padding: "12px 16px 0" }}>
            {/* SQUAD header with R1-R4 + PTS columns */}
            <div style={{ display: "flex", alignItems: "center", padding: "0 0 8px" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <p style={{ ...colStyle, margin: 0, whiteSpace: "nowrap" }}>Squad ({activePlayers.length}/{activeSize})</p>
              </div>
              <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, marginRight: 15 }}>
                {["R1", "R2", "R3", "R4"].map((l) => (
                  <div key={l} style={{ width: COL.r, textAlign: "center" }}><span style={colStyle}>{l}</span></div>
                ))}
                <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PTS</span></div>
              </div>
            </div>
            <div style={{
              background: C.card,
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: "14px 16px",
              marginBottom: 6,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                  {/* Icon with season rank badge offset top-left */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <ManagerIcon size={42} bgColor={data.color ?? "#2D6B4A"} />
                    {isOwnTeam && seasonRank > 0 && (
                      <span style={{
                        position: "absolute",
                        top: -4,
                        left: -6,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 20,
                        height: 18,
                        borderRadius: 5,
                        background: C.goldDim,
                        color: C.gold,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "0 4px",
                        border: `1px solid ${C.gold}`,
                      }}>{seasonRankTied ? "T" : ""}{seasonRank}</span>
                    )}
                  </div>
                  <div style={{ position: "relative", minWidth: 0, flex: 1 }} ref={teamDropdownRef}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setTeamDropdownOpen(!teamDropdownOpen); }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "baseline", gap: 4, maxWidth: "100%", minWidth: 0 }}
                    >
                      <p style={{ fontSize: 20, fontWeight: 700, color: C.txt, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{data.teamName}</p>
                      <span style={{ fontSize: 10, color: C.txt3, flexShrink: 0 }}>{teamDropdownOpen ? "▲" : "▼"}</span>
                    </button>
                    {firstName && (
                      <p style={{ fontSize: 12, fontWeight: 500, color: C.txt2, margin: "2px 0 0" }}>{firstName}</p>
                    )}
                    {teamDropdownOpen && (
                      <div style={{
                        position: "absolute",
                        top: "100%",
                        left: -52,
                        zIndex: 50,
                        background: C.card,
                        border: `1px solid ${C.border}`,
                        borderRadius: 10,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                        maxHeight: 300,
                        overflowY: "auto",
                        minWidth: 240,
                        marginTop: 6,
                      }}>
                        {members.map((m, i) => (
                          <div
                            key={m.teamId}
                            onClick={(e) => { e.stopPropagation(); setViewingTeamId(m.teamId); setTeamDropdownOpen(false); }}
                            style={{
                              padding: "10px 14px",
                              cursor: "pointer",
                              background: m.teamId === viewingTeamId ? `${m.color ?? C.green}20` : "transparent",
                              borderBottom: i < members.length - 1 ? `1px solid ${C.border}` : "none",
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <ManagerIcon size={28} bgColor={m.color ?? "#2D6B4A"} />
                            <div>
                              <p style={{ fontSize: 14, fontWeight: m.teamId === viewingTeamId ? 600 : 400, color: C.txt, margin: 0 }}>{m.teamName}</p>
                              <p style={{ fontSize: 11, color: C.txt2, margin: 0 }}>{m.managerName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
                  {[0, 1, 2, 3].map((ri) => {
                    const pts = teamRoundPoints[ri];
                    const proj = teamProjRoundPoints[ri];
                    const played = pts != null && pts !== 0;
                    return (
                      <div key={ri} style={{ width: COL.r, textAlign: "center" }}>
                        <p style={{ fontSize: 12, fontWeight: 600, color: played ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                          {played ? pts : "-"}
                        </p>
                        <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
                          {played ? proj : proj ? `${proj}` : "-"}
                        </p>
                      </div>
                    );
                  })}
                  <div style={{ width: COL.p, textAlign: "right" }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.txt, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>{myPoints}</p>
                    <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3, textAlign: "right" }}>
                      {projectedTotal > 0 ? `${projectedTotal}` : "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {isFutureWeek ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: C.txt3 }}>No leaderboard yet</span>
                    </div>
                    <div style={{ fontSize: 13, height: 18 }} />
                  </>
                ) : myRank > 0 ? (
                  <>
                    {/* Row 1: rival above or leader badge */}
                    {rivalAbove ? (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: C.txt2 }}>▲ {ordinal(rivalAbove.rank)} · {rivalAbove.name}</span>
                        <span style={{ color: C.txt3 }}>+{rivalAbove.points - myPoints} pts · <span style={{ color: C.txt2 }}>{rivalAbove.points}</span></span>
                      </div>
                    ) : myRank === 1 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <span style={{ color: C.txt2, fontSize: 10 }}>●</span>
                        <span style={{ color: C.txt2 }}>You are the current leader!</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, height: 18 }} />
                    )}
                    {/* Row 2: rival below or last place badge */}
                    {rivalBelow ? (
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: C.txt2 }}>▼ {ordinal(rivalBelow.rank)} · {rivalBelow.name}</span>
                        <span style={{ color: C.txt3 }}>-{myPoints - rivalBelow.points} pts · <span style={{ color: C.txt2 }}>{rivalBelow.points}</span></span>
                      </div>
                    ) : myRank === totalTeams && totalTeams > 1 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                        <span style={{ color: C.txt3, fontSize: 10 }}>■</span>
                        <span style={{ color: C.txt3 }}>You are currently last place</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, height: 18 }} />
                    )}
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: C.txt3 }}>No leaderboard yet</span>
                    </div>
                    <div style={{ fontSize: 13, height: 18 }} />
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        <div style={{ padding: "0 16px 6px" }}>

          {activePlayers.map((p) => (
            <PlayerCard key={p.playerId} player={p} par={par} colors={C} moving={moving === p.playerId} disabled={!canMove} onMove={() => handleMoveBtn(p.playerId)} onTap={() => setModalPlayerId(p.playerId)} />
          ))}
          {Array.from({ length: emptyActive }).map((_, i) => (
            <EmptySlot key={`ea-${i}`} label="Active" colors={C} highlight={moving !== null} warn={!isFutureWeek && !isPastWeek && canMove && moving === null} onClick={() => handleEmptySlotDrop("active")} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <div style={{ background: C.card }}>
        {sectionHeader(`Bench (${benchPlayers.length}/${benchSize})`)}
        <div style={{ padding: "0 16px 16px" }}>

          {benchPlayers.map((p) => (
            <PlayerCard key={p.playerId} player={p} par={par} colors={C} moving={moving === p.playerId} disabled={!canMove} onMove={() => handleMoveBtn(p.playerId)} onTap={() => setModalPlayerId(p.playerId)} />
          ))}
          {Array.from({ length: emptyBench }).map((_, i) => (
            <EmptySlot key={`eb-${i}`} label="Bench" colors={C} highlight={moving !== null} onClick={() => handleEmptySlotDrop("bench")} />
          ))}
        </div>
      </div>

      {/* Reserve */}
      <div style={{ background: C.bg }}>
        {sectionHeader(`Reserve (${sortedReserve.length}/${reserveSize})`)}
        <div style={{ padding: "0 16px 100px" }}>

          {sortedReserve.map((p) => (
            <PlayerCard key={p.playerId} player={p} par={par} colors={C} moving={moving === p.playerId} disabled={!canMove} onMove={() => handleMoveBtn(p.playerId)} onTap={() => setModalPlayerId(p.playerId)} />
          ))}
          {Array.from({ length: emptyReserve }).map((_, i) => (
            <EmptySlot key={`er-${i}`} label="Reserve" colors={C} highlight={moving !== null} onClick={() => handleEmptySlotDrop("reserve")} />
          ))}
        </div>
      </div>

      {modalPlayerId !== null && (
        <PlayerModal playerId={modalPlayerId} leagueId={leagueId} colors={C} onClose={() => setModalPlayerId(null)} />
      )}
    </div>
  );
}

export function WeekNav({
  tournaments,
  viewingWeek,
  currentWeekIndex,
  onChangeWeek,
  colors: C,
}: {
  tournaments: TournamentListItem[];
  viewingWeek: number;
  currentWeekIndex: number;
  onChangeWeek: (week: number) => void;
  colors: Theme;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isCurrent = viewingWeek === currentWeekIndex;

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 44,
          padding: "0 16px",
          background: "transparent",
        }}
      >
        {/* Left arrow */}
        <button
          onClick={() => onChangeWeek(viewingWeek - 1)}
          disabled={viewingWeek <= 0}
          style={{
            background: "none",
            border: "none",
            width: 22,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: viewingWeek <= 0 ? "default" : "pointer",
            color: viewingWeek <= 0 ? C.txt3 : C.txt2,
            fontSize: 20,
            lineHeight: 1,
            opacity: viewingWeek <= 0 ? 0.4 : 1,
          }}
        >
          ‹
        </button>

        {/* Center label */}
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          style={{
            background: "none",
            border: "none",
            padding: "4px 12px",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: 600,
            color: C.txt,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Week {viewingWeek + 1}</span>
          {tournaments[viewingWeek]?.isMajor && <span style={{ color: C.gold }}>★</span>}
          {isCurrent && <span style={{ color: C.green }}>(current)</span>}
          <span style={{ fontSize: 10, color: C.txt3, marginLeft: 2 }}>{dropdownOpen ? "▲" : "▼"}</span>
        </button>

        {/* Right arrow */}
        <button
          onClick={() => onChangeWeek(viewingWeek + 1)}
          disabled={viewingWeek >= tournaments.length - 1}
          style={{
            background: "none",
            border: "none",
            width: 22,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: viewingWeek >= tournaments.length - 1 ? "default" : "pointer",
            color: viewingWeek >= tournaments.length - 1 ? C.txt3 : C.txt2,
            fontSize: 20,
            lineHeight: 1,
            opacity: viewingWeek >= tournaments.length - 1 ? 0.4 : 1,
          }}
        >
          ›
        </button>
      </div>

      {/* Dropdown overlay */}
      {dropdownOpen && (
        <div
          style={{
            position: "absolute",
            top: 44,
            left: 0,
            right: 0,
            zIndex: 50,
            background: C.card,
            border: `1px solid ${C.border}`,
            borderTop: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxHeight: 300,
            overflowY: "auto",
          }}
        >
          {tournaments.map((t, i) => {
            const isCurrentWeek = i === currentWeekIndex;
            const isSelected = i === viewingWeek;
            return (
              <div
                key={t.id}
                onClick={() => { onChangeWeek(i); setDropdownOpen(false); }}
                style={{
                  padding: "12px 16px",
                  cursor: "pointer",
                  background: isSelected ? `${t.color ?? "#003C80"}20` : "transparent",
                  borderBottom: i < tournaments.length - 1 ? `1px solid ${C.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: C.txt }}>
                  Week {i + 1} — {t.name}
                </span>
                {t.isMajor && <span style={{ color: C.gold, fontSize: 13 }}>★</span>}
                {isCurrentWeek && (
                  <span style={{ fontSize: 11, color: C.green, fontWeight: 600 }}>(current)</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Column widths shared between headers and card data
const COL = { r: 26, p: 46, gap: 2 };


function EmptySlot({ label, colors: C, highlight, warn, onClick }: { label: string; colors: Theme; highlight?: boolean; warn?: boolean; onClick?: () => void }) {
  const borderColor = highlight ? C.green : warn ? C.red : C.border;
  const textColor = highlight ? C.green : warn ? C.red : C.txt3;
  return (
    <div
      onClick={highlight ? onClick : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "10px 14px",
        minHeight: 58,
        borderRadius: 10,
        border: `2px dashed ${borderColor}`,
        marginBottom: 6,
        boxSizing: "border-box",
        cursor: highlight ? "pointer" : "default",
        opacity: highlight || warn ? 1 : 0.5,
      }}
    >
      <span style={{ fontSize: 13, color: textColor }}>{highlight ? "Move here" : `Empty ${label} Slot`}</span>
    </div>
  );
}

function PlayerCard({
  player: p,
  par: _par,
  colors: C,
  moving,
  disabled,
  onMove,
  onTap,
}: {
  player: RosterPlayer;
  par: number;
  colors: Theme;
  moving: boolean;
  disabled: boolean;
  onMove: () => void;
  onTap: () => void;
}) {
  const btnSize = 36;
  const hasRounds = p.rounds.length > 0;

  return (
    <div
      onClick={onTap}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        minHeight: 58,
        boxSizing: "border-box",
        background: C.card,
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        marginBottom: 6,
        cursor: "pointer",
      }}
    >
      {/* Move button */}
      <button
        onClick={(e) => { e.stopPropagation(); if (!disabled) onMove(); }}
        disabled={disabled}
        style={{
          width: btnSize,
          height: btnSize,
          flexShrink: 0,
          marginRight: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
          border: `1.5px solid ${moving ? C.green : C.border}`,
          background: moving ? C.greenDim : "transparent",
          cursor: disabled ? "default" : "pointer",
          padding: 0,
          opacity: disabled ? 0.35 : 1,
        }}
      >
        {disabled ? (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke={C.txt3} strokeWidth="1.5" />
            <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke={C.txt3} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M8 2L5 5M8 2l3 3M8 14L5 11M8 14l3-3" stroke={moving ? C.green : C.txt3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Player info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
        <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
          <span style={{ fontSize: 11, color: C.txt3 }}>#{p.ranking}</span>
          <span style={{ fontSize: 11, color: C.txt3 }}>{p.country}</span>
          {!p.inField && (
            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>NOT IN FIELD</span>
          )}
          {p.status === "cut" && (
            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>CUT</span>
          )}
          {p.status === "wd" && (
            <span style={{ fontSize: 10, color: C.red, fontWeight: 600 }}>WD</span>
          )}
        </div>
      </div>

      {/* Data columns: R1 R2 R3 R4 | PTS */}
      <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
        {/* R1–R4 */}
        {[0, 1, 2, 3].map((i) => {
          const rPts = p.roundPoints[i];
          const proj = p.projectedRoundPoints[i];
          const played = rPts != null && rPts !== 0;
          return (
            <div key={i} style={{ width: COL.r, textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: played ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
                {played ? rPts : "-"}
              </p>
              <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
                {played ? proj : proj ? `${proj}` : "-"}
              </p>
            </div>
          );
        })}

        {/* PTS */}
        {(() => {
          const projTotal = p.projectedRoundPoints.length > 0
            ? p.projectedRoundPoints.reduce((a, b) => a + b, 0)
            : 0;
          return (
            <div style={{ width: COL.p, textAlign: "right" }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: hasRounds ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                {hasRounds ? p.points : "-"}
              </p>
              <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3, textAlign: "right" }}>
                {projTotal > 0 ? `${projTotal}` : "-"}
              </p>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
