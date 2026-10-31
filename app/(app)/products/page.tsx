import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/products">) {
  return <ResourceListPage resourceKey="products" searchParams={searchParams} />;
}
