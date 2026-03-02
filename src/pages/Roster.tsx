import { useState, useEffect, useCallback, useRef } from "react";
import { getRoster, setLineup, type RosterPlayer, type RosterData, type TournamentListItem } from "../api";
import { PlayerModal } from "../components/PlayerModal";
import type { Theme } from "../theme";

interface RosterProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
  tournaments: TournamentListItem[];
  currentTournamentId: number;
  viewingWeek: number;
  onChangeWeek: (week: number) => void;
  isMajor: boolean;
}

export function Roster({ leagueId, teamId, colors: C, tournaments, currentTournamentId, viewingWeek, onChangeWeek: _onChangeWeek, isMajor }: RosterProps) {
  const [data, setData] = useState<RosterData | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [reserve, setReserve] = useState<RosterPlayer[]>([]);
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);
  const [moving, setMoving] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const tid = tournaments[viewingWeek]?.id;
      const d = await getRoster(leagueId, teamId, tid);
      setData(d);
      setRoster(d.roster);
      setReserve(d.reserve);
      setLocked(d.locked);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId, viewingWeek, tournaments]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const settings = data?.settings;
  const activeSize = settings?.activeSize ?? 5;
  const rosterSize = settings?.rosterSize ?? 12;
  const reserveSize = settings?.reserveSize ?? 3;
  const benchSize = rosterSize - activeSize;

  const autoSave = (newRoster: RosterPlayer[]) => {
    const activeIds = newRoster.filter((p) => p.isActive).map((p) => p.playerId);
    if (activeIds.length !== activeSize) return;
    setLineup(leagueId, teamId, activeIds).catch((e) => {
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
  const emptyBench = Math.max(0, benchSize - benchPlayers.length);
  const emptyReserve = Math.max(0, reserveSize - reserve.length);

  if (loading) {
    return (
      <div style={{ padding: "12px 16px 100px" }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            style={{
              background: C.card,
              borderRadius: 10,
              height: 60,
              marginBottom: 6,
              border: `1px solid ${C.border}`,
              animation: "pulse 2s infinite",
            }}
          />
        ))}
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
        <div style={{ width: COL.s, textAlign: "center" }}><span style={colStyle}>TOT</span></div>
        <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PURSE</span></div>
      </div>
    </div>
  );

  const currentWeekIndex = tournaments.findIndex((t) => t.id === currentTournamentId);
  const isPastWeek = viewingWeek < currentWeekIndex;
  const canMove = !locked && !isPastWeek;
  const par = tournaments[viewingWeek]?.par ?? 72;

  return (
    <div style={{ paddingBottom: 100 }}>
      {error && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ background: C.redDim, color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        </div>
      )}

      {/* Active lineup */}
      <div style={{ background: isMajor ? C.goldDim : C.greenDim }}>
        {sectionHeader(
          `Active Lineup (${activePlayers.length}/${activeSize})`,
          emptyActive > 0 && !locked ? (
            <span style={{ marginLeft: "auto", fontSize: 11, color: C.red, fontWeight: 600 }}>
              {emptyActive} empty {emptyActive === 1 ? "spot" : "spots"}
            </span>
          ) : undefined
        )}
        <div style={{ padding: "0 16px 6px" }}>

          {activePlayers.map((p) => (
            <PlayerCard key={p.playerId} player={p} par={par} colors={C} moving={moving === p.playerId} disabled={!canMove} onMove={() => handleMoveBtn(p.playerId)} onTap={() => setModalPlayerId(p.playerId)} />
          ))}
          {Array.from({ length: emptyActive }).map((_, i) => (
            <EmptySlot key={`ea-${i}`} label="Active" colors={C} highlight={moving !== null} warn={canMove && moving === null} onClick={() => handleEmptySlotDrop("active")} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <div style={{ background: C.card }}>
        {sectionHeader(`Bench (${benchPlayers.length}/${benchSize})`)}
        <div style={{ padding: "0 16px 6px" }}>

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
        <div style={{ padding: "0 16px 6px" }}>

          {sortedReserve.map((p) => (
            <PlayerCard key={p.playerId} player={p} par={par} colors={C} moving={moving === p.playerId} disabled={!canMove} onMove={() => handleMoveBtn(p.playerId)} onTap={() => setModalPlayerId(p.playerId)} />
          ))}
          {Array.from({ length: emptyReserve }).map((_, i) => (
            <EmptySlot key={`er-${i}`} label="Reserve" colors={C} highlight={moving !== null} onClick={() => handleEmptySlotDrop("reserve")} />
          ))}
        </div>
      </div>

      {modalPlayerId !== null && (
        <PlayerModal playerId={modalPlayerId} colors={C} onClose={() => setModalPlayerId(null)} />
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
                  background: isSelected ? (t.isMajor ? C.goldDim : C.greenDim) : "transparent",
                  borderBottom: i < tournaments.length - 1 ? `1px solid ${C.border}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {t.isMajor && <span style={{ color: C.gold, fontSize: 13 }}>★</span>}
                <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: C.txt }}>
                  Week {i + 1} — {t.name}
                </span>
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
const COL = { r: 26, s: 36, p: 46, gap: 2 };

function fmtPurse(n: number): string {
  if (n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

function fmtPos(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function fmtToPar(diff: number): string {
  if (diff < 0) return String(diff);
  if (diff > 0) return `+${diff}`;
  return "E";
}

function toParClr(diff: number, C: Theme): string {
  if (diff < 0) return C.green;
  if (diff > 0) return C.red;
  return C.txt3;
}

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
  par,
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
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 2v12M8 2L5 5M8 2l3 3M8 14L5 11M8 14l3-3M2 8h12M2 8l3-3M2 8l3 3M14 8l-3-3M14 8l-3 3" stroke={moving ? C.green : C.txt3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

      {/* Data columns: R1 R2 R3 R4 | SCORE | PURSE */}
      <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
        {/* R1–R4 */}
        {[0, 1, 2, 3].map((i) => {
          const score = p.rounds[i];
          const played = score != null;
          const diff = played ? score - par : 0;
          return (
            <div key={i} style={{ width: COL.r, textAlign: "center" }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: played ? toParClr(diff, C) : C.txt3, margin: 0, lineHeight: 1.3 }}>
                {played ? fmtToPar(diff) : "-"}
              </p>
              <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
                {played ? score : "-"}
              </p>
            </div>
          );
        })}

        {/* SCORE */}
        <div style={{ width: COL.s, textAlign: "center" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: hasRounds && p.status !== "cut" ? toParClr(p.toPar, C) : C.txt3, margin: 0, lineHeight: 1.3 }}>
            {hasRounds && p.status !== "cut" ? p.toParDisplay : "-"}
          </p>
          <p style={{ fontSize: 10, color: C.txt3, margin: 0, lineHeight: 1.3 }}>
            {hasRounds && p.status !== "cut" && p.position > 0 ? fmtPos(p.position) : "-"}
          </p>
        </div>

        {/* PURSE */}
        <div style={{ width: COL.p, textAlign: "right" }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: p.earnings > 0 ? C.green : C.txt3, margin: 0, lineHeight: 1.3 }}>
            {hasRounds && p.status !== "cut" ? fmtPurse(p.earnings) : "-"}
          </p>
        </div>
      </div>
    </div>
  );
}
