import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/products/[id]">) {
  return <ResourceDetailPage resourceKey="products" params={params} />;
}
