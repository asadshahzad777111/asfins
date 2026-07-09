import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { AdminShellClient } from "./AdminShellClient";

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const authed = await isAdminAuthenticated();
  if (!authed) redirect("/admin");

  return <AdminShellClient>{children}</AdminShellClient>;
}
