import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-types/[id]">) {
  return <ResourceDetailPage resourceKey="product_types" params={params} />;
}
