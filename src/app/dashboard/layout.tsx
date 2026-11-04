import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth, signOut } from "@/auth";
import Sidebar from "@/app/components/Sidebar";
import Logo from "@/app/components/Logo";
import Footer from "@/app/components/Footer";
import { primaryRoleLabel } from "@/app/lib/roles";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }

  const t = await getTranslations("common");
  const roles = session.roles ?? [];
  const userName = session.user?.name ?? session.user?.email ?? t("userFallback");
  const primaryRole = primaryRoleLabel(roles);

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    // Footer sits outside the grid so it runs the full width of the page. Inside
    // the grid it stopped at the sidebar, leaving an empty pale block bottom-left.
    <div className="flex min-h-screen flex-col bg-[#f2f7f3]">
      <div className="flex-1 lg:grid lg:grid-cols-[18rem_1fr]">
        {/* The colour lives on the grid cell, not on the sticky element: the cell is
            as tall as the page, so the column stays dark past the first screenful. */}
        <aside className="hidden bg-brand-900 lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar roles={roles} userName={userName} primaryRole={primaryRole} logoutAction={logout} />
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <div className="border-b border-white/10 bg-brand-900 px-4 py-3 text-white lg:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Logo className="h-8 w-8" />
                <span className="text-sm font-semibold text-white">{t("appName")}</span>
              </div>
              <span className="text-xs text-brand-300">{primaryRole}</span>
            </div>
          </div>

          <main className="flex-1">{children}</main>
        </div>
      </div>

      {/* Full-width: the attribution belongs to the page, not to the content column. */}
      <Footer />
    </div>
  );
}
