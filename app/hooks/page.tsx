import { listHooks, listCreatorOptions, parseScope } from "@/lib/queries";
import { HooksTable } from "@/components/hooks-table";
import { SELF_LABEL } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function HooksPage({
  searchParams,
}: {
  searchParams: Promise<{ creator?: string | string[] }>;
}) {
  const sp = await searchParams;
  const scope = parseScope(sp);
  const rows = listHooks(scope);

  const isSelf = scope.kind === "self";
  // Look up the pretty display label so the insight panel can say
  // "What opens crush for @handle" instead of the raw handle.
  const creatorOptions = listCreatorOptions();
  const current = creatorOptions.find(
    (c) =>
      c.value ===
      (isSelf
        ? "self"
        : scope.kind === "handle" && scope.handle.startsWith("@")
          ? scope.handle
          : `@${scope.kind === "handle" ? scope.handle : ""}`),
  );
  const scopeLabel =
    current?.label ??
    (scope.kind === "handle" ? scope.handle : SELF_LABEL);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Hooks</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          The exact opening words of every video, ranked against each other.
          Top performers glow green; the panel up top shows which opener
          archetypes beat {isSelf ? "your" : "their"} own baseline.
        </p>
      </header>
      <HooksTable rows={rows} isSelf={isSelf} scopeLabel={scopeLabel} />
    </div>
  );
}
