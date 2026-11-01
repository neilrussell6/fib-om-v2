/** Page heading plus its toolbar (spec 06 typography); the toolbar never prints. */
export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.01em] whitespace-nowrap text-foreground">{title}</h1>
      {children ? <div className="flex flex-wrap items-center gap-2 print:hidden">{children}</div> : null}
    </div>
  );
}
