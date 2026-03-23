import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { promptsApi, type GlobalPrompt, type UpsertPromptPayload } from "../api/prompts";
import { useToast } from "../context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, Plus, Check, X } from "lucide-react";

function PromptEditor({
  prompt,
  onSave,
  onCancel,
}: {
  prompt?: GlobalPrompt;
  onSave: (key: string, data: UpsertPromptPayload) => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState(prompt?.key ?? "");
  const [title, setTitle] = useState(prompt?.title ?? "");
  const [body, setBody] = useState(prompt?.body ?? "");

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      {!prompt && (
        <Input
          placeholder="Prompt key (e.g. security)"
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
          className="text-xs"
        />
      )}
      <Input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="text-xs"
      />
      <Textarea
        placeholder="Prompt body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        className="text-xs"
      />
      <div className="flex gap-1 justify-end">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
        <Button
          size="sm"
          disabled={!body.trim() || (!prompt && !key.trim())}
          onClick={() => onSave(prompt?.key ?? key, { title: title || null, body })}
        >
          <Check className="h-3 w-3 mr-1" /> Save
        </Button>
      </div>
    </div>
  );
}

function PromptRow({
  prompt,
  onEdit,
  onDelete,
}: {
  prompt: GlobalPrompt;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-border p-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{prompt.title ?? prompt.key}</span>
          <span className="text-[10px] text-muted-foreground font-mono">{prompt.key}</span>
          {!prompt.enabled && (
            <span className="text-[10px] bg-muted text-muted-foreground px-1 rounded">disabled</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{prompt.body}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function CompanyPromptsList({ companyId }: { companyId: string }) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts", "company", companyId],
    queryFn: () => promptsApi.listCompany(companyId),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpsertPromptPayload }) =>
      promptsApi.upsertCompany(companyId, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", "company", companyId] });
      setEditingKey(null);
      setAdding(false);
    },
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => promptsApi.deleteCompany(companyId, key),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prompts", "company", companyId] }),
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading prompts…</div>;

  return (
    <div className="space-y-2 w-full">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Prompts
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {adding && (
        <PromptEditor
          onSave={(key, data) => upsertMutation.mutate({ key, data })}
          onCancel={() => setAdding(false)}
        />
      )}
      {prompts.map((p) =>
        editingKey === p.key ? (
          <PromptEditor
            key={p.key}
            prompt={p}
            onSave={(key, data) => upsertMutation.mutate({ key, data })}
            onCancel={() => setEditingKey(null)}
          />
        ) : (
          <PromptRow
            key={p.key}
            prompt={p}
            onEdit={() => setEditingKey(p.key)}
            onDelete={() => deleteMutation.mutate(p.key)}
          />
        ),
      )}
      {prompts.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">No prompts configured yet.</p>
      )}
    </div>
  );
}

export function ProjectPromptsList({
  projectId,
  companyId,
}: {
  projectId: string;
  companyId: string;
}) {
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const { data: prompts = [], isLoading } = useQuery({
    queryKey: ["prompts", "project", projectId],
    queryFn: () => promptsApi.listProject(projectId),
  });

  const upsertMutation = useMutation({
    mutationFn: ({ key, data }: { key: string; data: UpsertPromptPayload }) =>
      promptsApi.upsertProject(projectId, key, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prompts", "project", projectId] });
      setEditingKey(null);
      setAdding(false);
    },
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => promptsApi.deleteProject(projectId, key),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["prompts", "project", projectId] }),
    onError: (err) => pushToast({ tone: "error", title: "Error", body: String(err) }),
  });

  if (isLoading) return <div className="text-xs text-muted-foreground">Loading prompts…</div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Project Prompts
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {adding && (
        <PromptEditor
          onSave={(key, data) => upsertMutation.mutate({ key, data })}
          onCancel={() => setAdding(false)}
        />
      )}
      {prompts.map((p) =>
        editingKey === p.key ? (
          <PromptEditor
            key={p.key}
            prompt={p}
            onSave={(key, data) => upsertMutation.mutate({ key, data })}
            onCancel={() => setEditingKey(null)}
          />
        ) : (
          <PromptRow
            key={p.key}
            prompt={p}
            onEdit={() => setEditingKey(p.key)}
            onDelete={() => deleteMutation.mutate(p.key)}
          />
        ),
      )}
      {prompts.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">
          No project-level prompt overrides. Company prompts apply by default.
        </p>
      )}
    </div>
  );
}
