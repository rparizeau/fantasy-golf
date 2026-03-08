# Fantasy Golf League — Scoring System & Schema Spec
**Version:** 1.1
**Last Updated:** March 7, 2026
**Author:** Bobby + Claude  

---

## Overview

The scoring system has two layers:

1. **Per-hole points** — Real-time scoring that accumulates throughout a tournament. This is what you watch climb while following the action.
2. **Season points** — Awarded based on where your fantasy team finishes in your league each week. This is what determines the season standings.

---

## Layer 1: Per-Hole Scoring

Points are earned (or lost) on every hole a rostered active player completes.

| Result | Points | Notes |
|---|---|---|
| Par | +1 | Baseline — every hole adds to your total |
| Birdie | +3 | Core scoring driver |
| Eagle | +6 | Big swing moment |
| Albatross | +10 | Extremely rare, deserves a spike |
| Hole-in-One | +8 | Bonus on top of birdie/eagle value* |
| Bogey | 0 | Flat — no gain, no loss |
| Double Bogey | -1 | Slight penalty |
| Triple Bogey+ | -2 | Cap the damage |

*Hole-in-one is scored as its result type (birdie +3 or eagle +6) PLUS a +8 bonus = 11 or 14 total.

### Why This Scale Works
- **Points almost always climb.** Pars are +1, so a boring stretch of golf still adds to your total. You're never stuck watching a flatline.
- **Birdies are the main currency.** At +3 vs par's +1, every birdie your player makes is a +2 swing over the field. Easy to track in your head: "He just birdied, that's 2 more than if he'd parred."
- **Bogeys don't kill you.** Zero points means you just missed a chance to gain — no devastating drops. But doubles/triples do sting slightly.
- **Eagles and aces are electric.** Rare enough to be exciting, valuable enough to matter.

### Typical Player Output (4 rounds, 72 holes)

| Player Type | Pars | Birdies | Eagles | Bogeys | Doubles | Approx Points |
|---|---|---|---|---|---|---|
| Elite week (wins) | 36 | 24 | 2 | 9 | 1 | ~119 |
| Solid week (top 10) | 40 | 18 | 1 | 11 | 2 | ~96 |
| Average week (top 30) | 42 | 14 | 0 | 13 | 3 | ~81 |
| Made cut barely | 44 | 10 | 0 | 15 | 3 | ~71 |
| Missed cut (2 rounds) | 22 | 5 | 0 | 8 | 1 | ~36 |

### Team-Level Weekly Output (4 active players — "The Foursome")

| Team Performance | Approx Weekly Points |
|---|---|
| Dominant week | 400–450 |
| Strong week | 340–390 |
| Average week | 300–340 |
| Rough week | 240–300 |

### All Scoring Is Commissioner Configurable

The point values above are the platform defaults. Commissioners can change any value, disable any event, or activate additional events during league setup. The schema supports this through the SCORING_EVENTS and LEAGUE_SCORING tables described below.

---

## Layer 2: Season Points (Weekly Finish Position)

After each tournament, fantasy teams are ranked by their total per-hole points that week. Season points are awarded based on finish position. This is the FedEx Cup–style layer that determines season standings.

### Tournament Tiers

| Tier | Base Points | When Used |
|---|---|---|
| Regular | 500 | All non-major tournaments |
| Major | 700 | Masters, PGA Championship, U.S. Open, The Open |

### Season Points Distribution (Percentage-Based)

Season points are calculated as a percentage of the tier's base points. The percentage curve scales to any league size (8–16 teams), keeping the shape consistent: steep at the top, flattening toward the bottom, with last place always earning ~20%.

#### 8-Team League

| Finish | Pct | Regular (500) | Major (700) |
|---|---|---|---|
| 1st | 100% | 500 | 700 |
| 2nd | 78% | 390 | 546 |
| 3rd | 62% | 310 | 434 |
| 4th | 50% | 250 | 350 |
| 5th | 42% | 210 | 294 |
| 6th | 35% | 175 | 245 |
| 7th | 28% | 140 | 196 |
| 8th | 22% | 110 | 154 |

