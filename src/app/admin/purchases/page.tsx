import { AdminShell } from "@/components/admin/AdminShell";
import { PurchasesAdmin } from "@/components/admin/PurchasesAdmin";
import { listPurchases } from "@/lib/purchases/registry";

export default async function AdminPurchasesPage() {
  const purchases = await listPurchases();

  return (
    <AdminShell>
      <PurchasesAdmin initialPurchases={purchases} />
    </AdminShell>
  );
}
