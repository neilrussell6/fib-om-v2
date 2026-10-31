import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-sizes/[id]">) {
  return <ResourceDetailPage resourceKey="product_sizes" params={params} />;
}
