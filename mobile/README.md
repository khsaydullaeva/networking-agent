# mobile/ — Expo App (Claude Code context for this folder)

You are implementing the phone app for an AI networking agent. Read this
whole file before writing code. If anything here conflicts with the root
`README.md`, the root file wins on data shapes; this file wins on UI/mobile
specifics.

**Do not** call Querit or any LLM provider from this layer. This app talks
**only** to `backend/` over REST. If `BACKEND_URL` is unreachable, fall back
to the local fixtures described in §6 so development is never blocked on
another teammate's server being up.

---

## 1. Stack

- Expo (React Native) + `expo-router` for navigation
- NativeWind (Tailwind for RN) for styling
- `expo-camera` — QR generate + scan
- `expo-location` — GPS capture on connect
- `expo-av` — voice note recording (upload as file, backend transcribes or
  stores raw — confirm with P3/P4 which)
- `expo-auth-session` + `expo-web-browser` — Auth0 Universal Login with
  LinkedIn as the social connection (see §7 — wired in for real, not a stub)
- `expo-secure-store` — persists the logged-in session across app restarts
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

1. **Login** — "Continue with LinkedIn" (Auth0 Universal Login, LinkedIn
   forced as the social connection). Persists the session so a relaunch
   skips straight past this. See §7.
2. **Plans setup** — shown once, right after a login that has zero plans.
   Add 1+ "improvement plans" (root README.md §3) — chips for common ones
   plus free text. Blocks continuing until at least one plan exists.
3. **Connect** — big QR code (encodes your `user_id`, `name`, and `links`
   — including your LinkedIn if set) + a "Scan" button that opens the
   camera. Below the QR, show the 6-digit fallback code and inputs to
   type the other person's code, name, and LinkedIn URL (camera-under-
   stage-lights fallback — do not skip this).
4. **Capture context** — appears immediately after a successful connect.
   Auto-fills GPS → place label (reverse geocode or just show raw
   coords + let user label it "Career Fair") and timestamp. One text
   field + one "hold to record" voice button. A `context_type` picker:
   conference / club / orientation / campus / work / other.
5. **Connection detail** — shows enrichment once the backend returns it
   (poll or just wait — MVP doesn't need websockets): role, interests,
   recent activity **with visible source links**, the person's LinkedIn
   link if captured, and the generated quest cards.
6. **Quest card** — one of four visual types by `type`:
   - `message`: shows `draft_message`, a "Copy" button, a "Mark sent"
     button
   - `read`: shows the source link, a "Mark read" button
   - `meet`: shows a suggested date, a "Mark done" button
   - `share`: shows what to share, a "Mark done" button
   Completing any quest → call `POST /quests/:id/complete` → play the XP
   animation (see §4) → navigate back to the map.
7. **Network map** (the demo centerpiece — give this the most polish time)
   — see §4.
8. **Dashboard** — the feed of every pending follow-up task across all
   connections (`GET /quests?owner_id=`), plus the user's plans. Tapping
   a task lets you link it to a plan (`POST /quests/:id/link-plan`) —
   this is the "connect follow-up tasks to your improvement plans" loop.

Do not build more screens than this for MVP. A settings screen, a search
screen, a contacts list screen are all cuttable.

---

## 3. Screen flow

```
Login ──(first login, no plans)──► Plans setup ──┐
  │                                                │
  └──(already has plans / returning session)───────┤
                                                     ▼
                          Connect ──(scan success)──► Capture context ──► Connection detail ──► Network map ──► Dashboard
                             ▲                                                                       │  ▲              │
                             └───────────────────────── "Connect another" ◄───────────────────────────┘  └── "Map" ◄────┘
```

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
- Completing a quest: node animates from dim → bright, small XP number
  floats up, streak counter increments in a corner HUD.
- Use `react-native-svg` or `react-native-reanimated` for the animations.
  Keep it to one well-polished map rather than several mediocre charts.

---

## 5. API calls this layer makes (see `backend/README.md` for full specs)

```
POST /auth/session                   — login: get-or-create user from Auth0 ID token
GET  /users/:id                      — fetch current user (plans, xp)
POST /users/:id/plans                — add an improvement plan
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
safety net (coordinate with `backend/README.md` §5 `DEMO_MODE`).

---

## 7. Auth0 — LinkedIn login, wired in for real

`lib/auth.ts`'s `useAuth0Login()` hook drives Auth0 Universal Login via
`expo-auth-session`, with `extraParams: { connection: "linkedin" }` so the
provider picker is skipped and the user goes straight to LinkedIn. On
success it exchanges the code for tokens and returns the ID token, which
`lib/store.tsx`'s `login()` sends to `POST /auth/session` and persists
(via `expo-secure-store`) alongside the returned user.

**One manual step required on your end**: enable LinkedIn as a social
connection in the Auth0 dashboard (Authentication → Social → LinkedIn) —
see `backend/README.md` §6. Until that's done, "Continue with LinkedIn"
will reach Auth0's Universal Login page and fail there with a
connection-not-enabled error; that's expected, not a bug in this code.

Every screen behind login (`/plans-setup`, `/map`, `/connect`, `/capture`,
`/connection/:id`, `/dashboard`) redirects to `/login` if `useStore().user`
is null — see each screen's top-level `if (!user) return <Redirect .../>`.

Set `EXPO_PUBLIC_USE_FIXTURES=true` to bypass real login entirely via the
"Continue as dev user (fixtures)" button on the login screen — useful for
testing plans/dashboard/connect before LinkedIn is enabled in Auth0.

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
- [ ] The other person's LinkedIn URL (from the QR payload or typed
      manually) shows as a tappable link on Connection detail
- [ ] Dashboard lists every pending task across all connections, and
      linking one to a plan persists (reload and it's still linked)
