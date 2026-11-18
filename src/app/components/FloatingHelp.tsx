"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, LifeBuoy, MessageSquareWarning, X } from "lucide-react";
import { useTranslations } from "next-intl";
import ChatPanel from "./ChatPanel";
import FeedbackPanel from "./FeedbackPanel";

type Panel = "chat" | "feedback";

// One shape, one size, one type style for everything in the corner. What changes is the weight
// of the action: the assistant is the main call to action (filled), feedback the secondary one
// (outlined), and the launcher itself is the darker, bigger anchor.
const PILL =
  "inline-flex items-center gap-2 rounded-full text-sm font-semibold shadow-lg transition-colors " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-700";
const PRIMARY = `${PILL} h-11 bg-brand-700 px-4 text-white hover:bg-brand-800`;
const SECONDARY = `${PILL} h-11 border border-brand-200 bg-white px-4 text-brand-800 hover:bg-brand-50`;
const LAUNCHER = `${PILL} h-12 bg-brand-800 px-5 text-white hover:bg-brand-900`;

/**
 * The only floating control of the site: one "Help" button that, on hover (or tap, or keyboard
 * focus), offers the two things it can do — ask the AI assistant, or send feedback — each named
 * out loud. Choosing one opens its panel in the same corner; the launcher then turns into the
 * way to close it. Both panels stay mounted so a conversation or a half-written message is not
 * lost when the panel is closed.
 */
export default function FloatingHelp() {
  const t = useTranslations("help");
  const tc = useTranslations("chat");
  const tf = useTranslations("feedback");

  const [active, setActive] = useState<Panel | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false); // keyboard focus only
  const [pinned, setPinned] = useState(false); // opened by a click/tap, stays until dismissed
  // After choosing or closing something, the pointer is still over the corner: keep the menu
  // folded until it leaves, instead of popping it open again under the cursor.
  const [quiet, setQuiet] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const menuOpen = active === null && !quiet && (hovered || focused || pinned);

  // Tap/click outside, or Escape, dismisses what is open.
  useEffect(() => {
    if (!menuOpen && active === null) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setPinned(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setPinned(false);
      setFocused(false);
      setActive(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, active]);

  const open = (panel: Panel) => {
    setActive(panel);
    setPinned(false);
    setQuiet(true);
  };
  const close = () => {
    setActive(null);
    setQuiet(true);
  };

  return (
    <>
      <ChatPanel open={active === "chat"} onClose={close} />
      <FeedbackPanel open={active === "feedback"} onClose={close} />

      <div
        ref={root}
        className="fixed bottom-5 right-5 z-50 flex flex-col-reverse items-end gap-2"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => {
          setHovered(false);
          setQuiet(false);
        }}
        onFocus={(e) => {
          if (e.target.matches(":focus-visible")) setFocused(true);
        }}
        onBlur={(e) => {
          if (!root.current?.contains(e.relatedTarget as Node | null)) setFocused(false);
        }}
      >
        {/* First in the DOM, so Tab reaches the launcher before the options it reveals. */}
        <button
          type="button"
          className={LAUNCHER}
          aria-expanded={menuOpen || active !== null}
          aria-controls="floating-help-menu"
          onClick={() => {
            if (active) return close();
            setQuiet(false);
            setPinned((v) => !v);
          }}
        >
          {active ? <X className="h-5 w-5" aria-hidden /> : <LifeBuoy className="h-5 w-5" aria-hidden />}
          {active ? t("close") : t("launcher")}
        </button>

        <div
          id="floating-help-menu"
          role="group"
          aria-label={t("menuLabel")}
          // `invisible` (not just transparent) takes the options out of the tab order while folded.
          className={`flex flex-col items-end gap-2 transition duration-150 ${
            menuOpen ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0"
          }`}
        >
          <button type="button" className={PRIMARY} onClick={() => open("chat")}>
            <Bot className="h-5 w-5" aria-hidden />
            {tc("title")}
          </button>
          <button type="button" className={SECONDARY} onClick={() => open("feedback")}>
            <MessageSquareWarning className="h-5 w-5" aria-hidden />
            {tf("button")}
          </button>
        </div>
      </div>
    </>
  );
}
