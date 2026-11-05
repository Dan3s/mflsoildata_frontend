/** Small "?" that reveals the field's explanation on hover or focus. The one tooltip pattern used app-wide. */
export function FieldHelp({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={text}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 text-[9px] font-semibold text-gray-500 hover:border-brand-500 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-64 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
