"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canUpload } from "@/app/lib/roles";
import Logo from "@/app/components/Logo";

type SidebarItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** When true, only editors/admins see this item. */
  requiresUpload?: boolean;
};

type SidebarProps = {
  roles: string[];
  userName: string;
  primaryRole: string;
  logoutAction: () => Promise<void>;
};

const sidebarItems: SidebarItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 4h7v7H4V4Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 4h7v4h-7V4Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13 10h7v10h-7V10Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M4 13h7v7H4v-7Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/visualizacion",
    label: "Visualización",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M4 19h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 16V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M12 16V5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M17 16v-9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/mapa",
    label: "Mapa Geográfico",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M9 3l6 2v14l-6-2V3Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M3 6l6 2v12L3 18V6Z" stroke="currentColor" strokeWidth="1.5" />
        <path d="M15 5l6 2v12l-6-2V5Z" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    href: "/dashboard/cargar",
    label: "Cargar Datos",
    requiresUpload: true,
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 9l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/descargar",
    label: "Descargar Datos",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 4v12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M7 11l5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/dashboard/ia",
    label: "Agente IA",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="4" y="7" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M15 3v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar({ roles, userName, primaryRole, logoutAction }: SidebarProps) {
  const pathname = usePathname();
  const allowUpload = canUpload(roles);
  const visibleItems = sidebarItems.filter((item) => !item.requiresUpload || allowUpload);

  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo className="h-9 w-9" />
          <span className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-gray-900">MFL Platform</span>
            <span className="text-[10px] text-gray-500">Multifunctional Landscapes</span>
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 text-sm">
        {visibleItems.map((item) => {
          // "/dashboard" is the index route, so it must match exactly; otherwise it
          // would stay highlighted on every sub-route (e.g. /dashboard/descargar).
          const isIndex = item.href === "/dashboard";
          const active = isIndex
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-colors ${
                active ? "bg-green-50 text-green-700" : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className={active ? "text-green-600" : "text-gray-500"}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <div className="rounded-2xl bg-gray-50 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700 font-semibold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-gray-900">{userName}</div>
              <div className="inline-flex rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{primaryRole}</div>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M15 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M9 8l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}