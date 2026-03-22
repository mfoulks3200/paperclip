import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { issuesApi, type IssueMockup, type MockupStatus } from "@/api/issues";
import { queryKeys } from "@/lib/queryKeys";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MockupPreview } from "./MockupPreview";
import { MockupVersionStrip } from "./MockupVersionStrip";
import type { ViewportKey } from "./MockupViewportToggle";

const FIDELITY_LABELS: Record<string, string> = {
  low: "Wireframe",
  medium: "Visual",
  high: "Interactive",
};

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  in_review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

const STATUS_TRANSITIONS: Record<string, MockupStatus[]> = {
  draft: ["in_review"],
  in_review: ["approved", "rejected"],
  rejected: ["draft"],
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function FidelityBadge({ level }: { level: string }) {
  return (
    <span className="inline-flex items-center rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
      {FIDELITY_LABELS[level] ?? level}
    </span>
  );
}

/** Group mockups by title, pick selected version per group */
interface MockupGroup {
  title: string;
  versions: IssueMockup[];
  selectedVersion: number;
}

interface IssueMockupsSectionProps {
  issueId: string;
}

export function IssueMockupsSection({ issueId }: IssueMockupsSectionProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState<Record<string, number>>({});

  const { data: mockups } = useQuery({
    queryKey: queryKeys.issues.mockups(issueId),
    queryFn: () => issuesApi.listMockups(issueId),
    enabled: !!issueId,
  });

  const updateStatus = useMutation({
    mutationFn: ({ mockupId, status }: { mockupId: string; status: MockupStatus }) =>
      issuesApi.updateMockupStatus(mockupId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.mockups(issueId) });
    },
  });

  const deleteMockup = useMutation({
    mutationFn: (mockupId: string) => issuesApi.deleteMockup(mockupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.issues.mockups(issueId) });
    },
  });

  const groups: MockupGroup[] = useMemo(() => {
    if (!mockups?.length) return [];
    const byTitle = new Map<string, IssueMockup[]>();
    for (const m of mockups) {
      const existing = byTitle.get(m.title);
      if (existing) existing.push(m);
      else byTitle.set(m.title, [m]);
    }
    return Array.from(byTitle.entries()).map(([title, versions]) => {
      // versions come sorted by version DESC from API
      const sorted = [...versions].sort((a, b) => a.version - b.version);
      const selected = selectedVersions[title] ?? sorted[sorted.length - 1].version;
      return { title, versions: sorted, selectedVersion: selected };
    });
  }, [mockups, selectedVersions]);

  if (!mockups?.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Mockups
        <span className="text-xs text-muted-foreground font-normal">({mockups.length})</span>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 space-y-4">
        {groups.map((group) => {
          const mockup = group.versions.find((v) => v.version === group.selectedVersion)
            ?? group.versions[group.versions.length - 1];
          const transitions = STATUS_TRANSITIONS[mockup.status] ?? [];

          return (
            <div key={group.title} className="rounded-lg border border-border p-3 space-y-3">
              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{group.title}</span>
                  <FidelityBadge level={mockup.fidelityLevel} />
                  <StatusBadge status={mockup.status} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {transitions.map((nextStatus) => (
                    <button
                      key={nextStatus}
                      type="button"
                      className="rounded px-2 py-0.5 text-[11px] font-medium border border-border hover:bg-accent transition-colors"
                      disabled={updateStatus.isPending}
                      onClick={() => updateStatus.mutate({ mockupId: mockup.id, status: nextStatus })}
                    >
                      {nextStatus.replace(/_/g, " ")}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive p-0.5"
                    disabled={deleteMockup.isPending}
                    onClick={() => deleteMockup.mutate(mockup.id)}
                    title="Delete mockup"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Version strip */}
              <MockupVersionStrip
                versions={group.versions.map((v) => v.version)}
                selected={group.selectedVersion}
                onChange={(version) =>
                  setSelectedVersions((prev) => ({ ...prev, [group.title]: version }))
                }
              />

              {/* Notes */}
              {mockup.notes && (
                <p className="text-xs text-muted-foreground">{mockup.notes}</p>
              )}

              {/* Preview */}
              <MockupPreview
                previewPath={mockup.previewPath}
                title={`${group.title} v${mockup.version}`}
                defaultViewport={(mockup.viewport as ViewportKey) || "desktop"}
              />

              {/* Meta */}
              <p className="text-[11px] text-muted-foreground">
                v{mockup.version} · {(mockup.byteSize / 1024).toFixed(1)} KB
              </p>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
}
