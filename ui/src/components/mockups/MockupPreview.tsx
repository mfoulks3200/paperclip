import { useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { viewportWidth, type ViewportKey } from "./MockupViewportToggle";
import { Expand, Shrink, ExternalLink } from "lucide-react";

const COMPACT_HEIGHT = 400;

export function MockupPreview({
  previewPath,
  viewport,
  expanded: controlledExpanded,
  onToggleExpand,
}: {
  previewPath: string;
  viewport: ViewportKey;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const [localExpanded, setLocalExpanded] = useState(false);
  const expanded = controlledExpanded ?? localExpanded;
  const toggleExpand = onToggleExpand ?? (() => setLocalExpanded((e) => !e));

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const width = viewportWidth(viewport);
  const previewUrl = `/api${previewPath}`;

  return (
    <div className="relative overflow-hidden rounded-md border border-border bg-muted/20">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-1 border-b border-border px-2 py-1">
        <button
          type="button"
          onClick={toggleExpand}
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <Shrink className="h-3 w-3" /> : <Expand className="h-3 w-3" />}
        </button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Open in new tab"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {/* Iframe container */}
      <div
        className="mx-auto overflow-auto bg-white"
        style={{
          maxWidth: "100%",
          height: expanded ? "80vh" : `${COMPACT_HEIGHT}px`,
        }}
      >
        <iframe
          ref={iframeRef}
          src={previewUrl}
          sandbox="allow-scripts"
          referrerPolicy="no-referrer"
          title="Mockup preview"
          className="border-0"
          style={{
            width: `${width}px`,
            height: "100%",
            maxWidth: "100%",
          }}
        />
      </div>
    </div>
  );
}
