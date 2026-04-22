import { cn } from "../../lib/utils";

export function MockupVersionStrip({
  versions,
  activeVersion,
  onChange,
}: {
  versions: number[];
  activeVersion: number;
  onChange: (v: number) => void;
}) {
  if (versions.length <= 1) return null;

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
      {versions.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={cn(
            "inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs font-medium tabular-nums transition-colors",
            activeVersion === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          v{v}
        </button>
      ))}
    </div>
  );
}
