import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "@/app/lib/roles";
import UsersView from "../components/UsersView";

export default async function UsersPage() {
  const session = await auth();
  // Role assignment is admin-only; everyone else never reaches this screen.
  if (!isAdmin(session?.roles)) {
    redirect("/dashboard");
  }
  return <UsersView currentUserSub={session?.userSub} />;
}
