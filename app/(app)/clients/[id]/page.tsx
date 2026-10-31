import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/clients/[id]">) {
  return <ResourceDetailPage resourceKey="clients" params={params} />;
}
