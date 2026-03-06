import { useState, useEffect, useCallback } from "react";
import { getPlayerPool, submitWaiverClaim, type PlayerPoolEntry } from "../api";
import { getRoster, type RosterPlayer, type RosterData } from "../api";
import { PlayerModal } from "../components/PlayerModal";
import type { Theme } from "../theme";

interface GolfersProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
  simTick: number;
}

const BTN = 36;
const STAT_COL = { w: 28, gap: 2 };
const statCols: { key: keyof PlayerPoolEntry; label: string }[] = [
  { key: "eagles", label: "EGL" },
  { key: "birdies", label: "BRD" },
  { key: "pars", label: "PAR" },
  { key: "bogeys", label: "BOG" },
  { key: "doubles", label: "DBL" },
  { key: "seasonPoints", label: "TOT" },
];

export function Golfers({ leagueId, teamId, colors: C, simTick }: GolfersProps) {
  const [players, setPlayers] = useState<PlayerPoolEntry[]>([]);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [rosterSettings, setRosterSettings] = useState<RosterData["settings"] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalPlayerId, setModalPlayerId] = useState<number | null>(null);
  const [actionModal, setActionModal] = useState<{ type: "add" | "drop" | "trade" | "claim"; player: PlayerPoolEntry } | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState<number | null>(null);
  const [claiming, setClaiming] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [poolData, rosterData] = await Promise.all([
        getPlayerPool(leagueId),
        getRoster(leagueId, teamId),
      ]);
      setPlayers(poolData);
      setMyRoster(rosterData.roster);
      setRosterSettings(rosterData.settings);
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

  // Silent re-fetch on sim tick (no loading spinner)
  useEffect(() => {
    if (simTick > 0) refresh();
  }, [simTick]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive unique teams from pool data
  const teamsInLeague = (() => {
    const map = new Map<number, string>();
    for (const p of players) {
      if (p.ownedBy) map.set(p.ownedBy.teamId, p.ownedBy.teamName);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  })();

  const filtered = players.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "free" && p.ownedBy !== null) return false;
    if (filter === "rostered" && p.ownedBy === null) return false;
    if (filter.startsWith("team:")) {
      const tid = Number(filter.slice(5));
      if (!p.ownedBy || p.ownedBy.teamId !== tid) return false;
    }
    return true;
  });

  const rosterHasRoom = rosterSettings ? myRoster.length < rosterSettings.rosterSize : false;

  const handleAdd = async (withoutDrop?: boolean) => {
    if (!actionModal || actionModal.type !== "add") return;
    if (!withoutDrop && dropPlayerId === null) return;
    setClaiming(true);
    try {
      await submitWaiverClaim(leagueId, {
        addPlayerId: actionModal.player.playerId,
        ...(withoutDrop ? {} : { dropPlayerId: dropPlayerId! }),
      });
      setActionModal(null);
      setDropPlayerId(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    }
    setClaiming(false);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "80px 0" }}>
        <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
      </div>
    );
  }

  return (
    <div style={{ padding: "12px 16px 100px" }}>
      {error && (
        <div style={{ background: C.redDim, color: C.red, padding: "10px 14px", borderRadius: 10, fontSize: 13, marginBottom: 10 }}>
          {error}
        </div>
      )}

      {/* Search + Filter row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          type="text"
          placeholder="Search golfers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.txt,
            fontSize: 14,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            width: 120,
            flexShrink: 0,
            padding: "10px 28px 10px 10px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.txt,
            fontSize: 12,
            fontWeight: 600,
            outline: "none",
            boxSizing: "border-box",
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238E95A0' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 10px center",
          }}
        >
        <option value="all">All Golfers</option>
        <option value="free">Free Agents</option>
        <option value="rostered">All Rostered</option>
        <option disabled>───────────</option>
        {teamsInLeague.map(([tid, name]) => (
          <option key={tid} value={`team:${tid}`}>
            {tid === teamId ? `${name} (My Team)` : name}
          </option>
        ))}
        </select>
      </div>

      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 14px 6px" }}>
        <p style={{ flex: 1, color: C.txt2, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>Name</p>
        <div style={{ display: "flex", gap: STAT_COL.gap, flexShrink: 0 }}>
          {statCols.map((col) => (
            <p key={col.key} style={{ width: STAT_COL.w, textAlign: "right", color: C.txt2, fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, margin: 0 }}>{col.label}</p>
          ))}
        </div>
      </div>

      {/* Player list */}
      {filtered.map((p) => {
        const isMyTeam = p.ownedBy !== null && p.ownedBy.teamId === teamId;
        const isOtherTeam = p.ownedBy !== null && !isMyTeam;

        return (
          <div
            key={p.playerId}
            onClick={() => setModalPlayerId(p.playerId)}
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
            {/* Action button */}
            <ActionButton
              type={isMyTeam ? "drop" : isOtherTeam ? "trade" : "add"}
              colors={C}
              onClick={(e) => {
                e.stopPropagation();
                const type = isMyTeam ? "drop" as const : isOtherTeam ? "trade" as const : "add" as const;
                setActionModal({ type, player: p });
              }}
            />

            {/* Player info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
                <span style={{ fontSize: 11, color: C.txt3 }}>#{p.ranking}</span>
                <span style={{ fontSize: 11, color: C.txt3 }}>{p.country}</span>
                {p.ownedBy ? (
                  <span style={{ fontSize: 10, color: C.blue, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.ownedBy.teamName}</span>
                ) : (
                  <span style={{ fontSize: 10, color: C.greenBright, fontWeight: 600 }}>FA</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: "flex", gap: STAT_COL.gap, flexShrink: 0 }}>
              {statCols.map((col) => {
                const v = p[col.key];
                return (
                  <p key={col.key} style={{ width: STAT_COL.w, textAlign: "right", fontSize: 11, fontWeight: col.key === "seasonPoints" ? 700 : 500, color: (typeof v === "number" && v > 0) ? C.txt : C.txt3, margin: 0 }}>
                    {typeof v === "number" ? v : ""}
                  </p>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
          No golfers found
        </div>
      )}

      {modalPlayerId !== null && (
        <PlayerModal playerId={modalPlayerId} leagueId={leagueId} colors={C} onClose={() => setModalPlayerId(null)} />
      )}

      {actionModal && (
        <GolferActionModal
          action={actionModal}
          colors={C}
          myRoster={myRoster}
          rosterHasRoom={rosterHasRoom}
          dropPlayerId={dropPlayerId}
          setDropPlayerId={setDropPlayerId}
          claiming={claiming}
          onAdd={handleAdd}
          onClose={() => { setActionModal(null); setDropPlayerId(null); }}
        />
      )}
    </div>
  );
}

function ActionButton({
  type,
  colors: C,
  onClick,
}: {
  type: "add" | "drop" | "trade" | "claim";
  colors: Theme;
  onClick: (e: React.MouseEvent) => void;
}) {
  const cfg = {
    add:   { border: C.green, bg: "transparent", color: C.green },
    drop:  { border: C.red,   bg: "transparent", color: C.red },
    trade: { border: C.blue,  bg: "transparent", color: C.blue },
    claim: { border: C.border, bg: "transparent", color: C.txt3 },
  }[type];

  const icon = {
    // Plus
    add: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    // Arrow down out of box
    drop: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 2v8M8 10L5 7M8 10l3-3" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3 12h10" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    // Two arrows swap
    trade: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M4 5h8M12 5l-2.5-2.5M12 5L9.5 7.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 11H4M4 11l2.5-2.5M4 11l2.5 2.5" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    // Clipboard / claim
    claim: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="2" width="10" height="12" rx="1.5" stroke={cfg.color} strokeWidth="1.5" />
        <path d="M6 7h4M6 10h2" stroke={cfg.color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  }[type];

  return (
    <button
      onClick={onClick}
      style={{
        width: BTN,
        height: BTN,
        flexShrink: 0,
        marginRight: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        border: `1.5px solid ${cfg.border}`,
        background: cfg.bg,
        cursor: "pointer",
        padding: 0,
      }}
    >
      {icon}
    </button>
  );
}

function GolferActionModal({
  action,
  colors: C,
  myRoster,
  rosterHasRoom,
  dropPlayerId,
  setDropPlayerId,
  claiming,
  onAdd,
  onClose,
}: {
  action: { type: "add" | "drop" | "trade" | "claim"; player: PlayerPoolEntry };
  colors: Theme;
  myRoster: RosterPlayer[];
  rosterHasRoom: boolean;
  dropPlayerId: number | null;
  setDropPlayerId: (id: number | null) => void;
  claiming: boolean;
  onAdd: (withoutDrop?: boolean) => void;
  onClose: () => void;
}) {
  const titleMap = {
    add: "Add Player",
    drop: "Drop Player",
    trade: "Propose Trade",
    claim: "Waiver Claim",
  };

  const accentMap = {
    add: C.green,
    drop: C.red,
    trade: C.blue,
    claim: C.txt3,
  };

  const accent = accentMap[action.type];

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 430,
          background: C.bg,
          borderRadius: "18px 18px 0 0",
          padding: "20px 20px 32px",
          maxHeight: "70vh",
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <p style={{ color: accent, fontSize: 16, fontWeight: 700, margin: 0 }}>{titleMap[action.type]}</p>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: C.txt3, fontSize: 22, cursor: "pointer", padding: 0, lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Target player */}
        <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: 0 }}>{action.player.name}</p>
          <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
            <span style={{ fontSize: 11, color: C.txt3 }}>#{action.player.ranking}</span>
            <span style={{ fontSize: 11, color: C.txt3 }}>{action.player.country}</span>
            {action.player.ownedBy ? (
              <span style={{ fontSize: 10, color: C.blue }}>{action.player.ownedBy.teamName}</span>
            ) : (
              <span style={{ fontSize: 10, color: C.greenBright, fontWeight: 600 }}>FA</span>
            )}
          </div>
        </div>

        {/* Content by type */}
        {action.type === "add" && (
          <AddContent
            colors={C}
            myRoster={myRoster}
            rosterHasRoom={rosterHasRoom}
            dropPlayerId={dropPlayerId}
            setDropPlayerId={setDropPlayerId}
            claiming={claiming}
            onAdd={onAdd}
            onClose={onClose}
          />
        )}
        {action.type === "drop" && (
          <StubContent colors={C} message="Drop functionality coming soon." />
        )}
        {action.type === "trade" && (
          <StubContent colors={C} message="Trade proposals coming soon." />
        )}
        {action.type === "claim" && (
          <StubContent colors={C} message="Waiver claims coming soon." />
        )}
      </div>
    </div>
  );
}

function AddContent({
  colors: C,
  myRoster,
  rosterHasRoom,
  dropPlayerId,
  setDropPlayerId,
  claiming,
  onAdd,
  onClose,
}: {
  colors: Theme;
  myRoster: RosterPlayer[];
  rosterHasRoom: boolean;
  dropPlayerId: number | null;
  setDropPlayerId: (id: number | null) => void;
  claiming: boolean;
  onAdd: (withoutDrop?: boolean) => void;
  onClose: () => void;
}) {
  if (rosterHasRoom) {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onAdd(true)}
          disabled={claiming}
          style={{
            flex: 1,
            padding: "12px 0",
            borderRadius: 10,
            border: "none",
            background: C.green,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: claiming ? "default" : "pointer",
            opacity: claiming ? 0.5 : 1,
          }}
        >
          {claiming ? "Adding..." : "Add to Roster"}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.txt2,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <>
      <p style={{ color: C.txt2, fontSize: 13, margin: "0 0 10px" }}>
        Your roster is full. Select a player to drop:
      </p>
      <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 14 }}>
        {myRoster.map((r) => (
          <div
            key={r.playerId}
            onClick={() => setDropPlayerId(r.playerId)}
            style={{
              display: "flex",
              alignItems: "center",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 4,
              cursor: "pointer",
              background: dropPlayerId === r.playerId ? C.card2 : C.card,
              border: `1px solid ${dropPlayerId === r.playerId ? C.green : C.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: C.txt, fontSize: 13, fontWeight: 600, margin: 0 }}>{r.name}</p>
              <span style={{ fontSize: 11, color: C.txt3 }}>#{r.ranking}</span>
            </div>
            {dropPlayerId === r.playerId && (
              <span style={{ color: C.green, fontSize: 16, fontWeight: 700 }}>✓</span>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onAdd()}
          disabled={claiming || dropPlayerId === null}
          style={{
            flex: 1,
            padding: "12px 0",
            borderRadius: 10,
            border: "none",
            background: C.green,
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: claiming || dropPlayerId === null ? "default" : "pointer",
            opacity: claiming || dropPlayerId === null ? 0.5 : 1,
          }}
        >
          {claiming ? "Claiming..." : "Submit Claim"}
        </button>
        <button
          onClick={onClose}
          style={{
            padding: "12px 20px",
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.card,
            color: C.txt2,
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </>
  );
}

function StubContent({ colors: C, message }: { colors: Theme; message: string }) {
  return (
    <div style={{ textAlign: "center", padding: "20px 0" }}>
      <p style={{ color: C.txt3, fontSize: 13, margin: 0 }}>{message}</p>
    </div>
  );
}
