import { themes } from "../theme";

const C = themes.light;

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header style={{ marginBottom: 16 }}>
      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.txt }}>{title}</h1>
      {subtitle && <div style={{ marginTop: 2, fontSize: 14, color: C.txt2 }}>{subtitle}</div>}
    </header>
  );
}
