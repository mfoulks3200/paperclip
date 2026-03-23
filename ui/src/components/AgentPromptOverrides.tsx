import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { globalPromptsApi, type ResolvedPrompt, type AgentPromptOverride } from "../api/globalPrompts";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Eye, FileText } from "lucide-react";
import type { Agent } from "@paperclipai/shared";

interface AgentPromptOverridesTabProps {
  agent: Agent;
  companyId: string;
}

export function AgentPromptOverridesTab({ agent, companyId }: AgentPromptOverridesTabProps) {
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: resolvedPrompts, isLoading: resolvedLoading } = useQuery({
    queryKey: queryKeys.globalPrompts.resolved(agent.id),
    queryFn: () => globalPromptsApi.resolvedPrompts(agent.id),
  });

  const { data: overrides } = useQuery({
    queryKey: queryKeys.globalPrompts.overrides(agent.id),
    queryFn: () => globalPromptsApi.listOverrides(agent.id),
  });

  const toggleOverride = useMutation({
    mutationFn: async ({ promptId, disabled }: { promptId: string; disabled: boolean }) => {
      if (disabled) {
        return globalPromptsApi.upsertOverride(agent.id, promptId, { disabled: true });
      }
      return globalPromptsApi.deleteOverride(agent.id, promptId);
    },
    onMutate: async ({ promptId, disabled }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.globalPrompts.resolved(agent.id) });
      const previous = queryClient.getQueryData<ResolvedPrompt[]>(
        queryKeys.globalPrompts.resolved(agent.id),
      );
      queryClient.setQueryData<ResolvedPrompt[]>(
        queryKeys.globalPrompts.resolved(agent.id),
        (old) =>
          old?.map((p) =>
            p.promptId === promptId
              ? { ...p, disabledByOverride: disabled, enabled: !disabled }
              : p,
          ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.globalPrompts.resolved(agent.id), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalPrompts.resolved(agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.globalPrompts.overrides(agent.id) });
    },
  });

  if (resolvedLoading) {
    return (
      <div className="max-w-3xl space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-border bg-muted/20 animate-pulse" />
        ))}
      </div>
    );
  }

  const enabledPrompts = resolvedPrompts?.filter((p) => !p.disabledByOverride) ?? [];
  const disabledPrompts = resolvedPrompts?.filter((p) => p.disabledByOverride) ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Prompt Overrides</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Toggle prompts on or off for this agent. Disabled prompts will not be injected into runs.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          <Eye className="h-3.5 w-3.5 mr-1.5" />
          Preview
        </Button>
      </div>

      {resolvedPrompts && resolvedPrompts.length > 0 ? (
        <div className="space-y-2">
          {resolvedPrompts.map((prompt) => (
            <div
              key={prompt.promptId}
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors",
                prompt.disabledByOverride
                  ? "border-border/50 bg-muted/30 opacity-60"
                  : "border-border",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {prompt.key}
                  </code>
                  <span
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      prompt.source === "company"
                        ? "text-muted-foreground bg-muted"
                        : "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30",
                    )}
                  >
                    {prompt.source}
                  </span>
                </div>
                <p className="text-sm font-medium truncate">{prompt.title}</p>
              </div>

              <button
                className={cn(
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
                  !prompt.disabledByOverride ? "bg-green-600" : "bg-muted",
                )}
                onClick={() =>
                  toggleOverride.mutate({
                    promptId: prompt.promptId,
                    disabled: !prompt.disabledByOverride,
                  })
                }
                title={prompt.disabledByOverride ? "Enable" : "Disable"}
              >
                <span
                  className={cn(
                    "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                    !prompt.disabledByOverride ? "translate-x-4.5" : "translate-x-0.5",
                  )}
                />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
          No prompts configured for this company/project.
        </div>
      )}

      {/* Preview Panel */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Resolved Prompts Preview</SheetTitle>
          </SheetHeader>
          <p className="text-xs text-muted-foreground mt-2 mb-4">
            These are the prompts that would be injected into this agent's runs.
          </p>

          {enabledPrompts.length > 0 && (
            <div className="space-y-3 mb-6">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Active ({enabledPrompts.length})
              </h4>
              {enabledPrompts.map((prompt) => (
                <div key={prompt.promptId} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{prompt.title}</span>
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono ml-auto">
                      {prompt.key}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-6">
                    {prompt.body}
                  </p>
                </div>
              ))}
            </div>
          )}

          {disabledPrompts.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Disabled ({disabledPrompts.length})
              </h4>
              {disabledPrompts.map((prompt) => (
                <div
                  key={prompt.promptId}
                  className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-1 opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium">{prompt.title}</span>
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded font-mono ml-auto">
                      {prompt.key}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Disabled by agent override
                  </p>
                </div>
              ))}
            </div>
          )}

          {resolvedPrompts?.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No prompts configured.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
