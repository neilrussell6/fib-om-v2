import { OrderItemsListPage } from "@/components/order-items/order-items-page";

export default function Page({ searchParams }: PageProps<"/order-items">) {
  return <OrderItemsListPage searchParams={searchParams} />;
}
