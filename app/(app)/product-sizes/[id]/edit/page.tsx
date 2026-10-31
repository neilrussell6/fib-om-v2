import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-sizes/[id]/edit">) {
  return <ResourceEditPage resourceKey="product_sizes" params={params} />;
}
