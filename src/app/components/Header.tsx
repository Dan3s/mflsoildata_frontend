"use client";

import Link from "next/link";
const Header = () => {
  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-gray-900">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M4 12c6-8 16-6 16-6s2 12-12 14C6 18 4 12 4 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 10c2 0 4 2 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span>MFL Platform</span>
            <span className="text-[10px] font-normal text-gray-500">Multifunctional Landscapes</span>
          </span>
        </Link>

        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
        >
          Acceder a la Plataforma
        </Link>
      </div>
    </header>
  );
};

export default Header;