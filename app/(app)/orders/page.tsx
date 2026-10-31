import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/orders">) {
  return <ResourceListPage resourceKey="orders" searchParams={searchParams} />;
}
