import { useState, useEffect, useCallback } from "react";
import { getPlayerPool, submitWaiverClaim, type PlayerPoolEntry } from "../api";
import { getRoster, type RosterPlayer, type RosterData } from "../api";
import type { Theme } from "../theme";

interface GolfersProps {
  leagueId: number;
  teamId: number;
  colors: Theme;
}

export function Golfers({ leagueId, teamId, colors: C }: GolfersProps) {
  const [players, setPlayers] = useState<PlayerPoolEntry[]>([]);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [rosterSettings, setRosterSettings] = useState<RosterData["settings"] | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "free" | "rostered">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addPlayer, setAddPlayer] = useState<PlayerPoolEntry | null>(null);
  const [dropPlayer, setDropPlayer] = useState<number | null>(null);
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

  const filtered = players.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "free" && p.ownedBy !== null) return false;
    if (filter === "rostered" && p.ownedBy === null) return false;
    return true;
  });

  const rosterHasRoom = rosterSettings ? myRoster.length < rosterSettings.rosterSize : false;

  const handleClaim = async (withoutDrop?: boolean) => {
    if (!addPlayer) return;
    if (!withoutDrop && dropPlayer === null) return;
    setClaiming(true);
    try {
      await submitWaiverClaim(leagueId, {
        addPlayerId: addPlayer.playerId,
        ...(withoutDrop ? {} : { dropPlayerId: dropPlayer! }),
      });
      setAddPlayer(null);
      setDropPlayer(null);
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

      {/* Search */}
      <input
        type="text"
        placeholder="Search golfers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          border: `1px solid ${C.border}`,
          background: C.card,
          color: C.txt,
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
          marginBottom: 10,
        }}
      />

      {/* Filters */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {(["all", "free", "rostered"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              borderRadius: 8,
              border: `1px solid ${filter === f ? C.green : C.border}`,
              background: filter === f ? C.greenDim : C.card,
              color: filter === f ? C.greenBright : C.txt2,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {f === "free" ? "Free Agents" : f === "rostered" ? "Rostered" : "All"}
          </button>
        ))}
      </div>

      {/* Add/drop modal */}
      {addPlayer && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.green}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <p style={{ color: C.txt, fontSize: 14, fontWeight: 600, margin: "0 0 8px" }}>
            Add: {addPlayer.name} (#{addPlayer.ranking})
          </p>

          {rosterHasRoom && (
            <button
              onClick={() => handleClaim(true)}
              disabled={claiming}
              style={{
                width: "100%",
                padding: "10px 16px",
                borderRadius: 8,
                border: "none",
                background: C.green,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                marginBottom: 10,
              }}
            >
              {claiming ? "Submitting..." : "Add to Roster"}
            </button>
          )}

          <p style={{ color: C.txt2, fontSize: 12, margin: "0 0 8px" }}>
            {rosterHasRoom ? "Or select a player to drop:" : "Select a player to drop:"}
          </p>
          {myRoster.map((p) => (
            <div
              key={p.playerId}
              onClick={() => setDropPlayer(p.playerId)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: 8,
                marginBottom: 4,
                cursor: "pointer",
                background: dropPlayer === p.playerId ? C.greenDim : "transparent",
                border: `1px solid ${dropPlayer === p.playerId ? C.green : C.border}`,
              }}
            >
              <span style={{ color: C.txt, fontSize: 13 }}>{p.name}</span>
              <span style={{ color: C.txt3, fontSize: 12 }}>#{p.ranking}</span>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              onClick={() => handleClaim()}
              disabled={dropPlayer === null || claiming}
              style={{
                flex: 1,
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: C.green,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                opacity: dropPlayer === null ? 0.5 : 1,
              }}
            >
              {claiming ? "Submitting..." : "Submit Claim"}
            </button>
            <button
              onClick={() => { setAddPlayer(null); setDropPlayer(null); }}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.card,
                color: C.txt2,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Player list */}
      {filtered.map((p) => (
        <div
          key={p.playerId}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "10px 14px",
            background: C.card,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            marginBottom: 6,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: C.txt, fontSize: 14, fontWeight: 500, margin: 0 }}>{p.name}</p>
            <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
              <span style={{ fontSize: 11, color: C.txt3 }}>#{p.ranking}</span>
              <span style={{ fontSize: 11, color: C.txt3 }}>{p.country}</span>
              {p.ownedBy ? (
                <span style={{ fontSize: 10, color: C.blue }}>{p.ownedBy.teamName}</span>
              ) : (
                <span style={{ fontSize: 10, color: C.greenBright, fontWeight: 600 }}>FA</span>
              )}
            </div>
          </div>

          {/* Season earnings */}
          <div style={{ textAlign: "right", marginRight: 10 }}>
            {p.seasonEarnings > 0 && (
              <p style={{ fontSize: 12, color: C.txt2, margin: 0 }}>
                ${p.seasonEarnings.toLocaleString()}
              </p>
            )}
          </div>

          {/* Add button (only for free agents) */}
          {p.ownedBy === null && !addPlayer && (
            <button
              onClick={() => setAddPlayer(p)}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${C.green}`,
                background: "transparent",
                color: C.greenBright,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Add
            </button>
          )}
        </div>
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
          No golfers found
        </div>
      )}
    </div>
  );
}
