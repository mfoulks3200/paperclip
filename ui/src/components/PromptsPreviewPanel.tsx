import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCompany } from "../context/CompanyContext";
import { promptsApi } from "../api/prompts";
import { agentsApi } from "../api/agents";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@paperclipai/shared";

interface PromptsPreviewPanelProps {
  open: boolean;
  onClose: () => void;
}

export function PromptsPreviewPanel({ open, onClose }: PromptsPreviewPanelProps) {
  const { selectedCompanyId } = useCompany();
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const { data: agents = [] } = useQuery({
    queryKey: ["agents", selectedCompanyId],
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: open && !!selectedCompanyId,
  });

  const { data: resolved, isLoading } = useQuery({
    queryKey: ["prompts", "resolved", selectedAgentId],
    queryFn: () => promptsApi.resolveForAgent(selectedAgentId),
    enabled: !!selectedAgentId,
  });

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Resolved Prompts Preview</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4 px-4">
          <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="Select an agent" />
            </SelectTrigger>
            <SelectContent>
              {(agents as Agent[]).map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!selectedAgentId && (
            <p className="text-xs text-muted-foreground">
              Select an agent to preview resolved prompts.
            </p>
          )}

          {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}

          {resolved && (
            <div className="space-y-3">
              {resolved.resolvedPrompts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No prompts resolved for this agent.
                </p>
              )}
              {resolved.resolvedPrompts.map((p) => (
                <div key={p.key} className="rounded-lg border border-border p-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{p.title ?? p.key}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{p.key}</span>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">
                      {p.source}
                    </span>
                    {p.overriddenByProject && (
                      <span className="text-[10px] bg-blue-500/10 text-blue-600 px-1 rounded">
                        project override
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{p.body}</p>
                </div>
              ))}
              {resolved.disabledPrompts.length > 0 && (
                <div>
                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Disabled
                  </span>
                  {resolved.disabledPrompts.map((d) => (
                    <div key={d.key} className="text-xs text-muted-foreground mt-1">
                      {d.key} — {d.reason}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
