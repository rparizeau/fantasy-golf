import React, { useState } from "react";
import type { Theme } from "../theme";
import { ManagerIcon } from "./ManagerIcon";

export interface StandingsEntry {
  teamId: number;
  teamName: string;
  managerName: string;
  color?: string;
  secondaryColor?: string;
  totalPoints: number;
  completedWeeks?: number;
  totalWeeks?: number;
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
  title,
  renderExpanded,
  emptyMessage,
}: {
  entries: T[];
  colors: Theme;
  myTeamId?: number;
  title?: string;
  renderExpanded?: (entry: T, colors: Theme) => React.ReactNode;
  emptyMessage?: string;
}) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const colStyle: React.CSSProperties = { color: C.txt2, fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.6 };

  if (entries.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: 24, color: C.txt3, fontSize: 13 }}>
        {emptyMessage ?? "No standings data yet."}
      </div>
    );
  }

  return (
    <>
      {/* Column headers */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 14px 6px" }}>
        {title && <span style={{ ...colStyle, flex: 1 }}>{title}</span>}
        {!title && <span style={{ flex: 1 }} />}
        <span style={{ ...colStyle, textAlign: "center", minWidth: 70 }}>Thru</span>
        <span style={{ ...colStyle, width: 44, textAlign: "right" }}>PTS</span>
      </div>
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

              <ManagerIcon size={28} bgColor={entry.color ?? "#003C80"} ballColor={entry.secondaryColor ?? "#FFFFFF"} />

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

              {/* Thru + Points */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexShrink: 0 }}>
                <div style={{ textAlign: "center", minWidth: 70 }}>
                  <p style={{ color: C.txt2, fontSize: 15, fontWeight: 500, margin: 0 }}>
                    {entry.completedWeeks ?? 0} {(entry.completedWeeks ?? 0) === 1 ? "Week" : "Weeks"}
                  </p>
                  <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>
                    {(entry.totalWeeks ?? 0) - (entry.completedWeeks ?? 0)} remaining
                  </p>
                </div>
                <div style={{ width: 44, textAlign: "right" }}>
                  <p
                    style={{
                      color: entry.totalPoints > 0 ? C.txt : C.txt3,
                      fontSize: 15,
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    {entry.totalPoints}
                  </p>
                  <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>
                    {idx === 0 ? "Leader" : `+${entries[0].totalPoints - entry.totalPoints}`}
                  </p>
                </div>
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
