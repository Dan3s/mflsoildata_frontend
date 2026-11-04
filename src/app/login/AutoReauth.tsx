"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

/**
 * When the session expired (and could not be refreshed), bounce straight back
 * to Keycloak to re-authenticate. With an active SSO session this is seamless.
 */
export default function AutoReauth({ callbackUrl, locale }: { callbackUrl: string; locale?: string }) {
  useEffect(() => {
    signIn("keycloak", { callbackUrl }, locale ? { ui_locales: locale } : undefined);
  }, [callbackUrl, locale]);

  return null;
}
