import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/clients">) {
  return <ResourceListPage resourceKey="clients" searchParams={searchParams} />;
}
