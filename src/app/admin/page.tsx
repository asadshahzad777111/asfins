import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin/auth";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default async function AdminPage() {
  const authed = await isAdminAuthenticated();
  if (authed) redirect("/admin/scenes");
  return <AdminLoginForm />;
}
