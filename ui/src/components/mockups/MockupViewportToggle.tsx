import { cn } from "../../lib/utils";
import { Monitor, Smartphone, Tablet, MonitorUp } from "lucide-react";

const VIEWPORTS = [
  { key: "mobile", label: "Mobile", width: 375, icon: Smartphone },
  { key: "tablet", label: "Tablet", width: 768, icon: Tablet },
  { key: "desktop", label: "Desktop", width: 1280, icon: Monitor },
  { key: "wide", label: "Wide", width: 1536, icon: MonitorUp },
] as const;

export type ViewportKey = (typeof VIEWPORTS)[number]["key"];

export function viewportWidth(key: string): number {
  return VIEWPORTS.find((v) => v.key === key)?.width ?? 1280;
}

export function MockupViewportToggle({
  value,
  onChange,
}: {
  value: ViewportKey;
  onChange: (v: ViewportKey) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
      {VIEWPORTS.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onChange(key)}
          className={cn(
            "inline-flex items-center justify-center rounded-sm px-2 py-1 text-xs transition-colors",
            value === key
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
