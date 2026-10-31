import { ResourceEditPage } from "@/components/resource/pages";

export default function Page({ params }: PageProps<"/users/[id]/edit">) {
  return <ResourceEditPage resourceKey="users" params={params} />;
}
