import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/product-types">) {
  return <ResourceListPage resourceKey="product_types" searchParams={searchParams} />;
}
