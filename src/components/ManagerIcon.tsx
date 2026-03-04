interface ManagerIconProps {
  size?: number;
  bgColor: string;
  ballColor: string;
}

export function ManagerIcon({ size = 30, bgColor, ballColor }: ManagerIconProps) {
  const r = size * 0.3; // ball radius
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg width={r * 2} height={r * 2} viewBox="0 0 20 20" fill="none">
        {/* Ball */}
        <circle cx="10" cy="10" r="9" fill={ballColor} />
        {/* Dimples */}
        <path d="M4.5 8 Q7 6.5 9.5 8" stroke={bgColor} strokeWidth="0.8" fill="none" opacity={0.45} />
        <path d="M6 12 Q9 10.5 12 12" stroke={bgColor} strokeWidth="0.8" fill="none" opacity={0.45} />
        <path d="M10.5 7 Q13 5.5 15.5 7" stroke={bgColor} strokeWidth="0.8" fill="none" opacity={0.45} />
        <path d="M3 11 Q5 9.5 7 11" stroke={bgColor} strokeWidth="0.7" fill="none" opacity={0.3} />
        <path d="M11 13 Q13.5 11.5 16 13" stroke={bgColor} strokeWidth="0.7" fill="none" opacity={0.3} />
      </svg>
    </div>
  );
}
