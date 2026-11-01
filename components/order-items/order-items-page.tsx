import { LinkButton } from "@/components/resource/link-button";
import { PageHeader } from "@/components/resource/page-header";
import { first, listParamsFromUrl, type SearchParams } from "@/components/resource/pages";
import { FilterBar } from "@/components/resource/filter-bar";
import { Pagination } from "@/components/resource/pagination";
import { countByStatus, listRecords } from "@/lib/db/list-query";
import { getOrderItemPanel } from "@/lib/order-items/panel-queries";
import { isId } from "@/lib/order-items/stages";
import { getResource, ORDER_STATUS, resourceNewLabel, resourceTitle } from "@/lib/resources";
import { NotFoundToast } from "./not-found-toast";
import { OrderItemPanel, type PanelData } from "./order-item-panel";
import { OrderItemsTable } from "./order-items-table";
import { StatusTabs } from "./status-tabs";

/** The current URL's query without `item` (so opening and closing the panel keeps the list as it is). */
function queryWithout(sp: Record<string, string | string[] | undefined>, drop: string): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === drop || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  return params.toString();
}

/**
 * The Order Items list (spec 06): status tabs with counts, the design's columns,
 * and the edit panel on the right when `?item=<id>` is set.
 */
export async function OrderItemsListPage({ searchParams }: { searchParams: SearchParams }) {
  const ui = getResource("order_items");
  const sp = await searchParams;
  const params = listParamsFromUrl("order_items", sp);
  const statusParam = first(sp.status);
  const status = ORDER_STATUS.some((o) => o.value === statusParam) ? statusParam! : "";
  const itemParam = first(sp.item);
  const [result, counts, panel] = await Promise.all([
    listRecords("order_items", { ...params, status: status || undefined }),
    countByStatus("order_items", params.filters),
    itemParam && isId(itemParam) ? getOrderItemPanel(itemParam) : Promise.resolve(null),
  ]);
  const notFound = Boolean(itemParam && isId(itemParam) && !panel);
  const baseQuery = queryWithout(sp, "item");

  return (
    <div className="order-items -mx-4 -mt-7 -mb-4 flex h-[calc(100%+2.75rem)] md:-mx-8" data-panel-open={panel ? "" : undefined}>
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-7 md:px-8">
        <PageHeader title={resourceTitle(ui)}>
          <LinkButton href={`${ui.path}/new`} variant="default">
            {resourceNewLabel(ui)}
          </LinkButton>
        </PageHeader>
        <StatusTabs counts={counts} active={status} />
        <FilterBar filters={ui.list.filters} />
        <OrderItemsTable
          columns={ui.list.columns}
          rows={result.rows}
          sort={result.sort}
          dir={result.dir}
          baseQuery={baseQuery}
          selectedId={panel ? String(panel.id) : null}
          panelOpen={Boolean(panel)}
        />
        <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
      </div>
      {panel ? <OrderItemPanel key={String(panel.id)} data={panel as PanelData} baseQuery={baseQuery} activeStatus={status} /> : null}
      {notFound ? <NotFoundToast /> : null}
    </div>
  );
}
