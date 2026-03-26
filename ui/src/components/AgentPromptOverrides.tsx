import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { promptsApi, type GlobalPrompt } from "../api/prompts";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

interface AgentPromptOverridesProps {
  agentId: string;
  companyId: string;
}

export function AgentPromptOverrides({ agentId, companyId }: AgentPromptOverridesProps) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: overrides = [], isLoading: loadingOverrides } = useQuery({
    queryKey: ["prompts", "overrides", agentId],
    queryFn: () => promptsApi.listAgentOverrides(agentId),
  });

  const { data: companyPrompts = [] } = useQuery({
    queryKey: ["prompts", "company", companyId],
    queryFn: () => promptsApi.listCompany(companyId),
  });

  const overrideMap = new Map(overrides.map((o) => [o.globalPromptId, o]));

  const toggleMutation = useMutation({
    mutationFn: ({ globalPromptId, disabled }: { globalPromptId: string; disabled: boolean }) =>
      promptsApi.setAgentOverride(agentId, globalPromptId, disabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prompts", "overrides", agentId] }),
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (globalPromptId: string) =>
      promptsApi.deleteAgentOverride(agentId, globalPromptId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prompts", "overrides", agentId] }),
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  if (loadingOverrides) {
    return <div className="text-xs text-muted-foreground">Loading overrides…</div>;
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Prompt Overrides
      </span>
      {companyPrompts.map((p: GlobalPrompt) => {
        const override = overrideMap.get(p.id);
        const isDisabled = override?.disabled ?? false;
        return (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border border-border p-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{p.title ?? p.key}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{p.key}</span>
              {isDisabled && (
                <span className="text-[10px] bg-red-500/10 text-red-600 px-1 rounded">
                  disabled
                </span>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  toggleMutation.mutate({ globalPromptId: p.id, disabled: !isDisabled })
                }
              >
                {isDisabled ? (
                  <ToggleLeft className="h-3 w-3" />
                ) : (
                  <ToggleRight className="h-3 w-3" />
                )}
              </Button>
              {override && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMutation.mutate(p.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
      {companyPrompts.length === 0 && (
        <p className="text-xs text-muted-foreground">No company prompts to override.</p>
      )}
    </div>
  );
}