#### 10-Team League

| Finish | Pct | Regular (500) | Major (700) |
|---|---|---|---|
| 1st | 100% | 500 | 700 |
| 2nd | 80% | 400 | 560 |
| 3rd | 65% | 325 | 455 |
| 4th | 55% | 275 | 385 |
| 5th | 48% | 240 | 336 |
| 6th | 42% | 210 | 294 |
| 7th | 36% | 180 | 252 |
| 8th | 32% | 160 | 224 |
| 9th | 26% | 130 | 182 |
| 10th | 22% | 110 | 154 |

#### 12-Team League

| Finish | Pct | Regular (500) | Major (700) |
|---|---|---|---|
| 1st | 100% | 500 | 700 |
| 2nd | 80% | 400 | 560 |
| 3rd | 66% | 330 | 462 |
| 4th | 56% | 280 | 392 |
| 5th | 48% | 240 | 336 |
| 6th | 42% | 210 | 294 |
| 7th | 37% | 185 | 259 |
| 8th | 33% | 165 | 231 |
| 9th | 29% | 145 | 203 |
| 10th | 26% | 130 | 182 |
| 11th | 23% | 115 | 161 |
| 12th | 20% | 100 | 140 |

#### 16-Team League

| Finish | Pct | Regular (500) | Major (700) |
|---|---|---|---|
| 1st | 100% | 500 | 700 |
| 2nd | 80% | 400 | 560 |
| 3rd | 65% | 325 | 455 |
| 4th | 55% | 275 | 385 |
| 5th | 48% | 240 | 336 |
| 6th | 42% | 210 | 294 |
| 7th | 37% | 185 | 259 |
| 8th | 33% | 165 | 231 |
| 9th | 30% | 150 | 210 |
| 10th | 27% | 135 | 189 |
| 11th | 25% | 125 | 175 |
| 12th | 23% | 115 | 161 |
| 13th | 21% | 105 | 147 |
| 14th | 20% | 100 | 140 |
| 15th | 19% | 95 | 133 |
| 16th | 18% | 90 | 126 |

### Handling Ties in Weekly Finish

When fantasy teams tie in weekly per-hole points, average the season points across tied positions (same as PGA Tour method).

**Example:** Two teams tie for 2nd in a regular tournament.
- 2nd place: 400 pts, 3rd place: 325 pts
- Each tied team receives: (400 + 325) / 2 = **362.5 pts**

Half points are fine — they'll wash out over the season.

---

## Season Dynamics

### Sample 10-Team League, 12-Tournament Season (8 regular + 4 majors)

| Scenario | Regular Pts (8 wks) | Major Pts (4 wks) | Season Total |
|---|---|---|---|
| Dominant season (avg 1st–2nd) | ~3,600 | ~2,520 | ~6,120 |
| Strong season (avg 2nd–3rd) | ~2,900 | ~2,030 | ~4,930 |
| Mid-pack (avg 5th) | ~1,920 | ~1,344 | ~3,264 |
| Bottom tier (avg 9th–10th) | ~960 | ~672 | ~1,632 |

**Key insight:** In a 10-team league, the gap between 1st and 2nd each regular week is 100 points — the same as the gap between 5th and 10th. Winning weeks is disproportionately rewarded, but the middle of the pack stays compressed, keeping the season competitive.

### Can You Do the Math Mid-Season?

Yes — and that's the point. If you're trailing the leader by 400 season points with 3 weeks left, you know exactly what you need: win one and finish top 3 in the others. The fixed scale makes it calculable, unlike money-based systems where purse variations make the math fuzzy.

---

## Roster Construction

