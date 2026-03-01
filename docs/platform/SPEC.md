# Fantasy Golf League — Master Product Specification
### Working Title (Final Name TBD)
**Version:** 1.0  
**Last Updated:** February 28, 2026  
**Author:** Bobby + Claude  

---

## 1. Product Overview

Fantasy Golf League is a season-long fantasy golf platform where managers draft professional golfers, set weekly lineups, and compete on a money-earned leaderboard across a curated schedule of real PGA Tour tournaments. The product emphasizes the natural rhythm of professional golf — weekly tournament cadences, major championship tentpole events, and a cumulative season-long money race — to deliver an experience that mirrors the excitement of real golf fandom.

The platform is **not** a daily fantasy or gambling product. It is a traditional fantasy league experience — drafts, rosters, waivers, trades, and season-long competition — purpose-built for golf.

### Core Differentiators
- **Money-based scoring** — Fantasy earnings mirror real tournament purses, making majors naturally more valuable without artificial multipliers
- **Major Championship tentpole events** — Four marquee weekends per season where the UI transforms, stakes elevate, and Mulligans are disabled
- **The Caddy** — An AI-powered personal assistant that recommends lineups, draft picks, waiver targets, and Mulligan timing
- **The Mulligan** — A fantasy-golf-exclusive mechanic allowing managers to zero out a player's bad tournament score (configurable, disabled during majors)
- **Commissioner-controlled tournament selection** — Leagues draft or lottery-select which non-major tournaments fill their season schedule
- **Simulated admin portal for rapid development** — Real players and tournaments, fake scores, enabling full product testing before API integration

---

## 2. Platform Architecture

### 2.1 Commissioner Portal (Web)
The league creation and management interface for commissioners.

**Core Features:**
- League creation wizard (name, number of teams, invite system)
- Scoring configuration (base prize money, optional birdie/bogey/eagle/streak bonuses as fantasy dollars)
- Season settings (number of tournaments beyond the four mandatory majors, season start/end)
- Tournament selection setup (draft order or lottery for choosing non-major tournaments)
- Roster settings (roster size, active lineup size, number of reserve spots)
- Waiver settings (FAAB on/off, FAAB budget amount, waiver processing day/time)
- Mulligan settings (on/off, number per season, disabled during majors toggle)
- Undroppable player list (auto-generated from world rankings with commissioner override)
- Trade settings (commissioner approval, league vote, or unrestricted)
- Tiebreaker rules configuration
- Dispute resolution tools
- League communications / announcements

### 2.2 Consumer Web App (Responsive Web — Mobile + Desktop)
The primary manager-facing experience. This is where 95% of user time is spent.

**Core Features:**

**Draft Room**
- Live snake draft interface with pick timer
- Auto-draft powered by The Caddy when a manager is absent
- Player cards with stats, course history, recent form, world ranking
- Draft results and recap

**Tournament Selection**
- Interface for league to collectively select non-major tournaments
- Lottery or draft-style selection (commissioner configured)
- Calendar view showing the full season schedule once locked

**Roster Management**
- Full roster view with player status (active, reserve, injured/withdrawn)
- Weekly lineup setting — select active players for the upcoming tournament
- Reserve slot management
- Thursday morning lineup lock enforcement

**Waiver Wire**
- Browse available free agents with stats and Caddy recommendations
- Add/drop interface with FAAB bid entry (when enabled)
- Waiver claim priority display
- Wednesday 6:00 PM processing with results notification
- Undroppable player protections enforced

**Trades**
- Propose/accept/reject trade interface
- Trade review period (commissioner approval or league vote depending on settings)
- Trade history log

**The Mulligan**
- Mulligan activation interface during eligible tournaments (post-cut window on Friday evening)
- Clear display of remaining Mulligans for the season
- Disabled/locked UI during major championship weeks
- Confirmation flow — "Are you sure? You have X Mulligans remaining this season."

