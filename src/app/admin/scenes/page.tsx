import { AdminShell } from "@/components/admin/AdminShell";
import { ScenesAdmin } from "@/components/admin/ScenesAdmin";
import { listAllScenes } from "@/lib/scenes/registry";
import { listCatalogs } from "@/lib/catalogs/registry";

export default async function AdminScenesPage() {
  const [scenes, catalogs] = await Promise.all([listAllScenes(), listCatalogs()]);

  return (
    <AdminShell>
      <ScenesAdmin initialScenes={scenes} catalogs={catalogs} />
    </AdminShell>
  );
}
