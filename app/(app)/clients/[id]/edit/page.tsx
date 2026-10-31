import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/clients/[id]/edit">) {
  return <ResourceEditPage resourceKey="clients" params={params} />;
}
