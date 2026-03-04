import { useState, useRef, useCallback, type ReactNode } from "react";
import type { Theme } from "../theme";

const THRESHOLD = 60;
const MAX_PULL = 100;

export function PullToRefresh({ onRefresh, colors: C, children }: {
  onRefresh: () => Promise<void>;
  colors: Theme;
  children: ReactNode;
}) {
  const [display, setDisplay] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);
  const pullY = useRef(0);
  const active = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0 && !refreshing) {
      startY.current = e.touches[0].clientY;
      active.current = true;
    }
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!active.current) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 0) {
      pullY.current = Math.min(diff * 0.5, MAX_PULL);
      setDisplay(pullY.current);
    } else {
      active.current = false;
      pullY.current = 0;
      setDisplay(0);
    }
  }, []);

  const onTouchEnd = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    if (pullY.current >= THRESHOLD) {
      setRefreshing(true);
      setDisplay(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setDisplay(0);
      }
    } else {
      setDisplay(0);
    }
    pullY.current = 0;
  }, [onRefresh]);

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      {(display > 0 || refreshing) && (
        <div style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: display,
          overflow: "hidden",
        }}>
          <div style={{
            width: 24,
            height: 24,
            border: `3px solid ${C.border}`,
            borderTopColor: C.green,
            borderRadius: "50%",
            animation: refreshing ? "spin 0.7s linear infinite" : undefined,
            transform: !refreshing ? `rotate(${display * 4}deg)` : undefined,
            opacity: Math.min(display / THRESHOLD, 1),
          }} />
        </div>
      )}
      {children}
    </div>
  );
}
