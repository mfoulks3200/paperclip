import { cn } from "@/lib/utils";
import { Monitor, Tablet, Smartphone } from "lucide-react";

export const VIEWPORT_WIDTHS = {
  mobile: 375,
  tablet: 768,
  desktop: 1280,
} as const;

export type ViewportKey = keyof typeof VIEWPORT_WIDTHS;

interface MockupViewportToggleProps {
  value: ViewportKey;
  onChange: (viewport: ViewportKey) => void;
}

const viewports: { key: ViewportKey; label: string; icon: typeof Monitor }[] = [
  { key: "mobile", label: "Mobile", icon: Smartphone },
  { key: "tablet", label: "Tablet", icon: Tablet },
  { key: "desktop", label: "Desktop", icon: Monitor },
];

export function MockupViewportToggle({ value, onChange }: MockupViewportToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {viewports.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          type="button"
          title={`${label} (${VIEWPORT_WIDTHS[key]}px)`}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
            value === key
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(key)}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
