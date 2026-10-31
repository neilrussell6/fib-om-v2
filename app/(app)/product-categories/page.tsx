import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/product-categories">) {
  return <ResourceListPage resourceKey="product_categories" searchParams={searchParams} />;
}
