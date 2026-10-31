import { notFound } from "next/navigation";
import { listRecords } from "@/lib/db/list-query";
import { getRecord } from "@/lib/db/records";
import { getResource } from "@/lib/resources";
import type { ResourceKey } from "@/lib/resources/types";
import { DataTable } from "./data-table";
import { DeleteButton } from "./delete-button";
import { FilterBar } from "./filter-bar";
import { formatValue } from "./format";
import { LinkButton } from "./link-button";
import { PageHeader } from "./page-header";
import { Pagination } from "./pagination";
import { PrintButton } from "./print-button";
import { ResourceForm } from "./resource-form";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

async function recordOr404(resourceKey: ResourceKey, params: IdParams) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const record = await getRecord(resourceKey, id);
  if (!record) notFound();
  return { id, record };
}

/** List page: heading, Create, filters, table, pagination (spec 02). */
export async function ResourceListPage({ resourceKey, searchParams }: { resourceKey: ResourceKey; searchParams: SearchParams }) {
  const ui = getResource(resourceKey);
  const sp = await searchParams;
  // Only the resource's own filter keys and column sort keys are read from the URL.
  const filters = Object.fromEntries(ui.list.filters.map((f) => [f.key, first(sp[f.key])]).filter(([, v]) => v));
  const sortParam = first(sp.sort);
  const sort = ui.list.columns.some((c) => c.key === sortParam) ? sortParam : undefined;
  const dirParam = first(sp.dir);
  const dir = sort ? (dirParam === "desc" ? "desc" : "asc") : undefined;
  const result = await listRecords(resourceKey, {
    filters,
    sort,
    dir,
    page: Number(first(sp.page)) || 1,
    pageSize: Number(first(sp.pageSize)) || undefined,
  });

  return (
    <>
      <PageHeader title={ui.plural}>
        <LinkButton href={`${ui.path}/new`} variant="default">
          Create
        </LinkButton>
      </PageHeader>
      <FilterBar filters={ui.list.filters} />
      <DataTable columns={ui.list.columns} rows={result.rows} path={ui.path} sort={result.sort} dir={result.dir} />
      <Pagination total={result.total} page={result.page} pageSize={result.pageSize} />
    </>
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
              <dt className="font-medium text-secondary">{f.label}</dt>
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
