import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/product-media/[id]/edit">) {
  return <ResourceEditPage resourceKey="product_media" params={params} />;
}
