import React from 'react';

export default function FeatureCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
        {icon}
      </div>
      <h4 className="mb-2 text-base font-semibold text-gray-800">{title}</h4>
      <p className="text-sm text-gray-600">{children}</p>
    </div>
  );
}
