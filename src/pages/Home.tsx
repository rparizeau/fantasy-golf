import type { Theme } from "../theme";

interface HomeProps {
  leagueId: number;
  myTeamId: number;
  colors: Theme;
}

export function Home({ colors: C }: HomeProps) {
  return (
    <div style={{ padding: "20px 16px 100px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 300,
          borderRadius: 14,
          border: `2px dashed ${C.border}`,
          background: C.card,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ color: C.txt, fontSize: 18, fontWeight: 600, margin: "0 0 4px" }}>Home</p>
          <p style={{ color: C.txt3, fontSize: 13, margin: 0 }}>Coming soon</p>
        </div>
      </div>
    </div>
  );
}
