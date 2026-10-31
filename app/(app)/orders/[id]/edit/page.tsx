import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/orders/[id]/edit">) {
  return <ResourceEditPage resourceKey="orders" params={params} />;
}
