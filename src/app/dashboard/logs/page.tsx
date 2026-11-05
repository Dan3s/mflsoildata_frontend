import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { canManageCatalog, isAdmin } from "@/app/lib/roles";
import LogsView from "../components/LogsView";

export default async function LogsPage() {
  const session = await auth();
  // Approval queue is for database_editor / admin; viewers/editors can't see this.
  if (!canManageCatalog(session?.roles)) {
    redirect("/dashboard");
  }
  return <LogsView canViewDownloads={isAdmin(session?.roles)} />;
}