### Defaults
- **Active slots:** 4 ("The Foursome")
- **Bench slots:** 4
- **Total roster:** 8
- All settings are configurable by the commissioner during league setup
- No positional requirements — every golfer is eligible for every slot

### Waiver Wire Impact by League Size (at 8-man rosters)

| League Size | Total Rostered | Est. Free Agents | Wire Feel |
|---|---|---|---|
| 8 teams | 64 | ~55–60 | Very healthy |
| 10 teams | 80 | ~40–45 | Healthy |
| 12 teams | 96 | ~25–30 | Moderate |
| 14 teams | 112 | ~10–15 | Tight but alive |
| 16 teams | 128 | ~0–5 | Very thin, trade market essential |

### Weekly Lineup Lock
All lineups lock Thursday morning before the first tee time. No changes from Thursday through Sunday. A new lineup is set each tournament week.

---

## Data Schema

### Global Reference Tables

These tables are platform-level and shared across all leagues.

**GOLFERS** — Master player table, one row per professional golfer.
- Biographical info (name, country, photo URL)
- Current world ranking (updated weekly)
- Tour status (active, injured, etc.)
- Populated and maintained by the admin portal

**TOURNAMENTS** — Master tournament table, one row per real-world tournament.
- Tournament name, course name, location
- Start/end dates, purse amount
- Tier: `regular` or `major` (drives season points base — extensible to `signature` in the future)
- Field size, cut rule
- Status: `upcoming`, `live`, `complete`

**TOURNAMENT_ENTRY_LIST** — Which golfers are entered in which tournament.
- Links GOLFERS to TOURNAMENTS
- Entry status: `confirmed`, `withdrawn`, `cut`, `completed`
- Used for roster validation — managers can only start players in the field

**SCORING_EVENTS** — The master menu of all possible scoring triggers.
- ID: semantic key (`birdie`, `eagle`, `par`, `bogey`, `double_bogey`, `triple_bogey_plus`, `albatross`, `hole_in_one`)
- Label: display name ("Birdie", "Eagle", etc.)
- Description: human-readable explanation
- Category enum: `hole_outcome` or `bonus` (extensible for future categories)
- Default points: the platform-suggested value new leagues start with
- Sort order: for display in commissioner setup and scoring breakdowns

**SEASON_POINTS_TEMPLATE** — Percentage-based distribution table.
- League size (8, 10, 12, 14, 16)
- Finish position (1st through league size)
- Percentage of base points
- Used to calculate season points: `finish_pct × tier_base_points`

---

### League-Scoped Tables

**LEAGUES** — One row per fantasy league.
- League name, commissioner user ID, season year
- League size (8–16 teams)
- Roster construction settings (active slots, bench slots, total roster size)
- Waiver, trade, and other game settings
- All scoring behavior is driven by LEAGUE_SCORING, not stored here

