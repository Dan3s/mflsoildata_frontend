/** Small decorative wavy line, centered under a section subtitle. */
export default function WavyUnderline({ className = "text-earth-400" }: { className?: string }) {
  return (
    <svg width="64" height="10" viewBox="0 0 64 10" fill="none" aria-hidden className={`mx-auto ${className}`}>
      <path
        d="M2 6c4-6 8-6 12 0s8 6 12 0 8-6 12 0 8 6 12 0 8-6 12 0"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