**Live Tournament Experience**
- Real-time leaderboard showing all fantasy teams ranked by tournament money earned
- Per-player scoring breakdown (money earned, bonus points if enabled)
- Player-by-player hole scores and round progress
- Cut line tracking on Thursday/Friday — visual indicator of which rostered players are in danger
- Post-cut Mulligan window (if applicable)

**Season Leaderboard**
- Cumulative money-earned standings across all completed tournaments
- Tournament-by-tournament earnings history per team
- Head-to-head comparisons between managers
- Trends and momentum indicators

**The Caddy (AI Assistant)**
- Pre-tournament lineup recommendations with reasoning
- Draft pick suggestions during live drafts
- Waiver wire pickup recommendations
- Drop warnings when a player is trending upward
- Mulligan usage analysis — "If you had used your Mulligan here, you'd have gained X positions"
- Auto-draft logic when manager is unavailable
- Powered by player stats, course history, recent form, and tournament conditions

**Course Detail Pages**
- Course photography and imagery for the current week's tournament
- Course layout and signature holes
- Historical stats and past winners
- Par, yardage, and course characteristics

**League Social**
- League activity feed (draft picks, trades, waiver moves, Mulligan usage)
- In-app messaging or chat per league
- Trash talk and reactions

**UI/UX Principles**
- Monday–Wednesday: Calm, refined aesthetic — strategy and planning mode
- Thursday–Sunday: Energized, live tournament mode with real-time updates
- Major Championship Weeks: Elevated, transformed UI — distinct color palettes per major (Masters green, PGA blue, etc.), premium imagery, intensified leaderboard presentation
- Course-specific theming each tournament week

### 2.3 Admin Portal (Internal)
The operational backend that powers the fantasy world with real-world data.

**Core Features:**
- Player database management (PGA Tour roster, world rankings, player status)
- Tournament database (schedule, courses, purse amounts, entry lists)
- Score ingestion and processing pipeline
- Injury and withdrawal tracking
- Stat correction tools with approval workflow
- Score status management (pending → approved → final)
- Push mechanism to broadcast approved data to all connected clients in real-time

**Simulation Engine (MVP Phase)**
- Seed database with real PGA Tour players, tournaments, courses, and purse data
- Generate realistic fake scores per round per player
- Simulate mid-tournament withdrawals and injuries
- Simulate cut lines
- Trigger leaderboard updates on demand or on a schedule
- Enable full end-to-end product testing without live data dependency
- Designed to be swapped out for real API integration when ready

---

## 3. Season Structure

### 3.1 Season Window
The default season window runs approximately **March through August** (roughly 6 months), capturing:
- Pre-major signature events (The Players Championship, Genesis, Arnold Palmer Invitational)
- All four major championships (April–July)
- FedEx Cup playoff events (August)

Commissioners can configure shorter seasons (e.g., April–July for a tighter 4-month experience). The platform supports flexible scheduling.

### 3.2 Mandatory Tournaments
Every league must include the four major championships:

| Major | Typical Week | Approximate Purse |
|---|---|---|
| The Masters | 2nd week of April | $20M |
| PGA Championship | 3rd week of May | $17.5M |
| U.S. Open | 3rd week of June | $21.5M |
| The Open Championship | 3rd week of July | $17M |

*Purse amounts are approximate and will be updated annually via the admin portal.*

### 3.3 Commissioner-Selected Tournaments
Beyond the four majors, the commissioner sets how many additional tournaments the league will play (recommended 6–12). The league collectively selects these tournaments via one of two methods:

- **Tournament Draft** — Snake draft order, managers take turns selecting tournaments from the available PGA Tour schedule
- **Lottery** — Randomized selection from commissioner-curated shortlist

Once selected, the full season calendar is locked and visible to all managers.

### 3.4 Weekly Cadence

