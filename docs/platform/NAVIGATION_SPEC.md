# Fantasy Golf League — Navigation Specification
**Version:** 1.1
**Last Updated:** March 7, 2026
**Author:** Bobby + Claude  

---

## 1. Navigation Architecture

The app uses a two-tier navigation model: a **Lobby** (no chrome) and a **League Shell** (persistent header + bottom nav). Users select a league from the lobby to enter the league experience. All navigation within a league is scoped to that league's data, schedule, and members.

```
┌─────────────────────────────┐
│          LOBBY              │  ← No header, no bottom nav
│  (League Selection)         │
└──────────┬──────────────────┘
           │ Tap league card
           ▼
┌─────────────────────────────┐
│  LEAGUE HEADER (sticky)     │  ← Persistent across all tabs
├─────────────────────────────┤
│                             │
│  PAGE CONTENT (scrollable)  │  ← Swaps per tab
│                             │
├─────────────────────────────┤
│  BOTTOM NAV (fixed)         │  ← Persistent across all tabs
└─────────────────────────────┘
```

---

## 2. Lobby (Landing Page)

The lobby is the app entry point. It contains no bottom navigation and no league header. The user selects which league to enter or creates a new one.

### Layout

```
SECTION: STICKY HEADER (sticky, top: 0, z-index: 40)
├── ROW (height: 64px, vertically centered)
│   ├── LEFT:  "Fantasy Golf" (txt, 16px, weight 700)
│   └── RIGHT: ProfileMenu (avatar button → dropdown with theme toggle, sign out)

SECTION: GREETING
├── ROW
│   ├── "Welcome back," (txt2, 14px)
│   └── Manager display name (txt, 30px, weight 700, letter-spacing -0.5)

SECTION: BODY
├── COLUMN HEADER ROW
│   ├── LEFT:  "Your Leagues" (txt2, 12px, uppercase, weight 600, spacing 0.6)
│   └── RIGHT: "PTS" (txt2, 12px, uppercase, weight 600)
│
├── LEAGUE CARD (repeating, one per league)
│   ├── Team Info (tappable → enters league at scorecard tab)
│   │   ├── LEFT: ManagerIcon (42px) with rank badge overlay (top-left)
│   │   │         + Team name (txt, 18px, weight 700) + League name (txt2, 12px)
│   │   └── RIGHT: Week points (15px, weight 700) or "-" if no scores
│   ├── Tournament Section (tappable → enters league at scorecard tab)
│   │   ├── CourseIcon (24px, tournament colors)
│   │   └── Tournament name (txt2, 12px, weight 600, truncated)
│   ├── Nav Links Row (4 equal columns, border-top)
│   │   ├── Match (flag icon)
│   │   ├── Golfers (search icon)
│   │   ├── Tour (grid icon)
│   │   └── Chat (speech bubble icon)
│   │   └── Each: SVG icon (18px) + label (10px, weight 600)
│   └── Tapping nav link → enters league at that specific tab
│
├── CREATE A LEAGUE CARD
│   ├── Dashed border (2px dashed, border color)
│   ├── "+" icon in rounded square
│   ├── "Create a League" (txt, 15px, weight 600)
│   └── "Set up a new league and invite your friends" (txt3, 12px)
```

### Behavior
- Default theme: **Light mode**
- Theme toggle is inside the ProfileMenu dropdown (avatar button in top-right)
- Header row height (64px) matches the league header first row height — this prevents layout jank on transition
- League cards show team name, league name, rank badge, week points, and active tournament
- Nav links on each card allow direct entry to a specific tab (Match, Golfers, Tour, Chat)
- Tapping the team info or tournament section enters the league at the scorecard tab
- Create a League card is a placeholder — no flows built
- Pull-to-refresh supported on the entire lobby

---

## 3. League Header (Sticky)

The league header is persistent and sticky (`position: sticky; top: 0`) across all five bottom nav tabs. It provides tournament context for the active league.

### Layout

