import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-categories/[id]">) {
  return <ResourceDetailPage resourceKey="product_categories" params={params} />;
}
