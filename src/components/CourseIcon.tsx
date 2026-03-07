interface CourseIconProps {
  size?: number;
  bgColor: string;
  flagColor: string;
}

export function CourseIcon({ size = 42, bgColor, flagColor }: CourseIconProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.2),
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Pole */}
        <line x1="7" y1="3" x2="7" y2="21" stroke={flagColor} strokeWidth="1.8" strokeLinecap="round" />
        {/* Flag */}
        <path d="M7 3 L19 7 L7 11 Z" fill={flagColor} opacity={0.9} />
        {/* Ground */}
        <ellipse cx="12" cy="21" rx="6" ry="1.5" fill={flagColor} opacity={0.4} />
      </svg>
    </div>
  );
}
