# mobile/ — Expo App (Claude Code context for this folder)

You are implementing the phone app for an AI networking agent. Read this
whole file before writing code. If anything here conflicts with the root
`README.md`, the root file wins on data shapes; this file wins on UI/mobile
specifics.

**Do not** call an LLM provider or fetch profile links from this layer.
This app talks **only** to `backend/` over REST. If `BACKEND_URL` is unreachable, fall back
to the local fixtures described in §6 so development is never blocked on
another teammate's server being up.

---

## 1. Stack

- Expo (React Native) + `expo-router` for navigation
- NativeWind (Tailwind for RN) for styling
- `expo-camera` — QR generate + scan
- `expo-location` — GPS capture on connect
- `expo-audio` — voice note recording (upload as file, backend transcribes or
  stores raw — confirm with P3/P4 which). Not `expo-av`: that package's
  native module isn't bundled in Expo Go on current SDKs.
- `expo-auth-session` + `expo-web-browser` — Auth0 Universal Login,
  standard sign up / sign in (see §7 — wired in for real, not a stub)
- `expo-secure-store` — persists the logged-in session across app restarts
- `@expo/vector-icons` — bottom tab bar icons (see §3)
- State: React Context + `useReducer`, or Zustand if the team prefers —
  don't reach for Redux, there isn't time
- Run via **Expo Go** on real phones. No EAS build, no TestFlight.

```bash
npx create-expo-app mobile --template blank-typescript
cd mobile
npx expo install expo-camera expo-location expo-av expo-auth-session nativewind
```

Pin the Expo SDK version in `package.json` at hour 0 and have every
teammate install the same Expo Go build — SDK/client mismatches are a
classic multi-hour time sink.

---

## 2. Screens (build in this order)

1. **Login** — "Sign up / Log in" via Auth0's standard Universal Login
   (email/password by default, plus any social connections you enable —
   no specific provider forced). Persists the session so a relaunch skips
   straight past this. See §7.
2. **Plans setup** — shown once, right after a login that has zero plans.
   Add 1+ "improvement plans" (root README.md §3) — chips for common ones
   plus free text. Blocks continuing until at least one plan exists.
3. **Connect** (tab: "Scan QR") — big QR code (encodes your `user_id`,
   `name`, and `links` — including whatever social links you've added on
   your profile) + a "Scan" button that opens the camera. Below the QR,
   show the 6-digit fallback code and inputs to type the other person's
   code and name (camera-under-stage-lights fallback — do not skip this).
   No manual link entry here — scanning their QR is the only way their
   profile links come through; the manual fallback trades that off for
   speed.
4. **Capture context** — appears immediately after a successful connect.
   Auto-fills GPS → place label (reverse geocode or just show raw
   coords + let user label it "Career Fair") and timestamp. One text
   field + one "hold to record" voice button. A `context_type` picker:
   conference / club / orientation / campus / work / other.
