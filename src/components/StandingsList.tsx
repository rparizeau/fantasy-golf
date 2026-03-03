import { useState } from "react";
import type { Theme } from "../theme";

export interface StandingsEntry {
  teamId: number;
  teamName: string;
  managerName: string;
  totalPoints: number;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function StandingsList<T extends StandingsEntry>({
  entries,
  colors: C,
  myTeamId,
  renderExpanded,
  emptyMessage,
}: {
  entries: T[];
  colors: Theme;
  myTeamId?: number;
  renderExpanded?: (entry: T, colors: Theme) => React.ReactNode;
  emptyMessage?: string;
}) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
        {emptyMessage ?? "No standings data yet."}
      </div>
    );
  }

  return (
    <>
      {entries.map((entry, idx) => {
        const isMe = entry.teamId === myTeamId;
        const isExpanded = expandedTeam === entry.teamId;
        const hasExpanded = renderExpanded != null;

        return (
          <div
            key={entry.teamId}
            style={{
              background: C.card,
              borderRadius: 12,
              marginBottom: 8,
              border: `1px solid ${isMe ? C.green : C.border}`,
              overflow: "hidden",
              boxShadow: isMe ? `0 0 0 1px ${C.green}40` : undefined,
            }}
          >
            <div
              onClick={hasExpanded ? () => setExpandedTeam(isExpanded ? null : entry.teamId) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "12px 14px",
                cursor: hasExpanded ? "pointer" : "default",
                gap: 12,
              }}
            >
              {/* Rank */}
              <div
                style={{
                  width: 32,
                  height: 28,
                  borderRadius: 8,
                  background: C.card2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.txt2,
                  flexShrink: 0,
                }}
              >
                {ordinal(idx + 1)}
              </div>

              {/* Team info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <p
                    style={{
                      color: C.txt,
                      fontSize: 14,
                      fontWeight: 600,
                      margin: 0,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {entry.teamName}
                  </p>
                  {isMe && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: C.green,
                        background: C.greenDim,
                        padding: "1px 6px",
                        borderRadius: 6,
                        flexShrink: 0,
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>
                <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>{entry.managerName}</p>
              </div>

              {/* Points */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p
                  style={{
                    color: entry.totalPoints > 0 ? C.greenBright : C.txt3,
                    fontSize: 15,
                    fontWeight: 700,
                    margin: 0,
                  }}
                >
                  {entry.totalPoints} pts
                </p>
              </div>

              {/* Expand chevron */}
              {hasExpanded && (
                <span
                  style={{
                    color: C.txt3,
                    fontSize: 16,
                    transform: isExpanded ? "rotate(90deg)" : "none",
                    transition: "transform .15s",
                    flexShrink: 0,
                  }}
                >
                  ›
                </span>
              )}
            </div>

            {/* Expanded content */}
            {isExpanded && renderExpanded && (
              <div style={{ borderTop: `1px solid ${C.border}` }}>
                {renderExpanded(entry, C)}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
