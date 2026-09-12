import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from "@/lib/config";

WebBrowser.maybeCompleteAuthSession();

/**
 * Logs in via Auth0 Universal Login with LinkedIn forced as the social
 * connection (see backend/README.md §6 — LinkedIn must be enabled as a
 * social connection in the Auth0 dashboard first). Returns the resulting
 * ID token, which backend/'s POST /auth/session verifies.
 */
export function useAuth0Login() {
  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);
  const redirectUri = AuthSession.makeRedirectUri();
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
      extraParams: { connection: "linkedin" },
    },
    discovery
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (): Promise<string | null> => {
    if (!discovery || !request) return null;
    setLoading(true);
    setError(null);
    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        if (result.type === "error") {
          setError(result.error?.message ?? "Login failed");
        }
        return null;
      }
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: AUTH0_CLIENT_ID,
          code: result.params.code,
          redirectUri,
          extraParams: { code_verifier: request.codeVerifier ?? "" },
        },
        discovery
      );
      return tokenResponse.idToken ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error, ready: !!discovery && !!request };
}
