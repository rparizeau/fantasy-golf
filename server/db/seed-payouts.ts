import { db } from "./index.js";
import { payouts } from "./schema/index.js";

const PCTS = [
  18.0, 10.9, 6.9, 4.9, 4.1, 3.65, 3.4, 3.15, 2.95, 2.75,
  2.55, 2.35, 2.15, 1.95, 1.8, 1.65, 1.55, 1.45, 1.35, 1.25,
  1.15, 1.06, 0.98, 0.9, 0.84, 0.78, 0.75, 0.72, 0.69, 0.66,
  0.62, 0.58, 0.54, 0.5, 0.48, 0.46, 0.44, 0.42, 0.4, 0.38,
  0.36, 0.34, 0.32, 0.3, 0.282, 0.264, 0.246, 0.23, 0.216, 0.208,
  0.202, 0.196, 0.19, 0.186, 0.182, 0.178, 0.174, 0.17, 0.166, 0.162,
  0.158, 0.154, 0.15, 0.131, 0.111,
];

const REGULAR_TOTAL = 500;
const MAJOR_TOTAL = 700;

async function seed() {
  const totalPct = PCTS.reduce((a, b) => a + b, 0);

  const rows = PCTS.map((pct, i) => ({
    position: i + 1,
    pct,
    regularPoints: Math.round((pct / totalPct) * REGULAR_TOTAL * 10) / 10,
    majorPoints: Math.round((pct / totalPct) * MAJOR_TOTAL * 10) / 10,
  }));

  for (const row of rows) {
    await db.insert(payouts).values(row).onConflictDoUpdate({
      target: payouts.position,
      set: { pct: row.pct, regularPoints: row.regularPoints, majorPoints: row.majorPoints },
    });
  }

  console.log(`Seeded ${rows.length} payout rows`);
  console.log(`Regular total: ${rows.reduce((a, r) => a + r.regularPoints, 0).toFixed(1)} pts`);
  console.log(`Major total: ${rows.reduce((a, r) => a + r.majorPoints, 0).toFixed(1)} pts`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
