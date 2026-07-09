import { AdminShell } from "@/components/admin/AdminShell";
import { InquiriesAdmin } from "@/components/admin/InquiriesAdmin";
import { listInquiries } from "@/lib/inquiries/registry";

export default async function AdminInquiriesPage() {
  const inquiries = await listInquiries();

  return (
    <AdminShell>
      <InquiriesAdmin initialInquiries={inquiries} />
    </AdminShell>
  );
}
