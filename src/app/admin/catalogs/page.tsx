import { AdminShell } from "@/components/admin/AdminShell";
import { CatalogsAdmin } from "@/components/admin/CatalogsAdmin";
import { ZrkBulkImport } from "@/components/admin/ZrkBulkImport";
import { ZrkAutoSync } from "@/components/admin/ZrkAutoSync";
import { listCatalogs } from "@/lib/catalogs/registry";

export default async function AdminCatalogsPage() {
  const catalogs = await listCatalogs();

  return (
    <AdminShell>
      <div className="space-y-8">
        <ZrkAutoSync />
        <ZrkBulkImport />
        <CatalogsAdmin initialCatalogs={catalogs} />
      </div>
    </AdminShell>
  );
}
