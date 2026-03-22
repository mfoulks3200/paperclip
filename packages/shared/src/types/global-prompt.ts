/**
 * A resolved global prompt ready for adapter injection.
 * Produced by the heartbeat service after calling globalPromptService.resolveForAgent().
 */
export interface ResolvedGlobalPrompt {
  key: string;
  title: string;
  body: string;
  source: "company" | "project";
}
