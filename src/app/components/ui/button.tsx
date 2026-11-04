import Link from "next/link";
import { ButtonHTMLAttributes, ComponentProps } from "react";

type UIButtonVariant = "primary" | "secondary";
type UIButtonSize = "sm" | "md" | "lg";

interface UIButtonBaseProps {
  variant?: UIButtonVariant;
  size?: UIButtonSize;
  className?: string;
  children: React.ReactNode;
}

interface UIButtonProps
  extends UIButtonBaseProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> {}

interface UIButtonLinkProps
  extends UIButtonBaseProps,
    Omit<ComponentProps<typeof Link>, "className" | "children"> {}

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400/40 disabled:cursor-not-allowed disabled:opacity-50";

const sizeClasses: Record<UIButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

// Secondary matches the gray-outline style already used everywhere else in the
// app (UploadView, MapView, DatasetCatalogue, ...) rather than a one-off color.
const variantClasses: Record<UIButtonVariant, string> = {
  primary: "border-brand-700 bg-brand-700 text-white hover:bg-brand-800",
  secondary: "border-gray-200 bg-white text-gray-700 hover:bg-gray-50",
};

export function UIButton({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: UIButtonProps) {
  return (
    <button className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </button>
  );
}

export function UIButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: UIButtonLinkProps) {
  return (
    <Link className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`.trim()} {...props}>
      {children}
    </Link>
  );
}