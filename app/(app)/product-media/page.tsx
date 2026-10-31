import { ResourceListPage } from "@/components/resource/pages";

export default function Page({ searchParams }: PageProps<"/product-media">) {
  return <ResourceListPage resourceKey="product_media" searchParams={searchParams} />;
}
