import React from 'react';

export default function FeatureCard({
  icon,
  title,
  children,
  iconColorClass = "bg-brand-100 text-brand-800",
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  /** Icon-circle color, so a grid of cards can vary hue instead of all matching. */
  iconColorClass?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-full ${iconColorClass}`}>
        {icon}
      </div>
      <h4 className="mb-2 text-base font-semibold text-gray-800">{title}</h4>
      <p className="text-sm text-gray-600">{children}</p>
    </div>
  );
}
