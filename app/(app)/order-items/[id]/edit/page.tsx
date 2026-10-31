import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/order-items/[id]/edit">) {
  return <ResourceEditPage resourceKey="order_items" params={params} />;
}
