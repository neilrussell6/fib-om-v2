import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/order-items/[id]">) {
  return <ResourceDetailPage resourceKey="order_items" params={params} />;
}
