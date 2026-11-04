"use client";

import { Fragment, useRef, useState } from "react";
import { Bot, MessageCircle, Send, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { signIn, useSession } from "next-auth/react";
import { chatService, ApiError, type ChatTurn } from "@/app/services";

/** Inline `**bold**` within one line of text. */
function renderInline(line: string, keyPrefix: string) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>
    ) : (
      <Fragment key={`${keyPrefix}-${i}`}>{part}</Fragment>
    ),
  );
}

/**
 * Just enough Markdown for a chat reply: bold text and bullet lists. The
 * model (see services/gemini_chat.py) writes plain conversational answers,
 * not full documents, so a hand-rolled formatter is plenty — no need for a
 * full Markdown dependency for a couple of short paragraphs and lists.
 */
function formatChatText(text: string) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={`list-${blocks.length}`} className="list-disc space-y-0.5 pl-4">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item, `li-${blocks.length}-${i}`)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const bullet = /^\s*[-*]\s+(.*)/.exec(line);
    if (bullet) {
      listItems.push(bullet[1]);
      return;
    }
    flushList();
    if (line.trim()) {
      blocks.push(<p key={`p-${i}`}>{renderInline(line, `p-${i}`)}</p>);
    }
  });
  flushList();

  return blocks;
}

/** Floating chat bubble, global to the whole site. Answers questions about the
 * platform's data by calling backend tools — see services/gemini_chat.py. */
export default function ChatWidget() {
  const t = useTranslations("chat");
  const { status } = useSession();
  const isSignedIn = status === "authenticated";

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const history = messages;
    setMessages([...history, { role: "user", text }]);
    setInput("");
    setError(null);
    setSending(true);
    scrollToBottom();

    try {
      const { reply } = await chatService.sendMessage(text, history);
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("errorMessage"));
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col rounded-2xl border border-gray-200 bg-white shadow-xl">
          <div className="flex items-center justify-between rounded-t-2xl bg-brand-800 px-4 py-3 text-white">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <Bot className="h-4 w-4" />
              {t("title")}
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("close")} className="text-brand-100 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {!isSignedIn ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 text-center text-sm text-gray-600">
              <Bot className="h-8 w-8 text-brand-300" />
              <p>{t("signInPrompt")}</p>
              <button
                type="button"
                onClick={() => signIn("keycloak")}
                className="rounded-xl bg-brand-700 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-800"
              >
                {t("signIn")}
              </button>
            </div>
          ) : (
            <>
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {messages.length === 0 && (
                  <div className="flex items-start gap-3 text-sm text-gray-500">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <Bot className="h-4 w-4" />
                    </span>
                    <span>{t("emptyState")}</span>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] space-y-1.5 rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {m.role === "assistant" ? formatChatText(m.text) : m.text}
                    </div>
                  </div>
                ))}
                {sending && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl bg-gray-100 px-3 py-2 text-sm text-gray-400">{t("thinking")}</div>
                  </div>
                )}
                {error && <p className="text-xs text-red-600">{error}</p>}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="flex items-center gap-2 border-t border-gray-200 p-3"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t("inputPlaceholder")}
                  disabled={sending}
                  className="flex-1 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-50"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  aria-label={t("send")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-white transition-colors hover:bg-brand-800 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg transition-colors hover:bg-brand-800"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