| Day | Activity |
|---|---|
| Monday–Tuesday | Cooldown — results finalize, digest previous tournament |
| Wednesday | Strategy day — waiver wire active, roster moves, lineup planning. **Waivers process at 6:00 PM.** |
| Thursday (AM) | **Lineups lock.** Tournament begins. Cut line watch. |
| Friday (PM) | **Cut announced.** Post-cut Mulligan window opens (non-major weeks only). |
| Saturday–Sunday | Weekend rounds. Live leaderboard updates. Tournament concludes Sunday. |

### 3.5 Season Conclusion
The season ends after the final scheduled tournament. The manager atop the cumulative money leaderboard wins. **There are no playoffs.** The major championships serve as natural high-stakes tentpole events throughout the season.

---

## 4. Scoring System

### 4.1 Base Scoring — Prize Money Earned
Each golfer on a manager's active lineup earns fantasy money equivalent to the real prize money they would earn based on their finishing position in that tournament. Prize money distribution is based on actual PGA Tour payout structures per tournament.

**Examples (approximate):**
- Win the Masters → ~$3.6M
- Finish 10th at the Masters → ~$576K
- Finish 40th at the Masters → ~$115K
- Miss the cut → $0

This naturally weights majors and signature events higher due to larger purses.

### 4.2 Bonus Scoring (Commissioner Configurable — Optional)
Commissioners can enable bonus fantasy dollars for individual player performance:

- **Birdie bonus** — Configurable fantasy dollar amount per birdie
- **Eagle bonus** — Configurable fantasy dollar amount per eagle
- **Bogey penalty** — Configurable fantasy dollar deduction per bogey
- **Double bogey+ penalty** — Configurable deduction for double bogey or worse
- **Birdie streak bonus** — Bonus for consecutive birdies (e.g., 3+ birdies in a row)
- **Hole-in-one bonus** — Special bonus amount
- **Tournament win bonus** — Additional fantasy dollars for outright victory

### 4.3 Missed Cut
A player who misses the cut earns **$0** in prize money for that tournament. Any applicable bonus/penalty scoring from Thursday–Friday rounds still counts if bonus scoring is enabled.

---

## 5. The Mulligan

A league-exclusive mechanic unique to fantasy golf.

### 5.1 What It Does
When activated, a Mulligan **zeros out** a selected player's score for that tournament. The player's earnings (and any bonuses/penalties) are wiped as if they didn't play. This is a safety net for a catastrophic performance.

**Important:** The Mulligan does NOT replace the score with another player. It simply removes the damage. This prevents abuse scenarios where a manager swaps a -2 player for a -12 player retroactively.

### 5.2 Commissioner Settings
- **Mulligans on/off** — Global toggle
- **Number per season** — Typically 1–3 (default: 1)
- **Disabled during majors** — Toggle (default: ON — Mulligans cannot be used during major championships)

### 5.3 Activation Window
The Mulligan window opens **Friday evening after the cut is announced** and closes at a defined time (e.g., Saturday 8:00 AM before Round 3 tee times). This creates a time-pressured strategic decision point.

### 5.4 UX Flow
1. Cut is announced Friday evening
2. Manager receives notification that Mulligan window is open (non-major weeks only)
3. Manager reviews their roster's post-cut status
4. Manager can activate Mulligan on one player, zeroing their tournament score
5. Confirmation dialog: "You are using 1 of your X remaining Mulligans this season. [Player Name]'s earnings and bonuses for this tournament will be set to $0. This cannot be undone."
6. Mulligan counter decrements

---

## 6. Waiver System

### 6.1 Waiver Wire
After each tournament, managers can pick up free agents and drop rostered players during the waiver period.

### 6.2 Waiver Processing
- **Processing time:** Wednesday at 6:00 PM (configurable by commissioner)
- **Priority system (non-FAAB):** Inverse standings order — worst team in the money leaderboard gets first waiver priority. Priority resets weekly based on current standings.
- **FAAB (Free Agent Acquisition Budget):** When enabled, managers receive a season-long budget (default: $100, configurable). Blind bids are submitted by the waiver deadline. Highest bid wins. Ties broken by waiver priority. Budget does not replenish.

