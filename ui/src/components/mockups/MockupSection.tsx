import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockupsApi, type Mockup } from "../../api/mockups";
import { queryKeys } from "../../lib/queryKeys";
import { cn } from "../../lib/utils";
import { MockupPreview } from "./MockupPreview";
import { MockupVersionStrip } from "./MockupVersionStrip";
import { MockupViewportToggle, type ViewportKey } from "./MockupViewportToggle";
import { ChevronDown, ChevronRight, Image } from "lucide-react";

const FIDELITY_LABELS: Record<string, { label: string; className: string }> = {
  low: { label: "Wireframe", className: "bg-muted text-muted-foreground" },
  medium: { label: "Visual", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  high: { label: "Interactive", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  wireframe: { label: "Wireframe", className: "bg-muted text-muted-foreground" },
  visual: { label: "Visual", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  interactive: { label: "Interactive", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  in_review: { label: "In Review", className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

/** Group mockups by title, returning version-sorted groups */
function groupByTitle(mockups: Mockup[]) {
  const groups = new Map<string, Mockup[]>();
  for (const m of mockups) {
    const existing = groups.get(m.title) ?? [];
    existing.push(m);
    groups.set(m.title, existing);
  }
  // Sort each group by version ascending
  for (const [, items] of groups) {
    items.sort((a, b) => a.version - b.version);
  }
  return groups;
}

function FidelityBadge({ level }: { level: string }) {
  const info = FIDELITY_LABELS[level] ?? FIDELITY_LABELS.medium;
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", info.className)}>
      {info.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] ?? STATUS_LABELS.draft;
  return (
    <span className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium", info.className)}>
      {info.label}
    </span>
  );
}

function MockupGroup({ title, mockups }: { title: string; mockups: Mockup[] }) {
  const versions = mockups.map((m) => m.version);
  const [activeVersion, setActiveVersion] = useState(() => versions[versions.length - 1]);
  const [viewport, setViewport] = useState<ViewportKey>(
    () => (mockups[0]?.viewport as ViewportKey) || "desktop",
  );
  const [expanded, setExpanded] = useState(false);

  const activeMockup = mockups.find((m) => m.version === activeVersion) ?? mockups[mockups.length - 1];

  return (
    <div className="space-y-2">
      {/* Title bar with controls */}
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <FidelityBadge level={activeMockup.fidelityLevel} />
        <StatusBadge status={activeMockup.status} />
        <div className="flex-1" />
        <MockupVersionStrip
          versions={versions}
          activeVersion={activeVersion}
          onChange={setActiveVersion}
        />
        <MockupViewportToggle value={viewport} onChange={setViewport} />
      </div>

      {/* Notes */}
      {activeMockup.notes && (
        <p className="text-xs text-muted-foreground">{activeMockup.notes}</p>
      )}

      {/* Preview */}
      <MockupPreview
        previewPath={activeMockup.previewPath}
        viewport={viewport}
        expanded={expanded}
        onToggleExpand={() => setExpanded((e) => !e)}
      />
    </div>
  );
}

export function MockupSection({ issueId }: { issueId: string }) {
  const [open, setOpen] = useState(true);

  const { data: mockups = [], isLoading } = useQuery({
    queryKey: queryKeys.issues.mockups(issueId),
    queryFn: () => mockupsApi.list(issueId),
  });

  const groups = useMemo(() => groupByTitle(mockups), [mockups]);

  if (!isLoading && mockups.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground/80 transition-colors"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Image className="h-4 w-4" />
        Mockups
        <span className="text-xs text-muted-foreground font-normal">({mockups.length})</span>
      </button>

      {open && (
        <div className="space-y-6 pl-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Loading mockups...
            </div>
          ) : (
            Array.from(groups.entries()).map(([title, items]) => (
              <MockupGroup key={title} title={title} mockups={items} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
