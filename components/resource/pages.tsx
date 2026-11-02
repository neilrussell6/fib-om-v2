import { notFound } from "next/navigation";
import { countByStatus, listRecords } from "@/lib/db/list-query";
import { getRecord } from "@/lib/db/records";
import { isId } from "@/lib/ids";
import { getResource, resourceNewLabel, resourceTitle, singularLabel } from "@/lib/resources";
import type { ResourceKey } from "@/lib/resources/types";
import { DeleteButton } from "./delete-button";
import { FilterBar } from "./filter-bar";
import { formatValue } from "./format";
import { NewRecordLink } from "./create/new-record-link";
import { RecordCreateForm } from "./create/record-create-form";
import { LinkButton } from "./link-button";
import { NotFoundToast } from "./not-found-toast";
import { PageHeader } from "./page-header";
import { Pagination } from "./pagination";
import { PrintButton } from "./print-button";
import { RecordPanel } from "./record-panel";
import { ResourceForm } from "./resource-form";
import { ResourceTable } from "./resource-table";
import { StatusTabs } from "./status-tabs";

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

export const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** The list's "New …" link: the list's current query plus `new=1` (spec 08). */
export const newHref = (path: string, query: string) => `${path}?${query ? `${query}&` : ""}new=1`;


/** The current URL's query without the `drop` keys (so opening and closing a panel or dialog keeps the list as it is). */
export function queryWithout(sp: Record<string, string | string[] | undefined>, ...drop: string[]): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (drop.includes(k) || v === undefined) continue;
    for (const x of Array.isArray(v) ? v : [v]) params.append(k, x);
  }
  return params.toString();
}

/** The list query's params from the URL: only the resource's own filter keys and column sort keys (spec 02). */
export function listParamsFromUrl(resourceKey: ResourceKey, sp: Record<string, string | string[] | undefined>) {
  const ui = getResource(resourceKey);
  const filters = Object.fromEntries(ui.list.filters.map((f) => [f.key, first(sp[f.key])]).filter(([, v]) => v)) as Record<string, string>;
  const sortParam = first(sp.sort);
  const sort = ui.list.columns.some((c) => c.key === sortParam) ? sortParam : undefined;
  const dirParam = first(sp.dir);
  const dir: "asc" | "desc" | undefined = sort ? (dirParam === "desc" ? "desc" : "asc") : undefined;
  return { filters, sort, dir, page: Number(first(sp.page)) || 1, pageSize: Number(first(sp.pageSize)) || undefined };
}

async function recordOr404(resourceKey: ResourceKey, params: IdParams) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const record = await getRecord(resourceKey, id);
  if (!record) notFound();
  return { id, record };
}

/**
 * List page: heading, New, filters, table, pagination (spec 02); status tabs when
 * the resource has them, and the edit panel for `?item=<id>` (spec 07).
 */
export async function ResourceListPage({ resourceKey, searchParams }: { resourceKey: ResourceKey; searchParams: SearchParams }) {
  const ui = getResource(resourceKey);
  const sp = await searchParams;
  const params = listParamsFromUrl(resourceKey, sp);
  const tabs = ui.list.statusTabs;
  const statusParam = first(sp.status);
  const status = tabs && tabs.options.some((o) => o.value === statusParam) ? statusParam! : "";
  const itemParam = first(sp.item);
  const [result, counts, record] = await Promise.all([
    listRecords(resourceKey, { ...params, status: tabs ? status || undefined : undefined }),
    tabs ? countByStatus(resourceKey, params.filters) : Promise.resolve(null),
    isId(itemParam) ? getRecord(resourceKey, itemParam) : Promise.resolve(null),
  ]);
  const notFoundItem = isId(itemParam) && !record;
  // The panel and the row links never carry `new`; the dialog closes to the URL without `new` only (spec 08).
  const baseQuery = queryWithout(sp, "item", "new");
  const isNew = first(sp.new) === "1";
  const dialogQuery = queryWithout(sp, "new");

  return (
    <div className="-mx-4 -mt-7 -mb-4 flex h-[calc(100%+2.75rem)] md:-mx-8">
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-7 md:px-8">
        <PageHeader title={resourceTitle(ui)}>
          <NewRecordLink href={newHref(ui.path, dialogQuery)} label={resourceNewLabel(ui)} />
        </PageHeader>
        {tabs && counts ? <StatusTabs counts={counts} active={status} options={tabs.options} /> : null}
        <FilterBar filters={ui.list.filters} />
        <ResourceTable
          resourceKey={resourceKey}
          rows={result.rows}
          sort={result.sort}
          dir={result.dir}
          baseQuery={baseQuery}
          selectedId={record ? String(record.id) : null}
        />
        <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
      </div>
      {record ? (
        <RecordPanel key={String(record.id)} resourceKey={resourceKey} record={record} baseQuery={baseQuery} activeStatus={status} covered={isNew} />
      ) : null}
      {isNew ? <RecordCreateForm resourceKey={resourceKey} baseQuery={dialogQuery} /> : null}
      {notFoundItem ? <NotFoundToast label={singularLabel(ui)} /> : null}
    </div>
  );
}

/** Detail page: labelled read-only fields with Back, Print and Edit (spec 02). */
export async function ResourceDetailPage({ resourceKey, params }: { resourceKey: ResourceKey; params: IdParams }) {
  const ui = getResource(resourceKey);
  const { id, record } = await recordOr404(resourceKey, params);
  const fields = ui.fields.filter((f) => f.detail !== false);
  return (
    <>
      <PageHeader title={ui.singular}>
        <LinkButton href={ui.path}>Back</LinkButton>
        <PrintButton />
        <LinkButton href={`${ui.path}/${id}/edit`} variant="default">
          Edit
        </LinkButton>
      </PageHeader>
      <dl className="grid max-w-3xl gap-x-6 gap-y-3 sm:grid-cols-[minmax(10rem,auto)_1fr]">
        {fields.map((f) => {
          const raw = f.type === "reference" && f.display ? record[f.display] : record[f.name];
          return (
            <div key={f.name} className="contents">
              <dt className="text-[13px] font-medium text-label">{f.label}</dt>
              <dd>{formatValue(raw, f.type, f.options) || "—"}</dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}

/** Create page (spec 02). */
export function ResourceCreatePage({ resourceKey }: { resourceKey: ResourceKey }) {
  const ui = getResource(resourceKey);
  return (
    <>
      <PageHeader title={`Create a ${ui.singular}`}>
        <LinkButton href={ui.path}>Back</LinkButton>
      </PageHeader>
      <ResourceForm resourceKey={resourceKey} />
    </>
  );
}

/** Edit page with Back, Show and Delete (spec 02). */
export async function ResourceEditPage({ resourceKey, params }: { resourceKey: ResourceKey; params: IdParams }) {
  const ui = getResource(resourceKey);
  const { id, record } = await recordOr404(resourceKey, params);
  return (
    <>
      <PageHeader title={`Edit ${ui.singular}`}>
        <LinkButton href={ui.path}>Back</LinkButton>
        <LinkButton href={`${ui.path}/${id}`}>Show</LinkButton>
        <DeleteButton resourceKey={resourceKey} id={id} singular={ui.singular} />
      </PageHeader>
      <ResourceForm resourceKey={resourceKey} id={id} record={record} />
    </>
  );
}
