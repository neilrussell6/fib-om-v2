import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/delivery-dockets/[id]/edit">) {
  return <ResourceEditPage resourceKey="delivery_dockets" params={params} />;
}
