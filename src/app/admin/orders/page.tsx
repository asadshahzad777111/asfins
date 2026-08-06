import { listOrders } from "@/lib/orders/registry";
import { OrdersAdmin } from "@/components/admin/OrdersAdmin";

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const orders = await listOrders();
  return <OrdersAdmin initialOrders={orders} />;
}