```
LEAGUE HEADER (sticky, top: 0, z-index: 40)
├── Tournament Info Section (gradient bg: transparent → tournamentColor at 20% opacity)
│   ├── ROW 1 (height: 64px, vertically centered)
│   │   ├── LEFT:  Home button (30×30, house icon, radius 8)
│   │   │          + League Name button (txt, 14px, weight 600)
│   │   │          + ▼ dropdown arrow (if multiple leagues)
│   │   └── RIGHT: ProfileMenu (avatar → theme toggle, sign out)
│   │
│   ├── ROW 2 (tournament detail, margin-top: 4px)
│   │   ├── LEFT:  CourseIcon (52px, tournament primary + secondary colors)
│   │   ├── RIGHT of icon (flex column):
│   │   │   ├── Tournament Name (txt, 17px, weight 700) + ★ if major
│   │   │   ├── Course Name (txt2, 13px) | "Pts: {seasonPoints}" (txt2, 13px)
│   │   │   └── Location (txt3, 12px)   | "Par {par}" (txt3, 12px)
│
├── League Dropdown (absolute, z-index: 50, appears on league name click)
│   └── List of leagues with name + team name, selected highlighted
│
├── Week Navigation (WeekNav component, border-bottom, tournament color bg at 20%)
│   └── Horizontally scrollable pill buttons for each tournament week
│       ├── Active week: bold, tournament-color text + "(current)" label
│       └── Other weeks: muted text
```

### Behavior
- Background: card color, no box shadow
- Home button returns to Lobby — clears active league state
- League name is tappable to open league switcher dropdown (if user is in multiple leagues)
- Header reports its height via ResizeObserver so child pages can position sticky sub-headers below it
- Tournament info shows CourseIcon with the tournament's primary and secondary colors
- Season points displayed alongside course name
- WeekNav allows switching between tournament weeks; current week auto-scrolls into view
- Padding: `0 16px 16px` (horizontal 16px, bottom 16px) on the tournament info section

---

## 4. Bottom Navigation (Fixed)

The bottom nav is fixed to the viewport bottom and appears **only** inside the League Shell. It is not visible on the Lobby.

### Tabs

| Order | ID         | Label    | Icon Description                        |
|-------|------------|----------|-----------------------------------------|
| 1     | `match`    | Match    | Flag on pole (golf pin)                 |
| 2     | `scorecard`| Squad    | People/users group                      |
| 3     | `golfers`  | Golfers  | Magnifying glass (search)               |
| 4     | `league`   | Tour     | Table/grid (standings)                  |
| 5     | `chat`     | Chat     | Speech bubble                           |

### Layout

```
BOTTOM NAV (fixed, bottom: 0, z-index: 50)
├── Height: ~58px content + 22px bottom safe area = ~80px total
├── Background: navBg with backdrop blur (20px)
├── Top border: 1px solid border color
├── 5 equal-width buttons, flex layout
│   ├── SVG icon (22×22)
│   ├── Label (10px, weight 600)
│   ├── Active: greenBright color
│   └── Inactive: txt3 color (#8E95A0 stroke on icons)
```

### Behavior
- Active tab gets `greenBright` color for both icon stroke and label
- Inactive tabs use muted gray (`#8E95A0` for icon, `txt3` for label)
- Tapping a tab swaps the page content area; header and nav remain stable
- Page content area has `padding-bottom: 100px` to prevent content from being hidden behind the fixed nav
- Nav is scoped to the active league — all tabs show data for the selected league only

---

## 5. Page Content Area

The area between the sticky header and fixed bottom nav. Each tab renders its content here.

### Specifications
- Padding: `20px 16px 100px` (top 20, sides 16, bottom 100 for nav clearance)
- Flex: `1` to fill available vertical space
- Scrollable independently of header and nav
- Content swaps instantly on tab change — no transition animation, no loading state

### Pages

| Tab      | Component      | Description |
|----------|---------------|-------------|
| Match    | Home          | Fantasy leaderboard for the active tournament week, team-by-team rankings |
| Squad    | Roster        | Your active roster with per-round scores, projected points, rival comparison |
| Golfers  | Golfers       | Full player pool — free agents, rostered players, waiver claims. Sticky search + filter bar below the header |
| Tour     | LeagueStandings | Season standings across all tournament weeks |
| Chat     | Chat          | League-scoped messaging between members |

