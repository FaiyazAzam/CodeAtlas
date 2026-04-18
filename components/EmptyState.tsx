export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid min-h-[420px] place-items-center rounded-lg border border-line bg-ink/70 p-8 text-center">
      <div className="max-w-md">
        <h3 className="text-xl font-semibold text-paper">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-paper/60">{body}</p>
      </div>
    </div>
  );
}
