import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-categories/[id]/edit">) {
  return <ResourceEditPage resourceKey="product_categories" params={params} />;
}
