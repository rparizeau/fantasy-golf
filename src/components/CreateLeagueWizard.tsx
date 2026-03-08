import { useState, useEffect } from "react";
import type { Theme } from "../theme";
import { useAuth } from "../context/AuthContext";
import {
  getScoringEventDefaults, getSchedulePreview, createLeague,
  type SchedulePreviewTournament, type CreateLeaguePayload,
} from "../api";

interface WizardProps {
  colors: Theme;
  onClose: () => void;
  onCreated: (leagueId: number) => void;
}

interface WizardState {
  name: string;
  teamName: string;
  managerCount: number;
  lineupCount: number;
  benchCount: number;
  reserveCount: number;
  scoring: { scoringEventId: number; key: string; label: string; pointsVal: number }[];
  waiverType: "reverse_standings" | "faab";
  faabBudget: number;
  tradeVetoRule: "none" | "commissioner" | "league";
  weekCount: number;
  regularSeasonPoints: number;
  majorSeasonPoints: number;
  draftDate: string;
  draftTime: string;
}

const DEFAULT: WizardState = {
  name: "", teamName: "", managerCount: 10, lineupCount: 4, benchCount: 4, reserveCount: 0,
  scoring: [], waiverType: "reverse_standings", faabBudget: 100, tradeVetoRule: "none",
  weekCount: 19, regularSeasonPoints: 500, majorSeasonPoints: 700, draftDate: "", draftTime: "",
};

