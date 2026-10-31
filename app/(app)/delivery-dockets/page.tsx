import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/delivery-dockets">) {
  return <ResourceListPage resourceKey="delivery_dockets" searchParams={searchParams} />;
}
