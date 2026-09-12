import Constants from "expo-constants";

// e.g. http://<laptop-ip>:8000 for Expo Go on a physical device on the
// same wifi as backend/. Set in app.json > expo.extra.backendUrl or via
// EXPO_PUBLIC_BACKEND_URL.
export const BACKEND_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ??
  (Constants.expoConfig?.extra?.backendUrl as string | undefined) ??
  "http://localhost:8000";

// Flip off once backend/ is confirmed reachable; flip back on as the
// wifi-outage demo safety net (coordinate with backend/README.md §5 DEMO_MODE).
export const USE_FIXTURES = process.env.EXPO_PUBLIC_USE_FIXTURES !== "false";

// Auth0 tenant used for login (LinkedIn as the social connection — see
// backend/README.md §6). Same values as backend/.env's AUTH0_DOMAIN /
// AUTH0_CLIENT_ID.
export const AUTH0_DOMAIN =
  process.env.EXPO_PUBLIC_AUTH0_DOMAIN ??
  (Constants.expoConfig?.extra?.auth0Domain as string | undefined) ??
  "";
export const AUTH0_CLIENT_ID =
  process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ??
  (Constants.expoConfig?.extra?.auth0ClientId as string | undefined) ??
  "";