export function CreateLeagueWizard({ colors: C, onClose, onCreated }: WizardProps) {
  const { refreshManager } = useAuth();
  const [step, setStep] = useState(1);
  const [s, setS] = useState<WizardState>(DEFAULT);
  const [schedule, setSchedule] = useState<SchedulePreviewTournament[]>([]);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getScoringEventDefaults().catch(() => ({ events: [] as { id: number; key: string; label: string; defaultPoints: number }[] })),
      getSchedulePreview(DEFAULT.weekCount).catch(() => ({ tournaments: [] as SchedulePreviewTournament[] })),
    ]).then(([{ events: e }, { tournaments: t }]) => {
      setS((prev) => ({ ...prev, scoring: e.map((ev) => ({ scoringEventId: ev.id, key: ev.key, label: ev.label, pointsVal: ev.defaultPoints })) }));
      setSchedule(t);
      setReady(true);
    });
  }, []);

  const [initialWeekCount] = useState(DEFAULT.weekCount);
  useEffect(() => {
    if (!ready || s.weekCount === initialWeekCount) return;
    getSchedulePreview(s.weekCount).then(({ tournaments }) => setSchedule(tournaments)).catch(() => {});
  }, [s.weekCount, ready, initialWeekCount]);

  const set = <K extends keyof WizardState>(key: K, val: WizardState[K]) => setS((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let draftScheduledAt: string | undefined;
      if (s.draftDate && s.draftTime) draftScheduledAt = new Date(`${s.draftDate}T${s.draftTime}`).toISOString();
      const payload: CreateLeaguePayload = {
        name: s.name.trim(), teamName: s.teamName.trim() || undefined,
        managerCount: s.managerCount, lineupCount: s.lineupCount, benchCount: s.benchCount, reserveCount: s.reserveCount,
        scoring: s.scoring.map((x) => ({ scoringEventId: x.scoringEventId, pointsVal: x.pointsVal })),
        waiverType: s.waiverType, faabBudget: s.faabBudget, tradeVetoRule: s.tradeVetoRule,
        weekCount: s.weekCount, regularSeasonPoints: s.regularSeasonPoints, majorSeasonPoints: s.majorSeasonPoints, draftScheduledAt,
      };
      const result = await createLeague(payload);
      setInviteCode(result.inviteCode);
      await refreshManager();
      onCreated(result.leagueId);
    } catch (err: any) {
      setError(err.message || "Failed to create league");
    } finally {
      setSubmitting(false);
    }
  };

  const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.txt, fontSize: 15, outline: "none" };
  const lbl: React.CSSProperties = { color: C.txt2, fontSize: 12, fontWeight: 600, margin: "0 0 6px", display: "block" };
  const gap: React.CSSProperties = { marginBottom: 18 };
  const stepperBtn: React.CSSProperties = { width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2, color: C.txt, fontSize: 18, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };

  const stepper = (label: string, value: number, min: number, max: number, onChange: (v: number) => void) => (
    <div style={{ ...gap, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <span style={{ color: C.txt, fontSize: 14, fontWeight: 500 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ ...stepperBtn, opacity: value <= min ? 0.3 : 1 }} disabled={value <= min} onClick={() => onChange(value - 1)}>&minus;</button>
        <span style={{ color: C.txt, fontSize: 16, fontWeight: 700, minWidth: 24, textAlign: "center" }}>{value}</span>
        <button style={{ ...stepperBtn, opacity: value >= max ? 0.3 : 1 }} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );

  const radio = (options: { value: string; label: string }[], value: string, onChange: (v: string) => void) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((o) => (
        <div key={o.value} onClick={() => onChange(o.value)} style={{ padding: "10px 12px", borderRadius: 8, cursor: "pointer", border: `1px solid ${value === o.value ? C.green : C.border}`, background: value === o.value ? C.greenDim : C.card2 }}>
          <span style={{ color: value === o.value ? C.green : C.txt, fontSize: 14, fontWeight: 600 }}>{o.label}</span>
        </div>
      ))}
    </div>
  );

  const summaryRow = (label: string, value: string) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
      <span style={{ color: C.txt2, fontSize: 13 }}>{label}</span>
      <span style={{ color: C.txt, fontSize: 13, fontWeight: 600 }}>{value}</span>
    </div>
  );

  const canNext = step === 1 ? s.name.trim().length > 0 : true;
  const stepTitles = ["League Info", "Roster Size", "Scoring", "Waivers & Trades", "Schedule", "Review & Create"];

  const renderStep = () => {
    if (!ready) return <div style={{ display: "flex", justifyContent: "center", padding: "60px 0" }}><div style={{ width: 28, height: 28, border: `3px solid ${C.border}`, borderTopColor: C.green, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /></div>;

    switch (step) {
      case 1: return (
        <div>
          <div style={gap}><p style={lbl}>League Name</p><input style={inp} value={s.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Birdie Brigade" /></div>
          <div><p style={lbl}>Your Team Name</p><input style={inp} value={s.teamName} onChange={(e) => set("teamName", e.target.value)} placeholder="e.g. Eagle Eyes" /></div>
        </div>
      );
      case 2: return (
        <div>
          {stepper("League Size", s.managerCount, 2, 16, (v) => set("managerCount", v))}
          {stepper("Active Squad", s.lineupCount, 1, 4, (v) => set("lineupCount", v))}
          {stepper("Bench", s.benchCount, 1, 8, (v) => set("benchCount", v))}
          {stepper("Reserve", s.reserveCount, 0, 2, (v) => set("reserveCount", v))}
        </div>
      );
      case 3: return (
        <div>
          {s.scoring.map((sc, i) => (
            <div key={sc.key} style={{ ...gap, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ color: C.txt, fontSize: 14, fontWeight: 500 }}>{sc.label}</span>
              <input type="number" style={{ ...inp, width: 80, textAlign: "center" }} value={sc.pointsVal / 100} onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                const next = [...s.scoring]; next[i] = { ...next[i], pointsVal: Math.round(val * 100) }; set("scoring", next);
              }} />
            </div>
          ))}
        </div>
      );
      case 4: return (
        <div>
          <div style={gap}>
            <p style={lbl}>Waiver Type</p>
            {radio([{ value: "reverse_standings", label: "Reverse Standings" }, { value: "faab", label: "FAAB" }], s.waiverType, (v) => set("waiverType", v as any))}
            {s.waiverType === "faab" && <div style={{ marginTop: 12 }}><p style={lbl}>FAAB Budget ($)</p><input type="number" style={{ ...inp, width: 100 }} value={s.faabBudget} onChange={(e) => set("faabBudget", parseInt(e.target.value) || 100)} /></div>}
          </div>
          <div style={gap}>
            <p style={lbl}>Trade Veto</p>
            {radio([{ value: "none", label: "None" }, { value: "commissioner", label: "Commissioner Decides" }, { value: "league", label: "League Decides" }], s.tradeVetoRule, (v) => set("tradeVetoRule", v as any))}
          </div>
        </div>
      );
      case 5: return (
        <div>
          {stepper("Weeks", s.weekCount, 15, 19, (v) => set("weekCount", v))}
          <div style={{ ...gap, display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}><p style={lbl}>Regular Pts</p><input type="number" style={inp} value={s.regularSeasonPoints} onChange={(e) => set("regularSeasonPoints", parseInt(e.target.value) || 500)} /></div>
            <div style={{ flex: 1 }}><p style={lbl}>Major Pts</p><input type="number" style={inp} value={s.majorSeasonPoints} onChange={(e) => set("majorSeasonPoints", parseInt(e.target.value) || 700)} /></div>
          </div>
          <p style={{ ...lbl, marginTop: 4 }}>Schedule ({schedule.length} tournaments)</p>
          <div style={{ maxHeight: 200, overflow: "auto", borderRadius: 8, border: `1px solid ${C.border}`, background: C.card2 }}>
            {schedule.map((t, i) => (
              <div key={t.id} style={{ padding: "8px 12px", borderBottom: i < schedule.length - 1 ? `1px solid ${C.border}` : undefined, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: C.txt, fontSize: 13 }}>{t.name}</span>
                {t.isMajor && <span style={{ color: C.gold, fontSize: 11, fontWeight: 700, background: C.goldDim, padding: "1px 6px", borderRadius: 4 }}>MAJOR</span>}
              </div>
            ))}
          </div>
        </div>
      );
      case 6: return inviteCode ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>&#9971;</div>
          <p style={{ color: C.txt, fontSize: 18, fontWeight: 700, margin: "0 0 6px" }}>League Created!</p>
          <p style={{ color: C.txt2, fontSize: 13, margin: "0 0 20px" }}>Share this code with your friends</p>
          <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 20px", display: "inline-block", marginBottom: 16 }}>
            <p style={{ color: C.txt, fontSize: 28, fontWeight: 700, letterSpacing: 4, margin: 0, fontFamily: "monospace" }}>{inviteCode}</p>
          </div>
          <div><button onClick={() => navigator.clipboard.writeText(inviteCode)} style={{ background: C.green, color: "#fff", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Copy Code</button></div>
        </div>
      ) : (
        <div>
          {summaryRow("League Name", s.name)}
          {summaryRow("League Size", `${s.managerCount} managers`)}
          {summaryRow("Roster", `${s.lineupCount} active / ${s.benchCount} bench / ${s.reserveCount} reserve`)}
          {summaryRow("Draft Rounds", `${s.lineupCount + s.benchCount + s.reserveCount}`)}
          {summaryRow("Waivers", s.waiverType === "faab" ? `FAAB ($${s.faabBudget})` : "Reverse Standings")}
          {summaryRow("Trade Veto", s.tradeVetoRule === "none" ? "None" : s.tradeVetoRule === "commissioner" ? "Commissioner" : "League Vote")}
          {summaryRow("Schedule", `${s.weekCount} weeks (${schedule.length} tournaments)`)}
          {summaryRow("Points", `${s.regularSeasonPoints} reg / ${s.majorSeasonPoints} major`)}
          <div style={{ marginTop: 18 }}>
            <p style={lbl}>Draft Date</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="date" style={{ ...inp, flex: 1 }} value={s.draftDate} onChange={(e) => set("draftDate", e.target.value)} />
              <input type="time" style={{ ...inp, flex: 1 }} value={s.draftTime} onChange={(e) => set("draftTime", e.target.value)} />
            </div>
          </div>
          {error && <p style={{ color: C.red, fontSize: 13, margin: "12px 0 0" }}>{error}</p>}
        </div>
      );
      default: return null;
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: C.bg, display: "flex", flexDirection: "column", maxWidth: 430, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: `1px solid ${C.border}`, background: C.card }}>
        <button onClick={inviteCode ? onClose : step === 1 ? onClose : () => setStep(step - 1)} style={{ background: "none", border: "none", color: C.txt2, fontSize: 14, cursor: "pointer", padding: 0 }}>
          {inviteCode ? "Done" : step === 1 ? "Cancel" : "Back"}
        </button>
        <span style={{ color: C.txt, fontSize: 14, fontWeight: 600 }}>{inviteCode ? "Success" : `Step ${step} of 6`}</span>
        <div style={{ width: 40 }} />
      </div>
      {!inviteCode && <div style={{ height: 3, background: C.border }}><div style={{ height: 3, background: C.green, width: `${(step / 6) * 100}%`, transition: "width 0.2s" }} /></div>}
      {!inviteCode && <div style={{ padding: "20px 16px 0" }}><p style={{ color: C.txt, fontSize: 22, fontWeight: 700, margin: 0 }}>{stepTitles[step - 1]}</p></div>}
      <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>{renderStep()}</div>
      {!inviteCode && (
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.border}`, background: C.card }}>
          {step < 6 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: canNext ? C.green : C.border, color: canNext ? "#fff" : C.txt3, fontSize: 15, fontWeight: 700, cursor: canNext ? "pointer" : "default" }}>Continue</button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting} style={{ width: "100%", padding: "14px", borderRadius: 10, border: "none", background: submitting ? C.border : C.green, color: submitting ? C.txt3 : "#fff", fontSize: 15, fontWeight: 700, cursor: submitting ? "default" : "pointer" }}>{submitting ? "Creating..." : "Create League"}</button>
          )}
        </div>
      )}
    </div>
  );
}
