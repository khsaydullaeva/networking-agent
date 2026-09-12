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
