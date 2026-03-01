import type { Theme } from "../theme";

interface ThemeToggleProps {
  isDark: boolean;
  colors: Theme;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, colors: C, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 26,
        borderRadius: 13,
        border: `1px solid ${C.border}`,
        background: isDark ? C.greenDim : C.card2,
        cursor: "pointer",
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: isDark ? "flex-end" : "flex-start",
        paddingInline: 3,
        transition: "all .25s",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: isDark ? C.green : "#CBD0D6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          transition: "all .25s",
        }}
      >
        {isDark ? "🌙" : "☀️"}
      </div>
    </button>
  );
}
