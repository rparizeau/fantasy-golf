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
  roundPoints?: number[];
  projectedRoundPoints?: number[];
}

// Column widths matching Roster PlayerCard
const COL = { r: 26, p: 46, gap: 2 };

export function StandingsList<T extends StandingsEntry>({
  entries,
  colors: C,
  myTeamId,
  title,
  showThru = true,
  showRounds = false,
  renderExpanded,
  emptyMessage,
}: {
  entries: T[];
  colors: Theme;
  myTeamId?: number;
  title?: string;
  showThru?: boolean;
  showRounds?: boolean;
  renderExpanded?: (entry: T, colors: Theme) => React.ReactNode;
  emptyMessage?: string;
}) {
  const [expandedTeam, setExpandedTeam] = useState<number | null>(null);

  const myEntry = entries.find((e) => e.teamId === myTeamId);
  const myPoints = myEntry?.totalPoints ?? 0;

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
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {title && <span style={colStyle}>{title}</span>}
        </div>
        {showThru && <span style={{ ...colStyle, textAlign: "right", minWidth: 70 }}>Thru</span>}
        <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, marginRight: 1 }}>
          {showRounds && ["R1", "R2", "R3", "R4"].map((l) => (
            <div key={l} style={{ width: COL.r, textAlign: "center" }}><span style={colStyle}>{l}</span></div>
          ))}
          <div style={{ width: COL.p, textAlign: "right" }}><span style={colStyle}>PTS</span></div>
        </div>
      </div>
      {/* Compute positions with ties */}
      {entries.map((entry, _idx) => {
        // Find the first index with this score to determine position
        const pos = entries.findIndex((e) => e.totalPoints === entry.totalPoints) + 1;
        const tied = entries.filter((e) => e.totalPoints === entry.totalPoints).length > 1;
        const posLabel = `${tied ? "T" : ""}${pos}`;

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
                  background: showThru ? C.goldDim : C.card2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: showThru ? C.gold : C.txt2,
                  flexShrink: 0,
                }}
              >
                {posLabel}
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
                </div>
                <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>{entry.managerName}</p>
              </div>

              {/* Thru */}
              {showThru && (
                <div style={{ textAlign: "right", minWidth: 70, flexShrink: 0 }}>
                  <p style={{ color: C.txt2, fontSize: 15, fontWeight: 500, margin: 0 }}>
                    {entry.completedWeeks ?? 0} {(entry.completedWeeks ?? 0) === 1 ? "Wk" : "Wks"}
                  </p>
                  <p style={{ color: C.txt3, fontSize: 11, margin: "2px 0 0" }}>
                    {(entry.totalWeeks ?? 0) - (entry.completedWeeks ?? 0)} rem
                  </p>
                </div>
              )}

              {/* Data columns: R1 R2 R3 R4 | PTS */}
              <div style={{ display: "flex", gap: COL.gap, flexShrink: 0, alignItems: "flex-start" }}>
                {showRounds && [0, 1, 2, 3].map((ri) => {
                  const pts = entry.roundPoints?.[ri];
                  const proj = entry.projectedRoundPoints?.[ri];
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

                {/* PTS */}
                <div style={{ width: COL.p, textAlign: "right" }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: entry.totalPoints > 0 ? C.txt : C.txt3, margin: 0, height: 20, display: "flex", alignItems: "flex-end", justifyContent: "flex-end" }}>
                    {entry.totalPoints}
                  </p>
                  <p style={{ fontSize: 10, color: isMe ? "transparent" : C.green, margin: 0, lineHeight: 1.3, textAlign: "right" }}>
                    {isMe ? "\u00A0" : `${entry.totalPoints >= myPoints ? "+" : ""}${entry.totalPoints - myPoints}`}
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