### 6.3 Undroppable Players
Top-tier players (based on world ranking threshold, configurable by commissioner) cannot be dropped to the free agent pool. This prevents league-destroying moves (rage drops, tanking, collusion).

Commissioner can:
- Set the threshold (e.g., top 25 in world rankings)
- Manually add/remove players from the undroppable list

### 6.4 Trades
- Managers can propose player-for-player trades at any time
- Review period before execution (commissioner configurable: immediate, commissioner approval, or league vote with majority required)
- Trade deadline setting (optional — commissioner can set a date after which no trades are allowed)
- Full trade history log visible to the league

---

## 7. Roster Construction

### 7.1 Settings (All Commissioner Configurable)
- **Total roster size:** Number of golfers each manager drafts (recommended: 10–14)
- **Active lineup size:** Number of golfers set as active each tournament week (recommended: 4–6)
- **Reserve spots:** Number of reserve/inactive slots (recommended: 1–3)

### 7.2 Reserve Slots
- A manager can place a player on reserve if the player is **not on the tournament entry list** or has **officially withdrawn**
- Reserved players do not count toward the active lineup limit
- Reserved players cannot earn money for the manager that week
- Designed to protect managers from being forced to drop injured/resting players

### 7.3 Lineup Lock
All lineups lock **Thursday morning** before the first tee time of the tournament. No changes can be made from Thursday through Sunday.

---

## 8. The Caddy (AI-Powered Assistant)

### 8.1 Overview
The Caddy is each manager's personal AI-powered strategic advisor. It lives within the consumer web app and provides contextual recommendations throughout the season.

### 8.2 Capabilities
- **Lineup Recommendations:** Before each tournament, The Caddy suggests an optimal lineup based on player form, course history, course fit (statistical matchups), and recent performance trends
- **Draft Advisor:** During the live draft, The Caddy whispers pick suggestions and flags value opportunities
- **Auto-Draft:** When a manager is unavailable for the draft, The Caddy runs their draft using an intelligent algorithm (not just best available by ranking)
- **Waiver Recommendations:** Flags trending free agents worth picking up and warns before dropping a player on an upswing
- **Mulligan Analysis:** Post-tournament analysis showing the impact a Mulligan would have had, helping managers decide when to use their remaining Mulligans
- **Player Insights:** On-demand analysis of any player — recent form, course history, strengths/weaknesses

### 8.3 Technical Approach
The Caddy is powered by the platform's player statistics database and historical performance data. Implementation will leverage AI/ML for recommendations. Detailed technical design TBD during build phase — Claude CLI to determine stack.

---

## 9. Real-Time Architecture

### 9.1 Core Requirement
When the admin portal approves a score update, stat correction, injury status change, or any data modification, that change must propagate to all connected clients **immediately** — no polling, no manual refresh.

### 9.2 Data Flow
1. Admin portal receives data (via simulation engine in MVP, via API integration in production)
2. Admin reviews and approves (or auto-approves based on confidence rules)
3. Approved data pushes to all connected consumer web app clients via WebSocket or equivalent
4. Fantasy leaderboards, player scores, and tournament standings update in real-time
5. Notifications fire for relevant events (cut announcements, Mulligan windows, waiver results)

### 9.3 Key Real-Time Events
- Round score updates (hole-by-hole or round-level)
- Cut line updates and announcements
- Player withdrawal mid-tournament
- Stat corrections
- Waiver processing results
- Trade completions
- Mulligan activations (visible to the league)

---

## 10. Technical Stack

**To be determined by Claude CLI.** The spec is stack-agnostic. Key requirements for stack selection:

- Real-time WebSocket support for live updates
- Responsive web framework (mobile-first, desktop-capable)
- Robust database for player stats, tournament history, league configurations, and financial scoring
- API-ready architecture to swap simulation engine for live data provider (SportsData.io, SportRadar, or equivalent)
- AI/ML integration capability for The Caddy feature
- Authentication and league invitation system
- Push notification support

