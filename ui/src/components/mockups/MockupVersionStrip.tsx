import { cn } from "@/lib/utils";

interface MockupVersionStripProps {
  versions: number[];
  selected: number;
  onChange: (version: number) => void;
}

export function MockupVersionStrip({ versions, selected, onChange }: MockupVersionStripProps) {
  if (versions.length <= 1) return null;

  return (
    <div className="flex items-center gap-1">
      {versions.map((v) => (
        <button
          key={v}
          type="button"
          className={cn(
            "rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
            v === selected
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => onChange(v)}
        >
          v{v}
        </button>
      ))}
    </div>
  );
}
