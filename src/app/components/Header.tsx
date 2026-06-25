"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import Logo from "@/app/components/Logo";

const Header = () => {
  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3 text-sm font-semibold text-gray-900">
          <Logo className="h-9 w-9" />
          <span className="flex flex-col leading-tight">
            <span>MFL Platform</span>
            <span className="text-[10px] font-normal text-gray-500">Multifunctional Landscapes</span>
          </span>
        </Link>

        <button
          type="button"
          onClick={() => signIn("keycloak", { callbackUrl: "/dashboard" })}
          className="inline-flex items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700"
        >
          Iniciar Sesión
        </button>
      </div>
    </header>
  );
};

export default Header;