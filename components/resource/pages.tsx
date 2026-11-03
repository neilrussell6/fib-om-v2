import { notFound } from "next/navigation";
import { countByStatus, listRecords } from "@/lib/db/list-query";
import { getRecord } from "@/lib/db/records";
import { searchReferences } from "@/lib/db/reference-search";
import { isId } from "@/lib/ids";
import { first, listParamsFromUrl, newHref, queryWithout, type SearchParams } from "./list-params";
import { getResource, resourceNewLabel, resourceTitle, singularLabel } from "@/lib/resources";
import type { ResourceKey } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
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

export type { SearchParams };
type IdParams = Promise<{ id: string }>;

async function recordOr404(resourceKey: ResourceKey, params: IdParams) {
  const { id } = await params;
  if (!isId(id)) notFound();
  const record = await getRecord(resourceKey, id);
  if (!record) notFound();
  return { id, record };
}

type Row = Record<string, unknown>;
export type ListTableProps = { rows: Row[]; sort: string; dir: "asc" | "desc"; baseQuery: string; selectedId: string | null };
export type ListPanelProps = { baseQuery: string; activeStatus: string; covered: boolean };

/** Labels for the reference filters that have a value, so their comboboxes needn't fetch them (spec 09 P3). */
async function filterLabels(ui: ReturnType<typeof getResource>, filters: Record<string, string>): Promise<Record<string, string>> {
  const refs = ui.list.filters.filter((f) => f.kind === "reference" && f.ref && isId(filters[f.key]));
  const found = await Promise.all(refs.map(async (f) => [f.key, (await searchReferences(f.ref!, { id: filters[f.key] }))[0]?.label] as const));
  return Object.fromEntries(found.filter(([, label]) => label !== undefined)) as Record<string, string>;
}

/**
 * List page: heading, New, filters, table, pagination (spec 02); status tabs when
 * the resource has them, and the edit panel for `?item=<id>` (spec 07). A list with its
 * own table, panel or create dialog (Order Items) passes them in (spec 09).
 */
export async function ResourceListPage({
  resourceKey,
  searchParams,
  loadRecord,
  renderTable,
  renderPanel,
  renderCreate,
  className,
  panelAttr,
}: {
  resourceKey: ResourceKey;
  searchParams: SearchParams;
  /** Reads the `?item` record; defaults to the resource's list/detail row. */
  loadRecord?: (id: string) => Promise<Row | null>;
  renderTable?: (props: ListTableProps) => React.ReactNode;
  renderPanel?: (record: Row, props: ListPanelProps) => React.ReactNode;
  renderCreate?: (props: { baseQuery: string }) => React.ReactNode;
  /** Extra class on the page wrapper. */
  className?: string;
  /** A data attribute set on the wrapper while the panel is open. */
  panelAttr?: `data-${string}`;
}) {
  const ui = getResource(resourceKey);
  const sp = await searchParams;
  const params = listParamsFromUrl(resourceKey, sp);
  const tabs = ui.list.statusTabs;
  const statusParam = first(sp.status);
  const status = tabs && tabs.options.some((o) => o.value === statusParam) ? statusParam! : "";
  const itemParam = first(sp.item);
  const load = loadRecord ?? ((id: string) => getRecord(resourceKey, id));
  const [result, counts, record, labels] = await Promise.all([
    listRecords(resourceKey, { ...params, status: tabs ? status || undefined : undefined }),
    tabs ? countByStatus(resourceKey, params.filters) : Promise.resolve(null),
    isId(itemParam) ? load(String(itemParam)) : Promise.resolve(null),
    filterLabels(ui, params.filters),
  ]);
  const notFoundItem = isId(itemParam) && !record;
  // The panel and the row links never carry `new`; the dialog closes to the URL without `new` only (spec 08).
  const baseQuery = queryWithout(sp, "item", "new");
  const isNew = first(sp.new) === "1";
  const dialogQuery = queryWithout(sp, "new");
  const selectedId = record ? String(record.id) : null;
  const panelProps: ListPanelProps = { baseQuery, activeStatus: status, covered: isNew };

  return (
    <div
      className={cn("-mx-4 -mt-7 -mb-4 flex h-[calc(100%+2.75rem)] md:-mx-8", className)}
      {...(panelAttr && record ? { [panelAttr]: "" } : {})}
    >
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-7 md:px-8">
        <PageHeader title={resourceTitle(ui)}>
          <NewRecordLink href={newHref(ui.path, dialogQuery)} label={resourceNewLabel(ui)} />
        </PageHeader>
        {tabs && counts ? <StatusTabs counts={counts} active={status} options={tabs.options} /> : null}
        <FilterBar filters={ui.list.filters} labels={labels} />
        {renderTable ? (
          renderTable({ rows: result.rows, sort: result.sort, dir: result.dir, baseQuery, selectedId })
        ) : (
          <ResourceTable resourceKey={resourceKey} rows={result.rows} sort={result.sort} dir={result.dir} baseQuery={baseQuery} selectedId={selectedId} />
        )}
        <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
      </div>
      {record ? (
        renderPanel ? (
          renderPanel(record, panelProps)
        ) : (
          <RecordPanel key={String(record.id)} resourceKey={resourceKey} record={record} {...panelProps} />
        )
      ) : null}
      {isNew ? renderCreate ? renderCreate({ baseQuery: dialogQuery }) : <RecordCreateForm resourceKey={resourceKey} baseQuery={dialogQuery} /> : null}
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
