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

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    const issuer = process.env.AUTH_KEYCLOAK_ISSUER;
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
  providers: [Keycloak],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      // Initial sign-in: persist tokens and roles.
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
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
      session.error = token.error;
      return session;
    },
  },
});
