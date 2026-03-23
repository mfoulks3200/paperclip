import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  globalPromptsApi,
  type GlobalPrompt,
  type UpsertPromptPayload,
} from "../api/globalPrompts";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/ToastContext";
import { MarkdownEditor } from "./MarkdownEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "../lib/utils";
import { Plus, Trash2, GripVertical, FileText } from "lucide-react";

/* ── Types ── */

interface PromptsManagerProps {
  scope: "company" | "project";
  scopeId: string;
  readOnly?: boolean;
  inheritedPrompts?: GlobalPrompt[];
  inheritedLoading?: boolean;
  onPreviewRequest?: () => void;
}

/* ── Prompt Card ── */

function PromptCard({
  prompt,
  onEdit,
  onToggle,
  onDelete,
  readOnly,
  isInherited,
  isOverridden,
}: {
  prompt: GlobalPrompt;
  onEdit?: () => void;
  onToggle?: (enabled: boolean) => void;
  onDelete?: () => void;
  readOnly?: boolean;
  isInherited?: boolean;
  isOverridden?: boolean;
}) {
  const bodyPreview =
    prompt.body.length > 120 ? prompt.body.slice(0, 120) + "..." : prompt.body;

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-4 transition-colors",
        readOnly
          ? "border-border/50 bg-muted/30"
          : "border-border hover:border-border/80 cursor-pointer",
        !prompt.enabled && "opacity-60",
      )}
      onClick={readOnly ? undefined : onEdit}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          {!readOnly && (
            <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                {prompt.key}
              </code>
              {isInherited && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  Company
                </span>
              )}
              {isOverridden && (
                <span className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                  Overridden
                </span>
              )}
            </div>
            <h4 className="text-sm font-medium truncate">{prompt.title}</h4>
            {bodyPreview && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {bodyPreview}
              </p>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {onToggle && (
            <button
              className={cn(
                "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                prompt.enabled ? "bg-green-600" : "bg-muted",
              )}
              onClick={() => onToggle(!prompt.enabled)}
              title={prompt.enabled ? "Disable" : "Enable"}
            >
              <span
                className={cn(
                  "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                  prompt.enabled ? "translate-x-4.5" : "translate-x-0.5",
                )}
              />
            </button>
          )}
          {onDelete && (
            <button
              className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
              onClick={() => onDelete()}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Create/Edit Dialog (inner, keyed for state reset) ── */

function PromptDialogInner({
  onOpenChange,
  prompt,
  onSave,
  saving,
  mode,
}: {
  onOpenChange: (open: boolean) => void;
  prompt: Partial<GlobalPrompt> | null;
  onSave: (key: string, data: UpsertPromptPayload) => void;
  saving: boolean;
  mode: "create" | "edit";
}) {
  const [key, setKey] = useState(prompt?.key ?? "");
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");
  const [enabled, setEnabled] = useState(prompt?.enabled ?? true);

  return (
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Create Prompt" : "Edit Prompt"}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        {mode === "create" && (
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">
              Key
            </label>
            <Input
              value={key}
              onChange={(e) =>
                setKey(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_-]/g, "-"),
                )
              }
              placeholder="e.g. code-style"
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Unique identifier. Lowercase letters, numbers, hyphens, underscores.
            </p>
          </div>
        )}

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Code Style Guidelines"
          />
        </div>

        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Body
          </label>
          <div className="border rounded-md min-h-[200px]">
            <MarkdownEditor
              value={body}
              onChange={setBody}
              placeholder="Write prompt content in markdown..."
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Enabled</span>
          <button
            className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              enabled ? "bg-green-600" : "bg-muted",
            )}
            onClick={() => setEnabled(!enabled)}
          >
            <span
              className={cn(
                "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
                enabled ? "translate-x-4.5" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          onClick={() => onSave(mode === "create" ? key : prompt!.key!, { title, body, enabled })}
          disabled={saving || !title.trim() || (mode === "create" && !key.trim())}
        >
          {saving ? "Saving..." : mode === "create" ? "Create" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PromptDialog({
  open,
  onOpenChange,
  prompt,
  onSave,
  saving,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Partial<GlobalPrompt> | null;
  onSave: (key: string, data: UpsertPromptPayload) => void;
  saving: boolean;
  mode: "create" | "edit";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PromptDialogInner
          key={prompt?.key ?? "__create__"}
          onOpenChange={onOpenChange}
          prompt={prompt}
          onSave={onSave}
          saving={saving}
          mode={mode}
        />
      )}
    </Dialog>
  );
}

/* ── Delete Confirmation Dialog ── */

function DeleteDialog({
  open,
  onOpenChange,
  promptKey,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptKey: string;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Prompt</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">
            {promptKey}
          </code>
          ? This action cannot be undone. Any agent overrides referencing this
          prompt will also be removed.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Manager Component ── */

export function GlobalPromptsManager({
  scope,
  scopeId,
  readOnly,
  inheritedPrompts,
  inheritedLoading,
  onPreviewRequest,
}: PromptsManagerProps) {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();

  const queryKey =
    scope === "company"
      ? queryKeys.globalPrompts.company(scopeId)
      : queryKeys.globalPrompts.project(scopeId);

  const listFn =
    scope === "company"
      ? () => globalPromptsApi.listCompany(scopeId)
      : () => globalPromptsApi.listProject(scopeId);

  const { data: prompts, isLoading } = useQuery({
    queryKey,
    queryFn: listFn,
  });

  const [editingPrompt, setEditingPrompt] = useState<GlobalPrompt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<GlobalPrompt | null>(null);

  const upsertMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpsertPromptPayload }) =>
      scope === "company"
        ? globalPromptsApi.upsertCompany(scopeId, key, data)
        : globalPromptsApi.upsertProject(scopeId, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingPrompt(null);
      setCreateOpen(false);
      pushToast({ title: "Prompt saved" });
    },
    onError: (err) => {
      pushToast({ title: `Failed to save: ${err.message}`, tone: "error" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) => {
      const prompt = prompts?.find((p) => p.key === key);
      if (!prompt) throw new Error("Prompt not found");
      return scope === "company"
        ? globalPromptsApi.upsertCompany(scopeId, key, {
            title: prompt.title,
            body: prompt.body,
            enabled,
          })
        : globalPromptsApi.upsertProject(scopeId, key, {
            title: prompt.title,
            body: prompt.body,
            enabled,
          });
    },
    onMutate: async ({ key, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<GlobalPrompt[]>(queryKey);
      queryClient.setQueryData<GlobalPrompt[]>(queryKey, (old) =>
        old?.map((p) => (p.key === key ? { ...p, enabled } : p)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      pushToast({ title: "Failed to toggle prompt", tone: "error" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) =>
      scope === "company"
        ? globalPromptsApi.deleteCompany(scopeId, key)
        : globalPromptsApi.deleteProject(scopeId, key),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setDeleteTarget(null);
      pushToast({ title: "Prompt deleted" });
    },
    onError: (err) => {
      pushToast({ title: `Failed to delete: ${err.message}`, tone: "error" });
    },
  });

  const handleSave = useCallback(
    (key: string, data: UpsertPromptPayload) => {
      upsertMutation.mutate({ key, data });
    },
    [upsertMutation],
  );

  const ownKeys = new Set(prompts?.map((p) => p.key) ?? []);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg border border-border bg-muted/20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">
              {scope === "company" ? "Company Prompts" : "Project Prompts"}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {scope === "company"
                ? "Global prompts injected into all agent runs for this company."
                : "Project-specific prompts. Matching keys override company prompts."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onPreviewRequest && (
              <Button variant="outline" size="sm" onClick={onPreviewRequest}>
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                Preview
              </Button>
            )}
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New Prompt
            </Button>
          </div>
        </div>
      )}

      {prompts && prompts.length > 0 ? (
        <div className="space-y-2">
          {prompts
            .sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key))
            .map((prompt) => (
              <PromptCard
                key={prompt.id}
                prompt={prompt}
                readOnly={readOnly}
                onEdit={readOnly ? undefined : () => setEditingPrompt(prompt)}
                onToggle={
                  readOnly
                    ? undefined
                    : (enabled) =>
                        toggleMutation.mutate({ key: prompt.key, enabled })
                }
                onDelete={
                  readOnly ? undefined : () => setDeleteTarget(prompt)
                }
              />
            ))}
        </div>
      ) : (
        !readOnly && (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded-lg">
            No prompts yet. Create one to get started.
          </div>
        )
      )}

      {scope === "project" && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Inherited Company Prompts
          </h3>
          {inheritedLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="h-16 rounded-lg border border-border/50 bg-muted/10 animate-pulse"
                />
              ))}
            </div>
          ) : inheritedPrompts && inheritedPrompts.length > 0 ? (
            <div className="space-y-2">
              {inheritedPrompts.map((prompt) => (
                <PromptCard
                  key={prompt.id}
                  prompt={prompt}
                  readOnly
                  isInherited
                  isOverridden={ownKeys.has(prompt.key)}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No company-level prompts configured.
            </p>
          )}
        </div>
      )}

      <PromptDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        prompt={null}
        onSave={handleSave}
        saving={upsertMutation.isPending}
        mode="create"
      />

      <PromptDialog
        open={!!editingPrompt}
        onOpenChange={(open) => {
          if (!open) setEditingPrompt(null);
        }}
        prompt={editingPrompt}
        onSave={handleSave}
        saving={upsertMutation.isPending}
        mode="edit"
      />

      {deleteTarget && (
        <DeleteDialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
          promptKey={deleteTarget.key}
          onConfirm={() => deleteMutation.mutate(deleteTarget.key)}
          deleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}
