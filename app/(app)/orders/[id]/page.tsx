import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/orders/[id]">) {
  return <ResourceDetailPage resourceKey="orders" params={params} />;
}
