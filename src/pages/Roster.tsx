import { useState, useEffect, useCallback } from "react";
import { getRoster, setLineup, type RosterPlayer, type RosterData } from "../api";
import type { Theme } from "../theme";

interface RosterProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
}

export function Roster({ leagueId, teamId, colors: C }: RosterProps) {
  const [data, setData] = useState<RosterData | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [reserve, setReserve] = useState<RosterPlayer[]>([]);
  const [locked, setLocked] = useState(false);
  const [phase, setPhase] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const d = await getRoster(leagueId, teamId);
      setData(d);
      setRoster(d.roster);
      setReserve(d.reserve);
      setLocked(d.locked);
      setPhase(d.phase);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId]);

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

  const handlePlayerClick = (playerId: number) => {
    if (locked) return;

    // No selection yet — select this player
    if (selected === null) {
      setSelected(playerId);
      return;
    }

    // Same player — deselect
    if (selected === playerId) {
      setSelected(null);
      return;
    }

    // Find both players across roster + reserve
    const selInRoster = roster.find((p) => p.playerId === selected);
    const selInReserve = reserve.find((p) => p.playerId === selected);
    const tgtInRoster = roster.find((p) => p.playerId === playerId);
    const tgtInReserve = reserve.find((p) => p.playerId === playerId);

    if (!(selInRoster || selInReserve) || !(tgtInRoster || tgtInReserve)) {
      setSelected(null);
      return;
    }

    if (selInRoster && tgtInRoster) {
      // Both in roster
      if (selInRoster.isActive !== tgtInRoster.isActive) {
        // Cross-section: swap isActive flags
        const newRoster = roster.map((p) => {
          if (p.playerId === selected) return { ...p, isActive: tgtInRoster.isActive };
          if (p.playerId === playerId) return { ...p, isActive: selInRoster.isActive };
          return p;
        });
        setRoster(newRoster);
        autoSave(newRoster);
      } else {
        // Same section: swap array positions
        const newRoster = [...roster];
        const i = newRoster.findIndex((p) => p.playerId === selected);
        const j = newRoster.findIndex((p) => p.playerId === playerId);
        [newRoster[i], newRoster[j]] = [newRoster[j], newRoster[i]];
        setRoster(newRoster);
        autoSave(newRoster);
      }
    } else if (selInReserve && tgtInReserve) {
      // Both in reserve: swap positions
      const newReserve = [...reserve];
      const i = newReserve.findIndex((p) => p.playerId === selected);
      const j = newReserve.findIndex((p) => p.playerId === playerId);
      [newReserve[i], newReserve[j]] = [newReserve[j], newReserve[i]];
      setReserve(newReserve);
    } else {
      // Cross-collection: roster ↔ reserve
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
    setSelected(null);
  };

  const handleEmptySlotClick = (section: "active" | "bench" | "reserve") => {
    if (locked || selected === null) return;

    const selInRoster = roster.find((p) => p.playerId === selected);
    const selInReserve = reserve.find((p) => p.playerId === selected);
    const player = selInRoster || selInReserve;
    if (!player) { setSelected(null); return; }

    if (section === "reserve") {
      // Move to reserve
      if (selInReserve) { setSelected(null); return; } // already in reserve
      const newRoster = roster.filter((p) => p.playerId !== selected);
      const newReserve = [{ ...player, isActive: false }, ...reserve];
      setRoster(newRoster);
      setReserve(newReserve);
      autoSave(newRoster);
    } else {
      const wantActive = section === "active";

      if (selInRoster) {
        // Within roster: flip section
        if (player.isActive === wantActive) { setSelected(null); return; }
        if (wantActive && roster.filter((p) => p.isActive).length >= activeSize) {
          setSelected(null);
          return;
        }
        const updated = roster.map((p) =>
          p.playerId === selected ? { ...p, isActive: wantActive } : p
        );
        const idx = updated.findIndex((p) => p.playerId === selected);
        const [moved] = updated.splice(idx, 1);
        updated.unshift(moved);
        setRoster(updated);
        autoSave(updated);
      } else {
        // From reserve to roster
        if (wantActive && roster.filter((p) => p.isActive).length >= activeSize) {
          setSelected(null);
          return;
        }
        const newRoster = [{ ...player, isActive: wantActive }, ...roster];
        const newReserve = reserve.filter((p) => p.playerId !== selected);
        setRoster(newRoster);
        setReserve(newReserve);
        autoSave(newRoster);
      }
    }
    setSelected(null);
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

  const sectionHeader = (label: string, extra?: React.ReactNode) => (
    <div style={{ display: "flex", alignItems: "center", padding: "20px 16px 8px" }}>
      <p style={{ color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>
        {label}
      </p>
      {extra}
    </div>
  );

  return (
    <div style={{ paddingBottom: 100 }}>
      {error && (
        <div style={{ padding: "12px 16px 0" }}>
          <div style={{ background: C.redDim, color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        </div>
      )}

      {/* Lock status */}
      {locked && (
        <div style={{ padding: "12px 16px 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: C.bg,
              borderRadius: 10,
              border: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontSize: 14 }}>🔒</span>
            <span style={{ fontSize: 12, color: C.txt2 }}>
              Lineups are locked — {phase === "final" ? "tournament is final" : "tournament in progress"}
            </span>
          </div>
        </div>
      )}

      {/* Active lineup */}
      <div style={{ background: C.greenDim }}>
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
            <PlayerCard key={p.playerId} player={p} colors={C} locked={locked} selected={selected === p.playerId} onToggle={() => handlePlayerClick(p.playerId)} />
          ))}
          {Array.from({ length: emptyActive }).map((_, i) => (
            <EmptySlot key={`ea-${i}`} label="Active" colors={C} highlight={selected !== null} warn={!locked} onClick={() => handleEmptySlotClick("active")} />
          ))}
        </div>
      </div>

      {/* Bench */}
      <div style={{ background: C.card }}>
        {sectionHeader(`Bench (${benchPlayers.length}/${benchSize})`)}
        <div style={{ padding: "0 16px 6px" }}>
          {benchPlayers.map((p) => (
            <PlayerCard key={p.playerId} player={p} colors={C} locked={locked} selected={selected === p.playerId} onToggle={() => handlePlayerClick(p.playerId)} />
          ))}
          {Array.from({ length: emptyBench }).map((_, i) => (
            <EmptySlot key={`eb-${i}`} label="Bench" colors={C} highlight={selected !== null} onClick={() => handleEmptySlotClick("bench")} />
          ))}
        </div>
      </div>

      {/* Reserve */}
      <div style={{ background: C.bg }}>
        {sectionHeader(`Reserve (${sortedReserve.length}/${reserveSize})`)}
        <div style={{ padding: "0 16px 6px" }}>
          {sortedReserve.map((p) => (
            <PlayerCard key={p.playerId} player={p} colors={C} locked={locked} selected={selected === p.playerId} onToggle={() => handlePlayerClick(p.playerId)} />
          ))}
          {Array.from({ length: emptyReserve }).map((_, i) => (
            <EmptySlot key={`er-${i}`} label="Reserve" colors={C} highlight={selected !== null} onClick={() => handleEmptySlotClick("reserve")} />
          ))}
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ label, colors: C, highlight, warn, onClick }: { label: string; colors: Theme; highlight?: boolean; warn?: boolean; onClick?: () => void }) {
  const borderColor = highlight ? C.green : warn ? C.red : C.border;
  const textColor = highlight ? C.green : warn ? C.red : C.txt3;
  return (
    <div
      onClick={onClick}
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
      <span style={{ fontSize: 13, color: textColor }}>Empty {label} Slot</span>
    </div>
  );
}

function PlayerCard({
  player: p,
  colors: C,
  locked,
  selected,
  onToggle,
}: {
  player: RosterPlayer;
  colors: Theme;
  locked: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 14px",
        minHeight: 58,
        boxSizing: "border-box",
        background: C.card,
        borderRadius: 10,
        border: selected ? `2px solid ${C.green}` : `1px solid ${C.border}`,
        marginBottom: 6,
        cursor: locked ? "default" : "pointer",
        opacity: 1,
      }}
    >
      {/* Active dot */}
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: p.isActive ? C.greenBright : C.txt3,
          marginRight: 12,
          flexShrink: 0,
          border: p.isActive ? "none" : `1px solid ${C.border}`,
        }}
      />

      {/* Player info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{p.name}</p>
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

      {/* Score */}
      <div style={{ textAlign: "right" }}>
        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            margin: 0,
            color: p.toPar < 0 ? C.red : p.toPar > 0 ? C.txt2 : C.txt3,
          }}
        >
          {p.toParDisplay}
        </p>
        {p.earnings > 0 && (
          <p style={{ fontSize: 11, color: C.greenBright, fontWeight: 600, margin: 0 }}>
            ${p.earnings.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
