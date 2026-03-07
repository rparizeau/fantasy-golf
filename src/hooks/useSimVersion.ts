import { useState, useEffect, useRef } from "react";
import { getSimVersion, type SimVersion } from "../api";

const POLL_INTERVAL = 3000;

export function useSimVersion() {
  const [version, setVersion] = useState<SimVersion | null>(null);
  const [tick, setTick] = useState(0);
  const fingerprintRef = useRef("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    async function poll() {
      try {
        const v = await getSimVersion();
        if (cancelled) return;
        setVersion(v);
        const fp = `${v.tournamentId}:${v.phase}:${v.currentRound}:${v.fieldSize}:${v.cutLine}:${v.holesPlayed}`;
        if (fingerprintRef.current && fp !== fingerprintRef.current) {
          setTick((t) => t + 1);
        }
        fingerprintRef.current = fp;
      } catch {
        // silently retry next interval
      }
      if (!cancelled) {
        timer = setTimeout(poll, POLL_INTERVAL);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return { version, tick };
}
