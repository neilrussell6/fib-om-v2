import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/users">) {
  return <ResourceListPage resourceKey="users" searchParams={searchParams} />;
}