**LEAGUE_TEAMS** — One row per team in a league (the manager's identity within a league).
- User ID, team name, league ID
- Draft position
- A user can be in multiple leagues with different teams

**LEAGUE_TOURNAMENTS** — Which tournaments a league is playing that season.
- Links LEAGUES to TOURNAMENTS
- Selection order (week numbering for the league's schedule)
- Four majors auto-included; remaining selected by the league

**LEAGUE_SCORING** — Each league's customized scoring configuration.
- League ID
- Scoring event ID
- Points value (initialized from SCORING_EVENTS.default_points, commissioner can adjust)
- Active flag (commissioner can disable an event without deleting the row)
- Pre-populated with all scoring events at default values when a league is created

---

### Roster & Lineup Tables

**GOLFER_ROSTER** — The weekly lineup table. One row per golfer per team per tournament week.
- League team ID (which manager)
- Golfer ID (which player)
- League tournament ID (which tournament on this league's schedule)
- Slot: `active` or `bench`
- Status: `set`, `locked` (after Thursday lock), `withdrawn` (if player WDs mid-tournament)
- Acquired via: `draft`, `waiver`, `trade`

**Key design:** Each tournament week gets its own set of rows. This is a snapshot, not a mutable "current roster." If a manager trades a player in week 6, week 5 still shows that player on their team. The lineup locked on Thursday is immutable for that tournament.

**ROSTER_TRANSACTIONS** — Append-only log of every roster move.
- League team ID, golfer ID
- Transaction type: `drafted`, `added`, `dropped`, `traded_away`, `traded_for`
- Timestamp
- Related transaction ID (links trade pairs)
- FAAB bid amount (if applicable)
- Never deleted, never modified — this is the audit trail and activity feed

---

### Scoring Results Tables

**SCORED_EVENTS** — The fact table. One row per scoring event per golfer per hole per round.
- Golfer roster ID (links to the specific golfer on the specific team's lineup for that tournament — this is the full context chain)
- Scoring event ID (what happened: birdie, eagle, etc.)
- Round number (1–4)
- Hole number (1–18)
- Points earned (denormalized — stamped at time of recording from LEAGUE_SCORING)
- Timestamp

**Critical rule:** `points_earned` is written once and never recalculated. If a commissioner changes birdie from 3 to 5 mid-season, only future events use the new value. Historical scores are preserved.

**One row per event:** A birdie on hole 7 = one row. A hole-in-one on a par 3 = two rows (one birdie at +3, one hole-in-one bonus at +8). This keeps scoring breakdowns trivial to query.

**WEEKLY_TEAM_RESULTS** — Aggregated results per team per tournament week.
- League team ID
- League tournament ID
- Total per-hole points (sum of SCORED_EVENTS.points_earned for this team's active roster)
- Weekly finish position (rank among all league teams)
- Season points earned (finish position → SEASON_POINTS_TEMPLATE percentage × tier base)

**SEASON_STANDINGS** — Running season totals, denormalized for fast leaderboard queries.
- League team ID
- Total season points (sum of all weekly season points)
- Tournaments played
- Best/worst weekly finish
- Weekly wins count

---

### Data Flow: From Birdie to Season Leaderboard

```
1. Birdie on hole 7, round 2
   → SCORED_EVENTS row: golfer_roster_id, scoring_event_id="birdie",
     round=2, hole=7, points_earned=3

2. All SCORED_EVENTS for the team's active roster that week
   → Summed into WEEKLY_TEAM_RESULTS.total_points

3. All teams ranked by total_points
   → WEEKLY_TEAM_RESULTS.finish_position determined

4. Finish position → SEASON_POINTS_TEMPLATE percentage × tier base
   → WEEKLY_TEAM_RESULTS.season_points_earned

5. Season points accumulated
   → SEASON_STANDINGS updated
```

---

### Key Relationships

```
GOLFERS (global)
  → TOURNAMENT_ENTRY_LIST → TOURNAMENTS (global)
  → GOLFER_ROSTER → LEAGUE_TEAMS → LEAGUES
                  → LEAGUE_TOURNAMENTS → TOURNAMENTS

SCORING_EVENTS (global)
  → LEAGUE_SCORING → LEAGUES
  → SCORED_EVENTS → GOLFER_ROSTER

SCORED_EVENTS → WEEKLY_TEAM_RESULTS → SEASON_STANDINGS
```

---

### Flexibility Requirements

- All roster construction is configurable per league (active, bench, total)
- All scoring is configurable per league (point values, active/inactive events)
- Season points distribution is stored in a `payouts` database table with separate `regular_points` and `major_points` columns per position (1st–65th). Seeded via `server/db/seed-payouts.ts`
- Tournament tiers use an enum or reference table that's easy to extend (`regular`, `major`, and eventually `signature`)
- No positional requirements — every golfer is eligible for every slot

---

*This document defines the scoring system, roster construction, and data schema for Fantasy Golf League. Hand the schema section to Claude CLI for implementation. Stack choice is up to Claude CLI.*
