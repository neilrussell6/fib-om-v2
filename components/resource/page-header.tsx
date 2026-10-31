/** Page heading plus its toolbar; the toolbar never prints. */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold text-secondary">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-2 print:hidden">{children}</div> : null}
    </div>
  );
}
