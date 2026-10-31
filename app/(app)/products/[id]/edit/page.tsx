import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/products/[id]/edit">) {
  return <ResourceEditPage resourceKey="products" params={params} />;
}