5. **Connection detail** — shows enrichment once the backend returns it
   (poll or just wait — MVP doesn't need websockets): role, interests,
   recent activity **with visible source links**, the person's captured
   profile links, and the generated quest cards.
6. **Quest card** — one of four visual types by `type`:
   - `message`: shows `draft_message`, a "Copy" button, a "Mark sent"
     button
   - `read`: shows the source link, a "Mark read" button
   - `meet`: shows a suggested date, a "Mark done" button
   - `share`: shows what to share, a "Mark done" button
   Completing any quest → call `POST /quests/:id/complete` → show the
   celebration popup (see §4a) → navigate back to the map.
7. **Network map** (tab: "Map" — the demo centerpiece — give this the
   most polish time) — see §4.
8. **Dashboard** (tab: "Dashboard") — your plans, and the "Quest Log":
   every pending follow-up task across all connections
   (`GET /quests?owner_id=`), styled like an RPG quest log
   (`components/QuestLogCard.tsx`) — per-type icon/color, an XP reward
   chip, and a due-date urgency badge (red "Overdue"/"Due today" down to
   gray "Due in Nd"), sorted soonest-due first. Tapping a task's "Attach
   to a quest line" lets you link it to a plan
   (`POST /quests/:id/link-plan`) — this is the "connect follow-up tasks
   to your improvement plans" loop.
9. **Profile** (tab: "Profile") — your own profile links (LinkedIn,
   Instagram, Facebook — entered manually, `POST /users/:id/links`; this
   is what gets shared via your QR code and what the agent searches for
   contacts you add later), plus XP/streak and log out.

Screens 7-9 live behind a bottom tab bar (see §3). Do not build more
screens than this for MVP. A settings screen, a search screen, a
contacts list screen are all cuttable.

---

## 3. Screen flow

```
Login ──(first login, no plans)──► Plans setup ──┐
  │                                                │
  └──(already has plans / returning session)───────┤
                                                     ▼
                          ┌──────────────────────────────────────────────────┐
                          │                (tabs) bottom tab bar              │
                          │   Dashboard   Map   Scan QR   Profile           │
                          └──────────────────────────────────────────────────┘
                                                     │
                        Scan QR tab ──(scan/manual success)──► Capture context ──► Connection detail
```

The tab bar (`app/(tabs)/_layout.tsx`, an `expo-router` `<Tabs>` layout)
is the app's home once logged in — Dashboard, Map, Connect ("Scan QR"),
and Profile are siblings there, in that order. Login, Plans setup,
Capture context, and Connection detail are full-screen flow steps outside
the tab bar (pushed on top of it, same as any stack screen).

---

## 4. Network map — this is P2's main deliverable

This single screen carries the most weight in judging ("demo quality" +
"gamified visually interactive"). Spend disproportionate time here.

- Force-directed or simple radial layout: user at center, contacts as
  nodes around them.
- Node opacity/saturation = `warmth` value returned by backend (0 = dim
  grey, 1 = full color). This is the visual proof of the "score goes up
  when you leave the app" pitch — do not skip the dimming animation.
- Tapping a node opens Connection detail.
- Completing a quest: node animates from dim → bright (warmth changed
  server-side, see backend/README.md §4) once you're back on this screen.
- Use `react-native-svg` or `react-native-reanimated` for the animations.
  Keep it to one well-polished map rather than several mediocre charts.

---

## 4a. Gamification — XP + streak celebration, not just a number changing

Two actions award XP and update the streak (backend/README.md §5,
deterministic, no LLM): **adding a connection** and **completing a
quest**. Both responses carry `{xp_awarded, new_total_xp, streak}`
(`lib/types.ts` `GamificationResult`) — every screen that triggers one of
these calls `setUser({...user, xp: new_total_xp, streak})` immediately
so XP/streak are correct everywhere in the app (Map header, Profile) the
instant it happens, not just where the action occurred.

`components/CelebrationPopup.tsx` is the actual "gamified, not just
incrementing" part: a pop-in/hold/pop-out card ("+X XP", streak with 🔥)
using `Animated` (no extra dependency). Wired into:
- `app/capture.tsx` — after `createConnection`, holds `pendingConnect`
  until the popup finishes, *then* navigates to Connection detail (so the
  form stays visible underneath instead of flashing to an empty state)
- `app/connection/[id].tsx` — after `completeQuest`

Reuse this component for any future XP-awarding action rather than
building a second celebration UI.

---

## 5. API calls this layer makes (see `backend/README.md` for full specs)

```
POST /auth/session                   — login: get-or-create user from Auth0 ID token
GET  /users/:id                      — fetch current user (plans, links, xp)
POST /users/:id/plans                — add an improvement plan
POST /users/:id/links                — set your own profile links (LinkedIn/IG/FB/...)
POST /connections                    — create a connection (triggers agent async)
GET  /connections/:id                — poll for enrichment + quests
GET  /connections?owner_id=          — list all, for the map
GET  /quests?owner_id=               — all follow-up tasks, for the dashboard
POST /quests/:id/link-plan           — link (or unlink) a task to a plan
POST /quests/:id/complete            — mark a quest done
```

---

## 6. Fixtures — build against these before the backend is ready

Create `mobile/fixtures/seedConnections.ts` with **8 fake connections** at
varied warmth levels (some at 0.9, some at 0.2) so the map never looks
empty during development or if live demo data is thin. Toggle fixtures vs.
live API with a single `USE_FIXTURES` constant — flip it off once
`backend/` is confirmed reachable, flip it back on as your demo-mode
safety net (coordinate with `backend/README.md` §6 `DEMO_MODE`).

---

## 7. Auth0 — sign up / log in, wired in for real

`lib/auth.ts`'s `useAuth0Login()` hook drives Auth0's standard Universal
Login via `expo-auth-session` — no social connection is forced, so it's
whatever's enabled on your tenant (email/password out of the box). On
success it exchanges the code for tokens and returns the ID token, which
`lib/store.tsx`'s `login()` sends to `POST /auth/session` and persists
(via `expo-secure-store`) alongside the returned user.

This needs zero Auth0 dashboard configuration beyond creating the
application — the redirect URI does need to be added to **Allowed
Callback URLs** the first time you run it on a new dev machine/network
(the login screen shows the exact value — tap to copy — if you hit a
"Callback URL mismatch" error).

Profile links (LinkedIn, Instagram, Facebook) are **not** tied to login —
they're entered manually after signing in, on the Profile tab
(`POST /users/:id/links`), same pattern as capturing a *contact's* links
on the connect screen.

Every screen behind login (`/plans-setup`, `/capture`, `/connection/:id`,
and every screen in `(tabs)`: `/map`, `/connect`, `/dashboard`, `/profile`)
redirects to `/login` if `useStore().user` is null — see each screen's
top-level `if (!user) return <Redirect .../>` (Dashboard/Profile just
`return null` since they're reachable only from inside the tab bar, which
only renders once logged in).

Set `EXPO_PUBLIC_USE_FIXTURES=true` to bypass real login entirely via the
"Continue as dev user (fixtures)" button on the login screen — useful for
testing plans/dashboard/connect without a live Auth0 tenant at all.

---

## 8. Acceptance checklist for this layer

- [ ] Two physical phones can complete the QR connect flow against each
      other (test with a teammate, not the simulator — camera behavior
      differs)
- [ ] 6-digit fallback code works if the camera scan fails
- [ ] Voice note records and uploads (confirm upload contract with P3/P4)
- [ ] Network map renders 8 fixture nodes at visibly different warmth
      levels
- [ ] Completing a quest animates warmth + XP without a page reload
- [ ] App runs identically for every teammate's Expo Go install (same SDK
      version)
- [ ] `USE_FIXTURES` toggle exists and works as a wifi-outage fallback
- [ ] A logged-out user is redirected to `/login` from every other screen
- [ ] Session persists across an app restart (no re-login needed)
- [ ] A first-time login with zero plans is routed to `/plans-setup`
      before `/map`
- [ ] The other person's profile links (from scanning their QR) show as
      tappable links on Connection detail
- [ ] Dashboard lists every pending task across all connections, and
      linking one to a plan persists (reload and it's still linked)
- [ ] Saving your own links on the Profile tab persists (reload and
      they're still there) and shows up in your QR code for the next
      person you connect with
- [ ] All four tabs (Dashboard, Map, Scan QR, Profile) are reachable from
      the bottom tab bar at all times once logged in
- [ ] The celebration popup fires with a real animation (not an instant
      number change) both when adding a connection and when completing a
      quest, showing the correct XP and streak each time
- [ ] A note with a concrete plan (e.g. "meet 2pm Monday") produces a
      specific quest even when the contact has no enrichment facts at all
- [ ] Dashboard's Quest Log shows the correct icon/color per quest type,
      the right XP chip, and a due-date badge that goes red as it gets
      close to (or past) due, sorted soonest-first
