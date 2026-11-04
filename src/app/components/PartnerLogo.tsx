type PartnerLogoProps = {
  className?: string;
};

/**
 * CGIAR — Multifunctional Landscapes lockup. The image asset lives in
 * `public/cgiar-mfl-logo.png` (served at `/cgiar-mfl-logo.png`). The logo has a
 * fixed aspect ratio (~4.4:1), so set only the height via `className` and let the
 * width scale automatically.
 */
export default function PartnerLogo({ className = "h-8" }: PartnerLogoProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/cgiar-mfl-logo.png"
      alt="CGIAR — Multifunctional Landscapes"
      className={`${className} w-auto object-contain`}
    />
  );
}