---

## 11. Data Integration Strategy

### 11.1 Phase 1 — Simulated Data (MVP)
- Real PGA Tour players seeded into the database (names, world rankings, historical stats)
- Real tournament schedule and course data
- Simulated scores generated by the admin portal simulation engine
- Enables full end-to-end testing of all fantasy mechanics

### 11.2 Phase 2 — Live API Integration
- Integrate with a golf data provider (SportsData.io is the leading candidate for cost/coverage balance)
- Live scoring data ingested during tournaments
- Admin portal shifts from simulation to review/approval of incoming live data
- Stat correction workflow for post-round adjustments

### 11.3 Data Requirements
- Player profiles and biographical data
- World rankings (updated weekly)
- Tournament entry lists
- Live hole-by-hole scoring
- Round-by-round results and leaderboards
- Official prize money payouts per tournament
- Player injury/withdrawal status
- Historical course performance data (for The Caddy)

---

## 12. Open Items

The following items require further definition before or during build:

1. **Product Name** — Working title is "Fantasy Golf League." Final name TBD.
2. **Roster size sweet spot** — Needs playtesting via simulation. Recommended starting point: 12-player roster, 5-player active lineup, 2 reserve spots.
3. **Tiebreaker rules** — How to break ties on the season leaderboard. Candidates: most tournament wins, highest single-tournament earnings, best major championship finish, head-to-head record in shared tournaments.
4. **Bonus scoring calibration** — If bonus fantasy dollars are enabled, what amounts feel balanced relative to real prize money? Needs testing.
5. **The Caddy technical implementation** — AI/ML approach, data models, recommendation algorithms. To be designed during build phase.
6. **Mulligan window exact timing** — Friday evening post-cut to Saturday AM is the concept. Exact times need to be defined relative to tournament schedules.
7. **Mid-tournament engagement features** — Live chat, prop bets between managers, or other in-tournament social features beyond the leaderboard.
8. **Monetization model** — Free with premium tiers? Subscription? Commissioner pays? TBD.
9. **Tournament selection UX** — Exact mechanics of the tournament draft/lottery. Does the commissioner curate a shortlist or is the full PGA Tour schedule available?
10. **Multi-season support** — Keeper leagues, dynasty formats, historical records across seasons. Future consideration.
11. **LIV Golf / DP World Tour inclusion** — Are only PGA Tour events eligible, or can commissioners select from other tours? Player eligibility across tours.

---

## 13. Design Direction

### 13.1 Overall Aesthetic
Elegant, refined, and premium. Golf is a gentleman's game and the design should reflect that — clean typography, sophisticated color palettes, generous whitespace. Think luxury sports brand, not ESPN fantasy.

### 13.2 Weekly UI Modes
- **Monday–Wednesday (Planning Mode):** Calm, muted tones. Focus on strategy tools, roster management, waiver wire. Relaxed visual energy.
- **Thursday–Sunday (Tournament Mode):** Energized, dynamic. Live leaderboard prominence, real-time score animations, cut line drama. Elevated visual intensity.

### 13.3 Major Championship Transformation
Each major week, the app's visual identity transforms:
- **The Masters:** Augusta green palette, azalea imagery, premium refinement
- **PGA Championship:** Bold blue palette, course-specific photography
- **U.S. Open:** Red/white/blue palette, American grandeur
- **The Open Championship:** Earthy tones, links course imagery, British elegance

These transformations should be immediately noticeable and create a sense of occasion.

### 13.4 Course Pages
Each tournament week features a dedicated course page with real photography, hole layouts, signature hole highlights, and historical context. This grounds the fantasy experience in the real world of golf.

---

*This document serves as the master product specification for Fantasy Golf League. All development sessions should reference this spec for feature scope, business logic, and design direction. Tech stack decisions and implementation details will be layered on top by Claude CLI.*
