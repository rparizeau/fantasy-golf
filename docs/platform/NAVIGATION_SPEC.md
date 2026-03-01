# Fantasy Golf League — Navigation Specification
**Version:** 1.0  
**Last Updated:** March 1, 2026  
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
SECTION: HEADER
├── ROW (height: 64px, vertically centered)
│   ├── LEFT:  "Welcome back," (txt2, 14px)
│   └── RIGHT: Day/Night toggle
│
├── ROW
│   └── FULL:  "Bobby" (txt, 30px, weight 700, letter-spacing -0.5)

SECTION: BODY
├── TITLE: "Your Leagues" (txt2, 13px, uppercase, weight 600, spacing 0.8)
│
├── LEAGUE CARD (repeating, one per league)
│   ├── Top: League name (txt3, 11px, uppercase) + Team name (txt, 18px, weight 700)
│   ├── Top Right: Rank badge (e.g., "#3 of 10")
│   ├── Info Row: Live beacon + "Wk {n} • {Tournament} • {Purse}"
│   ├── Bottom Row (3 cols): Season total | This week earnings | › chevron
│   └── On tap → enters league
│
├── CREATE A LEAGUE CARD
│   ├── Dashed border (2px dashed, border color)
│   ├── "+" icon in rounded square
│   ├── "Create a League" (txt, 15px, weight 600)
│   └── "Set up a new league and invite your friends" (txt3, 12px)
```

### Behavior
- Default theme: **Light mode**
- Day/Night toggle position must match the league header toggle position exactly (same vertical and horizontal coordinates)
- "Welcome back," row height (64px) matches the league header first row height — this prevents layout jank on transition
- League cards show league-specific week number, tournament name, and purse (abbreviated, e.g., "$10M")
- Tapping a league card enters the League Shell with that league's data
- Create a League card is a placeholder — no flows built

---

## 3. League Header (Sticky)

The league header is persistent and sticky (`position: sticky; top: 0`) across all five bottom nav tabs. It provides tournament context for the active league.

### Layout

```
LEAGUE HEADER (sticky, top: 0, z-index: 40)
├── ROW 1 (height: 64px, vertically centered)
│   ├── LEFT:  ‹ Back button (30×30, radius 8) + League Name (txt, 14px, weight 600)
│   └── RIGHT: Day/Night toggle (44×26)
│
├── ROW 2 (margin-top: 4px, margin-bottom: 4px)
│   ├── LEFT:  Tournament Name (txt, 17px, weight 700)
│   └── RIGHT: Status badge with beacon if live
│              • Live: green dot (6px, pulsing) + "Live • R{n}" (greenBright)
│              • Final: "Final" (blue)
│              • Upcoming: "Upcoming" (txt3)
│
├── ROW 3 (margin-bottom: 3px)
│   ├── LEFT:  Course Name (txt2, 13px)
│   └── RIGHT: "Purse: {amount}" (txt2, 13px)
│
├── ROW 4
│   ├── LEFT:  📍 Location (txt3, 12px)
│   └── RIGHT: "Cut: {value}" (txt3, 12px)
```

### Behavior
- Background: card color with bottom border
- Light mode gets subtle box shadow (`0 1px 3px rgba(0,0,0,0.04)`)
- ‹ Back button returns to Lobby — clears active league state
- Toggle position is identical to lobby toggle — no visual shift on transition
- Status badge contains the pulsing beacon dot inline when tournament is live
- Header content updates based on the league's current tournament week
- Padding: `0 16px 16px` (horizontal 16px, bottom 16px)

---

## 4. Bottom Navigation (Fixed)

The bottom nav is fixed to the viewport bottom and appears **only** inside the League Shell. It is not visible on the Lobby.

### Tabs

| Order | ID         | Label    | Icon Description        |
|-------|------------|----------|-------------------------|
| 1     | `home`     | Home     | House with door          |
| 2     | `scorecard`| Roster   | Golf flag on green       |
| 3     | `golfers`  | Golfers  | People/users group       |
| 4     | `league`   | League   | Table/grid (standings)   |
| 5     | `chat`     | Chat     | Speech bubble            |

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

### Current Pages (placeholder)
All five pages currently render a centered placeholder card showing the page name and league context. Page content will be built out individually.

| Tab      | Page Title | Description (future) |
|----------|-----------|----------------------|
| Home     | Home      | League dashboard, quick stats, activity feed |
| Roster   | Roster    | Active lineup, reserve players, weekly management |
| Golfers  | Golfers   | All rostered golfers, free agents, waiver wire |
| League   | League    | Season standings, head-to-head, league history |
| Chat     | Chat      | League-scoped messaging between members |

---

## 6. Theme System

### Toggle Component
- Dimensions: 44×26px, border-radius 13px
- Knob: 20×20px circle with emoji indicator (☀️ light, 🌙 dark)
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
- Toggle appears in both lobby header row 1 and league header row 1 at the same coordinates

---

## 7. Transition Rules

### Lobby → League
- Toggle must not move (identical coordinates in both states)
- First row height is 64px in both lobby and league header
- No animated transition — instant swap
- Bottom nav appears; lobby content replaced by league shell

### League → Lobby
- ‹ Back button triggers exit
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
