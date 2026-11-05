"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Loader2, ShieldCheck, AlertTriangle, Check } from "lucide-react";
import { userService, ApiError } from "@/app/services";
import type { AppRole, UserItem } from "@/app/services";

/** Lowest privilege first — the order the radio list is rendered in. */
const ROLE_ORDER: AppRole[] = ["viewer", "editor", "database_editor", "admin"];

const ROLE_BADGE: Record<AppRole, string> = {
  viewer: "bg-gray-100 text-gray-700",
  editor: "bg-blue-100 text-blue-700",
  database_editor: "bg-purple-100 text-purple-700",
  admin: "bg-brand-100 text-brand-800",
};

/** The role a user effectively has = the highest one assigned. */
const primaryRole = (roles: AppRole[]): AppRole => {
  for (let i = ROLE_ORDER.length - 1; i >= 0; i -= 1) {
    if (roles.includes(ROLE_ORDER[i])) return ROLE_ORDER[i];
  }
  return "viewer";
};

const displayName = (u: UserItem) =>
  [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username || u.email || u.id;

export default function UsersView({ currentUserSub }: { currentUserSub?: string }) {
  const t = useTranslations("users");

  const [users, setUsers] = useState<UserItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback((term: string) => {
    setLoading(true);
    userService
      .list(term.trim() || undefined)
      .then((data) => {
        setUsers(data);
        setError(null);
      })
      .catch((err) => {
        // 503 = the API cannot reach Keycloak (usually missing admin credentials).
        const detail = err instanceof ApiError ? (err.payload as { detail?: string })?.detail : null;
        setError(detail ?? t("loadFailed"));
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [t]);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => load(search), 300);
    return () => clearTimeout(timer);
  }, [search, load]);

  const changeRole = async (user: UserItem, role: AppRole) => {
    setSavingId(user.id);
    setRowError(null);
    try {
      const roles = await userService.setRoles(user.id, [role]);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roles } : u)));
      setSavedId(user.id);
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      const detail = err instanceof ApiError ? (err.payload as { detail?: string })?.detail : null;
      setRowError({ id: user.id, message: detail ?? t("saveFailed") });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("title")}</h1>
          <p className="mt-1 text-sm text-gray-500">{t("subtitle")}</p>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-700" />
              <div>
                <h2 className="text-base font-semibold text-gray-900">{t("listTitle")}</h2>
                <p className="text-xs text-gray-500">{t("listSubtitle")}</p>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 w-72 rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:bg-white"
              />
            </div>
          </div>

          {error ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm text-amber-800">{error}</p>
            </div>
          ) : loading ? (
            <div className="flex items-center gap-2 py-10 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" /> …
            </div>
          ) : users.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
              {t("empty")}
            </p>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const current = primaryRole(user.roles);
                const isSelf = Boolean(currentUserSub) && user.id === currentUserSub;
                return (
                  <div key={user.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-semibold text-gray-900">{displayName(user)}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[current]}`}>
                            {t(`roles.${current}`)}
                          </span>
                          {isSelf ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t("you")}</span>
                          ) : null}
                          {!user.enabled ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">{t("disabled")}</span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{user.email || user.username}</p>
                        {(user.organization || user.country) ? (
                          <p className="truncate text-xs text-gray-400">
                            {[user.organization, user.country].filter(Boolean).join(" · ")}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {savingId === user.id ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" /> : null}
                        {savedId === user.id ? <Check className="h-4 w-4 text-brand-700" /> : null}
                        {ROLE_ORDER.map((role) => {
                          const active = current === role;
                          // An admin cannot demote themselves: the API refuses it,
                          // so don't offer it here either.
                          const blocked = isSelf && current === "admin" && role !== "admin";
                          return (
                            <button
                              key={role}
                              type="button"
                              onClick={() => changeRole(user, role)}
                              disabled={active || blocked || savingId === user.id}
                              title={blocked ? t("cannotDemoteSelf") : undefined}
                              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                active
                                  ? "border-brand-700 bg-brand-700 text-white"
                                  : blocked
                                    ? "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300"
                                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                              }`}
                            >
                              {t(`roles.${role}`)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {rowError?.id === user.id ? (
                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <p className="text-xs text-red-700">{rowError.message}</p>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
