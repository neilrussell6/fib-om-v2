import { ResourceDetailPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-media/[id]">) {
  return <ResourceDetailPage resourceKey="product_media" params={params} />;
}
