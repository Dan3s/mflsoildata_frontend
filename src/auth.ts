import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import type { JWT } from "next-auth/jwt";

/** Decode a JWT payload without verifying it (the token comes from our own Keycloak). */
function base64UrlDecode(input: string): string {
  let normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  if (typeof atob === "function") return atob(normalized);
  return Buffer.from(normalized, "base64").toString("binary");
}

/** Extract Keycloak realm roles from an access token. */
function rolesFromAccessToken(accessToken?: string): string[] {
  if (!accessToken) return [];
  try {
    const payload = JSON.parse(base64UrlDecode(accessToken.split(".")[1] ?? "")) as {
      realm_access?: { roles?: string[] };
    };
    return payload.realm_access?.roles ?? [];
  } catch {
    return [];
  }
}

/**
 * LAN usability testing (e.g. a coworker hitting this machine's IP instead of
 * localhost): Keycloak's own "Frontend URL" has to point at that same IP for
 * its part of the OIDC flow to be reachable from their browser, which means
 * every token's `iss` claim — and the authorization/token/logout endpoints we
 * call — say that IP too, not localhost, even though Keycloak runs on this
 * same machine. Set AUTH_KEYCLOAK_LOCALTESTS to that IP (optionally
 * "ip:port") to swap it into AUTH_KEYCLOAK_ISSUER's host for this process;
 * leave it unset and nothing changes.
 */
function keycloakIssuer(): string | undefined {
  const base = process.env.AUTH_KEYCLOAK_ISSUER;
  const lanHost = process.env.AUTH_KEYCLOAK_LOCALTESTS?.trim();
  if (!base || !lanHost) return base;
  try {
    const url = new URL(base);
    const [host, port] = lanHost.split(":");
    url.hostname = host;
    if (port) url.port = port;
    return url.toString().replace(/\/$/, "");
  } catch {
    return base;
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const issuer = keycloakIssuer();
    if (!issuer || !token.refreshToken) {
      return { ...token, error: "RefreshAccessTokenError" };
    }
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.AUTH_KEYCLOAK_ID ?? "",
        client_secret: process.env.AUTH_KEYCLOAK_SECRET ?? "",
        refresh_token: token.refreshToken,
      }),
      cache: "no-store",
    });
    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + Number(refreshed.expires_in ?? 300),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      roles: rolesFromAccessToken(refreshed.access_token),
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Keycloak({ issuer: keycloakIssuer() })],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist tokens and roles.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        // Kept server-side only (never copied onto the session): it is the
        // id_token_hint that lets us end the Keycloak SSO session on sign-out.
        token.idToken = account.id_token;
        token.roles = rolesFromAccessToken(account.access_token);
        return token;
      }
      // Still valid (with a 60s safety margin).
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }
      // Expired → try to refresh.
      if (token.refreshToken) {
        return refreshAccessToken(token);
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.roles = token.roles ?? [];
      session.userSub = token.sub;
      session.error = token.error;
      return session;
    },
  },
  events: {
    /**
     * RP-initiated logout. Clearing our own cookie is not enough: the Keycloak
     * SSO session would survive, and the next sign-in would silently re-authenticate
     * without ever asking for credentials. Done back-channel so the id_token never
     * reaches the browser.
     */
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      const issuer = keycloakIssuer();
      if (!token?.idToken || !issuer) return;
      try {
        await fetch(
          `${issuer}/protocol/openid-connect/logout?${new URLSearchParams({
            id_token_hint: token.idToken,
          })}`,
          { method: "GET", cache: "no-store" },
        );
      } catch {
        // Best-effort: never block the user from signing out locally.
      }
    },
  },
});
