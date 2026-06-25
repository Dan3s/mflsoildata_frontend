type LogoProps = {
  className?: string;
};

/**
 * MFL Platform logo — isometric soil-profile cube: green top with a sprout +
 * cycle + plus signs (soil health), brown horizons with soil texture on the
 * right, and a data (bar chart) face on the left. Fixed colors by design.
 */
export default function Logo({ className = "h-9 w-9" }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="16 0 108 116"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="MFL Platform"
    >
      <polygon points="28,29 70,50 70,106 28,85" fill="#14532d" />
      <g transform="matrix(42,21,0,56,28,29)">
        <path d="M0.18 0.80 L0.82 0.80" stroke="#86efac" strokeWidth="0.02" fill="none" />
        <rect x="0.24" y="0.50" width="0.13" height="0.30" fill="#86efac" />
        <rect x="0.43" y="0.38" width="0.13" height="0.42" fill="#dcfce7" />
        <rect x="0.62" y="0.26" width="0.13" height="0.54" fill="#86efac" />
      </g>
      <polygon points="70,50 112,29 112,38 70,59" fill="#5a3c1f" />
      <polygon points="70,59 112,38 112,52.5 70,73.5" fill="#7c5128" />
      <polygon points="70,73.5 112,52.5 112,68.2 70,89.2" fill="#9c6b34" />
      <polygon points="70,89.2 112,68.2 112,85 70,106" fill="#c39a5c" />
      <circle cx="80" cy="92" r="1.8" fill="#6b4a2a" />
      <circle cx="88" cy="95" r="1.6" fill="#5a3c1f" />
      <circle cx="96" cy="90" r="1.7" fill="#6b4a2a" />
      <circle cx="84" cy="84" r="1.5" fill="#6b4a2a" />
      <circle cx="92" cy="80" r="1.5" fill="#5a3c1f" />
      <circle cx="100" cy="77" r="1.4" fill="#6b4a2a" />
      <circle cx="98" cy="66" r="1.3" fill="#6b4a2a" />
      <polygon points="70,8 112,29 70,50 28,29" fill="#16a34a" />
      <path d="M82 38 A13 8 0 1 1 76 30" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
      <polygon points="80,26 88,31 79,34" fill="#ffffff" />
      <path d="M70 30 L70 16" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M70 23 C65 18, 58 18, 56 21 C59 26, 66 27, 70 23 Z" fill="#ffffff" />
      <path d="M70 23 C75 18, 82 18, 84 21 C81 26, 74 27, 70 23 Z" fill="#ffffff" />
      <path d="M45 27 H51 M48 24 V30" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M89 27 H95 M92 24 V30" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M70 8 L112 29 L70 50 L28 29 Z M70 50 L70 106 M28 29 L28 85 L70 106 L112 85 L112 29"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.7"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
