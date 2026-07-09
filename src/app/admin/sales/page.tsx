import { AdminShell } from "@/components/admin/AdminShell";
import { SalesAdmin } from "@/components/admin/SalesAdmin";
import { listSales } from "@/lib/sales/registry";

export default async function AdminSalesPage() {
  const sales = await listSales();

  return (
    <AdminShell>
      <SalesAdmin initialSales={sales} />
    </AdminShell>
  );
}
