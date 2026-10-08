# Fantasy Golf League — Admin Area Specification
**Version:** 0.1 (draft for review)
**Status:** In review — branch `feature/admin-area`, not merged, not pushed
**Design reference:** Claude Design mockup "Admin Sim Panel Nav" (https://claude.ai/artifact/FcL95ECBDKaFgyB1bqpsuJ)

---

## 1. Goal

Give the platform an admin area that has room to grow. Today the only admin surface is the Sim Panel at `/sim`, a single full-width page with no navigation. This change:

1. Moves the Sim Panel to `/admin/simulator`.
2. Wraps it in a persistent left-nav admin shell.
3. Adds the other planned admin pages: Overview, Leagues, Users, Stat Corrections, Reporting, API Integrations.
4. Puts every admin page, client route and server endpoint behind an `admin` namespace.

The player-facing app stays at the root and is not touched.

## 2. Scope

### In scope
| Area | Deliverable |
|---|---|
| Client routing | `/admin` route group with an admin layout (shell + `<Outlet/>`). Child routes below. |
| Navigation | Left nav: collapsible, hover-to-expand overlay when collapsed, user button pinned to the bottom. |
| Season switcher | Top bar with a season dropdown, stubbed with the current year only. |
| Overview | Blank stub page. |
| Leagues | **Real listing** (name, owner name + email, manager count, status). No detail page. |
| Users | **Real listing** (name, email, team count, "Preview app" link). Link is design only, not wired. No detail page. |
| Simulator | Existing Sim Panel moved to `/admin/simulator`. Behavior unchanged. |
| Stat Corrections, Reporting, API Integrations | Blank stub pages. |
| User button | Shows the signed-in admin at the bottom of the nav. **Stubbed: clicking does nothing** (no dropdown). |
| Server | New `/api/admin` router behind `requireAdmin`. Sim endpoints move to `/api/admin/simulator/*`. New `GET /api/admin/leagues` and `GET /api/admin/users`. |
| Simulator player list | Page buttons replaced by continuous scroll (lazy rendering). Ships as its own commit so it can be dropped. |

### Out of scope
- League and user detail pages.
- Wiring up "Preview app" (impersonation / read-only preview).
- User menu contents (account settings, change password, sign out).
- Real season data. The schema has no seasons table, so the dropdown is a stub.
- Changing how admin is determined (see Risks).
- Schema changes. League status is derived (see 5.3) rather than stored.
- Dark mode for the admin area. It uses the light palette the Sim Panel already uses.
- Anything in the player-facing app.

## 3. Routes

### 3.1 Client

| Path | Page | State |
|---|---|---|
| `/admin` | redirects to `/admin/overview` | |
| `/admin/overview` | Overview | stub |
| `/admin/leagues` | Leagues | real listing |
| `/admin/users` | Users | real listing |
| `/admin/simulator` | Simulator (moved from `/sim`) | working |
| `/admin/stat-corrections` | Stat Corrections | stub |
| `/admin/reporting` | Reporting | stub |
| `/admin/api-integrations` | API Integrations | stub |
| `/sim` | redirects to `/admin/simulator` | keeps old bookmarks working |

Access: the layout checks `manager.isAdmin`. Non-admins are redirected to `/`. Unauthenticated users see the existing login screen. The server is the real gate, and the client check is only for UX.

### 3.2 Server

| Method + path | Auth | Notes |
|---|---|---|
| `GET /api/sim/version` | `requireAuth` | **Unchanged.** The player app polls this. |
| `* /api/admin/simulator/*` | `requireAdmin` | Existing sim routes, moved from `/api/sim/*`. |
| `GET /api/admin/leagues` | `requireAdmin` | New. |
| `GET /api/admin/users` | `requireAdmin` | New. |

Breaking change: the old admin sim paths `/api/sim/{state,advance,rewind,override,player/update,complete,rollback,hot-streak,reset}` no longer exist. The only caller is `src/api.ts`, which is updated in the same change.

## 4. Front-end structure

```
src/admin/
  AdminLayout.tsx        shell: nav + season bar + <Outlet/>, admin gate
  AdminNav.tsx           left nav (collapse, hover overlay, bottom user button)
  SeasonBar.tsx          top bar with stubbed season dropdown
  adminStyles.ts         shared palette/tokens (light theme, matches Sim Panel)
  pages/
    Overview.tsx         stub
    Leagues.tsx          listing
    Users.tsx            listing
    Simulator.tsx        moved from src/pages/SimPanel.tsx (git mv, history kept)
    StatCorrections.tsx  stub
    Reporting.tsx        stub
    ApiIntegrations.tsx  stub
```

Conventions follow the existing codebase: inline style objects, no new dependencies, `react-router-dom` v7 (already installed).

### 4.1 Nav behavior
- Items in order: Overview, Leagues, Users, Simulator, Stat Corrections, Reporting, API Integrations.
- Expanded: 240px, icon + label. Collapsed ("rail"): 68px, icons only, with the logo at the top.
- Rail hover or keyboard focus expands it **over** the page, without reflowing the content. The toggle becomes "keep navigation open" to pin it.
- Collapsed/pinned preference is remembered in `localStorage`.
- The user button is always the last item, pinned to the bottom of the nav (the nav is full viewport height, sticky).
- Phones (<768px): the nav is an off-canvas drawer opened from a menu button in the top bar. It has a backdrop, closes on backdrop tap, Escape or choosing a page, and keeps the user button at the bottom. The collapse/rail behavior above applies at >=768px only.

### 4.2 Season bar
Sticky top bar with a season dropdown. It contains only the current year (derived from the date), selected, with no past seasons. A "Current season" badge sits next to it. The selection is not yet consumed by any page.

### 4.3 User button (stub)
Shows the admin's initials and display name from `useAuth()`. It is a button with no click behavior and no menu. A `TODO` marks where the menu goes.

### 4.4 Responsive (mobile first)
Base CSS is the phone layout and `@media (min-width: 768px)` adds the desktop enhancements.

| | Phone (<768px) | >=768px |
|---|---|---|
| Nav | off-canvas drawer, 48px rows | sticky rail / expanded nav |
| Top bar | menu button + season select | season label, select, badge |
| Page padding | 16px | 32px |
| Leagues / Users | stacked cards, one per row | tables |
| Tap targets | >=44px (chips, buttons, inputs) | 36-40px |
| Search inputs | 16px font (stops iOS zoom-on-focus) | same |

The Simulator already used wrapping flex rows, a horizontally scrolling table and bottom-sheet modals, so it is unchanged apart from the 16px search font.

## 5. Data

### 5.1 `GET /api/admin/leagues`
```
[{ id, name, ownerName, ownerEmail, managerCount, status }]
```
- Owner is the league creator (`leagues.createdById` → `users`).
- `managerCount` is the count of `managers` rows for the league.
- Ordered by league name.

### 5.2 `GET /api/admin/users`
```
[{ id, name, email, teamCount }]
```
- `teamCount` is the count of `managers` rows for the user (one manager row = one team).
- Ordered by name.

### 5.3 League status (derived, no schema change)
There is no status column. Status is derived from the league's latest draft:

| Condition | Status |
|---|---|
| No draft row | `Setup` |
| Draft `pending` or `active` | `Drafting` |
| Draft `complete` | `Active` |

`Completed` (past season) is not derivable until seasons exist, so it is not produced. Revisit with the schema upgrade.

### 5.4 Listings
Both listings load the full list in one request and filter client-side (search box; leagues also get status chips). That is fine at the current size. Add server pagination if either list grows past a few hundred rows.

## 6. Delivery plan

Work happens on `feature/admin-area`, branched from `main` (see 8). Commits are local only.

1. **Spec**: this document.
2. **Server**: `/api/admin` router; sim routes moved to `/api/admin/simulator`; leagues and users endpoints.
3. **Client shell + routing**: admin layout, nav, season bar, stub pages, `SimPanel` moved and re-pathed, `/sim` redirect.
4. **Listings**: Leagues and Users pages wired to the new endpoints.
5. **Simulator continuous scroll**: replaces page buttons. Separate commit so it can be dropped.

Verification: `npm run build` (type-check + bundle) must pass, and the server must type-check. Manual click-through is listed in section 7.

## 7. Review checklist (manual)

- [ ] `/admin` redirects to `/admin/overview`; the nav highlights the current page
- [ ] `/sim` redirects to `/admin/simulator`; the simulator behaves as before
- [ ] A non-admin visiting `/admin/*` lands on `/`
- [ ] A non-admin calling `/api/admin/*` gets 403
- [ ] Collapse, hover overlay (content does not shift) and pin all work
- [ ] User button is at the bottom at any window height and does nothing when clicked
- [ ] Leagues and Users show real rows; search works
- [ ] Simulator list loads more rows as you scroll; search still works
- [ ] On a phone-width window: menu button opens the drawer; backdrop, Escape and choosing a page close it
- [ ] On a phone-width window: Leagues and Users show as cards, nothing scrolls sideways, and the user button is at the bottom of the drawer
- [ ] Player app (lobby, league pages, polling) is unaffected

## 8. Release / safety

- **Nothing is pushed or merged without explicit approval.** Pushing `main` triggers a production deploy on Vercel. This work stays on a local branch until it has been reviewed.
- The repo's default branch is `main` (there is no `master`), so the branch is cut from `main`.
- Because the API paths change, client and server must deploy together. There is no compatibility shim for the old `/api/sim/*` admin paths. If a staggered deploy is a concern, say so and a temporary alias can be added.

## 9. Risks and open questions

1. **Admin check is weak.** `requireAuth` sets `isAdmin` to true when the user is a commissioner of *any* league. This area would be open to every league commissioner. It was already true of `/sim`, but the admin area now exposes user emails and all leagues. Recommend a real platform-admin flag (schema change) before this ships to production. Not changed here.
2. **User emails** are shown in the Users and Leagues listings. This is fine for an admin tool, but it is another reason to fix risk 1 first.
3. **Season stub.** The dropdown has no data behind it until the schema upgrade adds seasons.
4. **"Preview app"** will need a design for read-only impersonation and an audit log before it is built.
