import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/users/[id]">) {
  return <ResourceDetailPage resourceKey="users" params={params} />;
}
