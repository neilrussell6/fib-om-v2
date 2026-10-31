import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/order-items">) {
  return <ResourceListPage resourceKey="order_items" searchParams={searchParams} />;
}
