import { router } from "expo-router";
import { Alert } from "react-native";

// The backend runs on an in-memory store until Postgres is wired up, so a
// backend restart wipes all users -- a session persisted on the phone can
// then point at a user_id that no longer exists there. Call this from any
// screen's catch block when isStaleSessionError() is true, instead of
// letting the failed request crash the screen.
export async function handleStaleSession(logout: () => Promise<void>) {
  await logout();
  Alert.alert("Signed out", "Your session expired — please log in again.");
  router.replace("/login");
}
