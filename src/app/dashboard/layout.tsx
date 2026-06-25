import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import Sidebar from "@/app/components/Sidebar";
import Logo from "@/app/components/Logo";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const roles = session.roles ?? [];
  const userName = session.user?.name ?? session.user?.email ?? "Usuario";
  const primaryRole = roles.includes("admin")
    ? "Admin"
    : roles.includes("editor")
      ? "Editor"
      : "Viewer";

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="hidden lg:block lg:sticky lg:top-0 lg:h-screen">
        <Sidebar roles={roles} userName={userName} primaryRole={primaryRole} logoutAction={logout} />
      </aside>

      <div className="flex min-h-screen flex-col">
        <div className="border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo className="h-8 w-8" />
              <span className="text-sm font-semibold text-gray-900">MFL Platform</span>
            </div>
            <span className="text-xs text-gray-500">{primaryRole}</span>
          </div>
        </div>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
