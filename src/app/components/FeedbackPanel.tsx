"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageSquareWarning, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ApiError, feedbackService, type FeedbackType } from "@/app/services";

const TYPES: FeedbackType[] = ["bug", "suggestion", "question", "other"];
const MAX_MESSAGE = 3000;
const MIN_MESSAGE = 5;
const EMAIL_RE = /^[^@\s<>,;]+@[^@\s<>,;]+\.[^@\s<>,;]+$/;

/**
 * The feedback panel (opened from FloatingHelp). Open to everyone, signed in or not: a person
 * who cannot sign in is exactly who needs it. The message is emailed to the team (nothing is
 * stored). Only the page path, language and browser go along; who the person is goes only if
 * they type an email to be answered at. It stays mounted while closed, so a half-written
 * message survives closing the panel by accident.
 */
export default function FeedbackPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("feedback");
  const locale = useLocale();
  const pathname = usePathname();
  const { data: session } = useSession();
  const sessionEmail = session?.user?.email ?? "";

  const [type, setType] = useState<FeedbackType>("bug");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Offer the signed-in person's address, but never override what they typed or cleared.
  useEffect(() => {
    if (!emailTouched) setEmail(sessionEmail);
  }, [sessionEmail, emailTouched]);

  const reset = () => {
    setMessage("");
    setType("bug");
    setError(null);
    setSent(false);
  };

  const submit = async () => {
    const text = message.trim();
    const contact = email.trim();
    if (sending) return;
    if (text.length < MIN_MESSAGE) return setError(t("errors.tooShort", { min: MIN_MESSAGE }));
    if (contact && !EMAIL_RE.test(contact)) return setError(t("errors.badEmail"));

    setError(null);
    setSending(true);
    try {
      await feedbackService.send({
        type,
        message: text,
        contact_email: contact || undefined,
        page: pathname || undefined,
        language: locale,
        website: website || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t("errors.tooMany") : t("errors.failed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-label={t("title")}
      className={`fixed bottom-[5rem] right-5 z-50 max-h-[calc(100vh-7rem)] w-80 max-w-[calc(100vw-2.5rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-xl ${open ? "flex" : "hidden"}`}
    >
      <div className="flex items-center justify-between rounded-t-2xl bg-brand-800 px-4 py-3 text-white">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <MessageSquareWarning className="h-4 w-4" />
          {t("title")}
        </span>
        <button type="button" onClick={onClose} aria-label={t("close")} className="text-brand-100 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 px-4 py-8 text-center text-sm text-gray-600">
          <CheckCircle2 className="h-8 w-8 text-brand-600" />
          <p className="font-semibold text-gray-800">{t("sentTitle")}</p>
          <p>{t("sentBody")}</p>
          <button
            type="button"
            onClick={reset}
            className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            {t("another")}
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm"
        >
          <p className="text-gray-600">{t("intro")}</p>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-700">{t("typeLabel")}</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FeedbackType)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            >
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {t(`types.${value}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-baseline justify-between text-xs font-semibold text-gray-700">
              {t("messageLabel")}
              <span className="font-normal text-gray-400">{t("characters", { count: message.length, max: MAX_MESSAGE })}</span>
            </span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={MAX_MESSAGE}
              rows={5}
              placeholder={t("messagePlaceholder")}
              className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-gray-700">{t("emailLabel")}</span>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmailTouched(true);
                setEmail(e.target.value);
              }}
              autoComplete="email"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <span className="mt-1 block text-xs text-gray-400">{t("emailHelp")}</span>
          </label>

          {/* Honeypot: invisible and unreachable for a person, tempting for a bot. */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Website
              <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
          </div>

          <p className="text-xs text-gray-400">{t("pageNote")}</p>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-800 disabled:opacity-50"
          >
            {sending ? t("sending") : t("send")}
          </button>
        </form>
      )}
    </div>
  );
}
