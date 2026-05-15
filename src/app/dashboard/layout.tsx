import Sidebar from "@/app/components/Sidebar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-[#f7f7f5] lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-green-600 text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 12c6-8 16-6 16-6s2 12-12 14C6 18 4 12 4 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="text-sm font-semibold text-gray-900">MFL Platform</span>
            </div>
            <span className="text-xs text-gray-500">Dashboard</span>
          </div>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}