---

## 6. Theme System

### ProfileMenu
The theme toggle and sign-out action are inside a ProfileMenu component (avatar button in top-right corner of both Lobby and League headers).

- Avatar button: ManagerIcon (28px) showing user's team color
- Dropdown: card background, border, shadow, positioned below avatar
- Contains: Day/Night toggle row + Sign Out button
- Toggle dimensions: 44×26px, border-radius 13px
- Knob: 20×20px circle with emoji indicator (sun/moon)
- Light state: card2 background, gray knob
- Dark state: greenDim background, green knob
- Transition: `all .25s` on both track and knob

### Color Tokens

| Token      | Light           | Dark            | Usage                        |
|------------|-----------------|-----------------|------------------------------|
| bg         | `#F4F5F7`       | `#0B1014`       | Page background              |
| card       | `#FFFFFF`       | `#131A1F`       | Cards, header, nav bg        |
| card2      | `#F0F1F3`       | `#1A2228`       | Secondary surfaces, inputs   |
| border     | `#E2E5EA`       | `#1E2D33`       | Borders, dividers            |
| green      | `#2D8B52`       | `#2D9B5E`       | Primary accent               |
| greenDim   | `#E8F5EE`       | `#1A3D2A`       | Green backgrounds            |
| greenBright| `#1E7A3F`       | `#3DBB72`       | Active states, positive      |
| gold       | `#B8912E`       | `#B8912E`       | Rankings, majors             |
| goldDim    | `#F5EDD8`       | `#332A14`       | Gold backgrounds             |
| red        | `#D94438`       | `#E8564A`       | Negative, cut line, danger   |
| redDim     | `#FDECEB`       | `#3D1A17`       | Red backgrounds              |
| blue       | `#3A85CC`       | `#4A9BE8`       | Info, "Final" status         |
| blueDim    | `#E8F0FA`       | `#1A2D3D`       | Blue backgrounds             |
| txt        | `#1A1D21`       | `#F0F2F4`       | Primary text                 |
| txt2       | `#5A6370`       | `#8A96A2`       | Secondary text               |
| txt3       | `#8E95A0`       | `#5A6570`       | Tertiary text, labels        |
| navBg      | `#FFFFFFEF`     | `#131A1FF0`     | Nav with transparency        |
| shadow     | `0 1px 4px...`  | `none`          | Card elevation (light only)  |

### Default
- App always starts in **light mode**
- Theme persists within session across lobby and league views
- Toggle is accessible via ProfileMenu in both lobby and league header (same position)

---

## 7. Transition Rules

### Lobby → League
- ProfileMenu stays in top-right corner in both states
- First row height is 64px in both lobby and league header
- No animated transition — instant swap
- Bottom nav appears; lobby content replaced by league shell
- Can enter via card tap (default tab) or via nav link (specific tab)

### League → Lobby
- Home button (house icon) triggers exit
- Active league state clears
- Bottom nav disappears
- Page resets to lobby view

### Tab → Tab (within league)
- Header remains completely static
- Bottom nav remains completely static
- Only the content area between them swaps
- No layout shift, no jank

---

## 8. League Data Isolation

Each league maintains its own independent state:

| Property         | Per-League | Example                          |
|------------------|-----------|----------------------------------|
| Week number      | ✓         | League 1: Wk 1, League 2: Wk 2  |
| Tournament       | ✓         | Same tournament, different weeks  |
| Purse            | ✓         | $10M vs $20M                     |
| Season money     | ✓         | $1.2M vs $1.9M                   |
| Fantasy standings| ✓         | Different leaderboards            |
| Chat messages    | ✓         | League members only               |
| Roster/players   | ✓         | Different drafted golfers         |
| Mulligans left   | ✓         | 1 vs 2 remaining                  |

Entering a league loads that league's full config. Exiting clears the active league context and returns to the lobby.

---

*This document defines the navigation shell for Fantasy Golf League. All page content will be designed and built within this framework. Reference the prototype artifact for the working implementation.*
