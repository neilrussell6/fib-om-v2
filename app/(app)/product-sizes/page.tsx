import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/product-sizes">) {
  return <ResourceListPage resourceKey="product_sizes" searchParams={searchParams} />;
}
