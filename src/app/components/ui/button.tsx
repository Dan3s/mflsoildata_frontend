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
  "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#bc6c25]/40 disabled:cursor-not-allowed disabled:opacity-50";

const sizeClasses: Record<UIButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-6 py-3 text-base",
};

const variantClasses: Record<UIButtonVariant, string> = {
  primary: "border-green-600 bg-green-600 text-white hover:bg-green-700",
  secondary:
    "border-[#bc6c25] bg-white text-[#bc6c25] hover:bg-[#fcf6ee]",
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