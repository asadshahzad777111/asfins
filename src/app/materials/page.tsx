import { redirect } from "next/navigation";

/** Legacy listing URL — catalogs live at /products */
export default function MaterialsIndexPage() {
  redirect("/products");
}
