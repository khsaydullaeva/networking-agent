import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useState } from "react";

import { AUTH0_CLIENT_ID, AUTH0_DOMAIN } from "@/lib/config";

WebBrowser.maybeCompleteAuthSession();

/**
 * Signs up / logs in via Auth0's standard Universal Login (whatever
 * connections are enabled on the tenant — email/password by default,
 * plus any social connections you've turned on). Returns the resulting
 * ID token, which backend/'s POST /auth/session verifies.
 *
 * Profile links (LinkedIn, Instagram, Facebook, ...) are entered
 * manually after login, on the dashboard — see app/dashboard.tsx — not
 * pulled from a specific social login provider.
 */
export function useAuth0Login() {
  const discovery = AuthSession.useAutoDiscovery(`https://${AUTH0_DOMAIN}`);
  const redirectUri = AuthSession.makeRedirectUri();
  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: AUTH0_CLIENT_ID,
      redirectUri,
      scopes: ["openid", "profile", "email"],
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
      let tokenResponse;
      try {
        tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: AUTH0_CLIENT_ID,
            code: result.params.code,
            redirectUri,
            extraParams: { code_verifier: request.codeVerifier ?? "" },
          },
          discovery
        );
      } catch (e) {
        // A bare 401/"Unauthorized" here (no OAuth error_description) usually
        // means the Auth0 Application is configured as a confidential client
        // (Application Type: Regular Web App) and is being asked for a
        // client secret this public/native app can't provide — switch its
        // Application Type to "Native" in the Auth0 dashboard.
        const message = e instanceof Error ? e.message : String(e);
        throw new Error(
          `Token exchange failed: ${message}. If this says "Unauthorized" with no ` +
            `further detail, check the Auth0 Application's Application Type is set to ` +
            `"Native", not "Regular Web Application".`
        );
      }
      return tokenResponse.idToken ?? null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { login, loading, error, ready: !!discovery && !!request, redirectUri };
}
