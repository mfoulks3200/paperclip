import { useState } from "react";
import { Expand, ExternalLink, Shrink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewportKey } from "./MockupViewportToggle";
import { MockupViewportToggle, VIEWPORT_WIDTHS } from "./MockupViewportToggle";

interface MockupPreviewProps {
  previewPath: string;
  title: string;
  defaultViewport?: ViewportKey;
}

export function MockupPreview({ previewPath, title, defaultViewport = "desktop" }: MockupPreviewProps) {
  const [viewport, setViewport] = useState<ViewportKey>(defaultViewport);
  const [expanded, setExpanded] = useState(false);
  const iframeWidth = VIEWPORT_WIDTHS[viewport];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <MockupViewportToggle value={viewport} onChange={setViewport} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground p-0.5"
            onClick={() => setExpanded((prev) => !prev)}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </button>
          <a
            href={previewPath}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground hover:text-foreground p-0.5"
            title="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
      <div
        className={cn(
          "overflow-auto rounded border border-border bg-white",
          expanded ? "h-[80vh]" : "h-[400px]",
        )}
      >
        <iframe
          src={previewPath}
          title={title}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          style={{ width: `${iframeWidth}px`, minHeight: "100%" }}
          className="border-0"
        />
      </div>
    </div>
  );
}
