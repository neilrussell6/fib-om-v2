import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-types/[id]/edit">) {
  return <ResourceEditPage resourceKey="product_types" params={params} />;
}
