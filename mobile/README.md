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
- `expo-auth-session` — Auth0 (wire in **last**, see §7)
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

1. **Onboarding** — name, 1-3 goals (free text or chips: "internship",
   "cofounder", "friendship", "mentor"), your own social links. Stores to
   a local dev user until Auth0 lands.
2. **Connect** — big QR code (encodes your `user_id` + a short-lived
   token) + a "Scan" button that opens the camera. Below the QR, show the
   6-digit fallback code and an input to type the other person's code
   (camera-under-stage-lights fallback — do not skip this).
3. **Capture context** — appears immediately after a successful connect.
   Auto-fills GPS → place label (reverse geocode or just show raw
   coords + let user label it "Career Fair") and timestamp. One text
   field + one "hold to record" voice button. A `context_type` picker:
   conference / club / orientation / campus / work / other.
4. **Connection detail** — shows enrichment once the backend returns it
   (poll or just wait — MVP doesn't need websockets): role, interests,
   recent activity **with visible source links**, and the generated
   quest cards.
5. **Quest card** — one of four visual types by `type`:
   - `message`: shows `draft_message`, a "Copy" button, a "Mark sent"
     button
   - `read`: shows the source link, a "Mark read" button
   - `meet`: shows a suggested date, a "Mark done" button
   - `share`: shows what to share, a "Mark done" button
   Completing any quest → call `POST /quests/:id/complete` → play the XP
   animation (see §4) → navigate back to the map.
6. **Network map** (the demo centerpiece — give this the most polish time)
   — see §4.

Do not build more screens than this for MVP. A settings screen, a search
screen, a contacts list screen are all cuttable.

---

## 3. Screen flow

```
Onboarding ──► Connect ──(scan success)──► Capture context ──► Connection detail ──► Network map
                  ▲                                                    │
                  └────────────────── "Connect another" ◄──────────────┘
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
POST /users                          — create dev/onboarding user
POST /connections                    — create a connection (triggers agent async)
GET  /connections/:id                — poll for enrichment + quests
GET  /connections?owner_id=          — list all, for the map
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

## 7. Auth0 — deliberately last

Build and demo the entire app against a single hardcoded dev user
(`{_id: "dev-user-1", name: "You"}`). Only wire `expo-auth-session` in
around hour 18-20, once every other screen works. Building auth first is
the single most common way hackathon teams run out of time.

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
