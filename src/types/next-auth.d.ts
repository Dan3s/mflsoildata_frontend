import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    roles: string[];
    /** Keycloak user id (token `sub`). Named `userSub` because Auth.js already
     *  declares a required `userId` on AdapterSession. */
    userSub?: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    /** Kept for RP-initiated logout (id_token_hint). Never exposed on the session. */
    idToken?: string;
    expiresAt?: number;
    roles?: string[];
    error?: string;
  }
}
