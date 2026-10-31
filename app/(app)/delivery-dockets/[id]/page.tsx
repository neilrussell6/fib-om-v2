import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/delivery-dockets/[id]">) {
  return <ResourceDetailPage resourceKey="delivery_dockets" params={params} />;
}
