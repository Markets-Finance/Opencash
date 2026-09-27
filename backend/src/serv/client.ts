// Testing switch: with $1 left in the SERV account, every real SERV call
// costs from a near-empty balance. Set OPENAI_API_KEY and calls route to
// OpenAI directly instead — same request shape (tool_choice still forces
// propose_bin_action, so the reasoning flow works identically), just without
// SERV's serv_shadow_agent/serv_prompt_guard actually validating anything.
// Switch back by unsetting OPENAI_API_KEY once there's real SERV budget.
const useOpenAI = Boolean(process.env.OPENAI_API_KEY);

const servBaseUrl = "https://inference-api.openserv.ai/v1/chat/completions";
const openaiBaseUrl = "https://api.openai.com/v1/chat/completions";
const baseUrl = useOpenAI ? openaiBaseUrl : servBaseUrl;

const defaultServModel = process.env.SERV_MODEL ?? "gpt-5.4-mini";
// Not verified against OpenAI's current catalog (knowledge cutoff predates
// this session) — override with OPENAI_MODEL if this has been deprecated.
const defaultOpenaiModel = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

// Multipath is a SERV-specific model-ID suffix; meaningless (and would
// break the request) against real OpenAI, so it's gated to the SERV path.
const model = useOpenAI
  ? defaultOpenaiModel
  : process.env.SERV_MULTIPATH === "true"
    ? `${defaultServModel}-serv-multipath`
    : defaultServModel;

// "off" omits the field, for models that reject it. SERV-specific knob;
// left off entirely for the OpenAI path rather than guessing compatibility.
const reasoningEffort = process.env.SERV_REASONING_EFFORT ?? "low";

export type ServMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type ServTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ServToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type ServChatResponse = {
  id: string;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: ServToolCall[];
    };
    finish_reason: string;
  }[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
};

export type ServChatRequest = {
  messages: ServMessage[];
  tools?: ServTool[];
  toolChoice?: "auto" | { type: "function"; function: { name: string } };
  temperature?: number;
};

export async function servChatCompletion(
  request: ServChatRequest,
): Promise<ServChatResponse> {
  const apiKey = useOpenAI ? process.env.OPENAI_API_KEY : process.env.SERV_API_KEY;
  if (!apiKey) {
    throw new Error(useOpenAI ? "OPENAI_API_KEY is not set" : "SERV_API_KEY is not set");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      ...(!useOpenAI && reasoningEffort !== "off" ? { reasoning_effort: reasoningEffort } : {}),
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.toolChoice ?? "auto",
      temperature: request.temperature ?? 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `${useOpenAI ? "OpenAI" : "SERV Reasoning"} request failed: ${response.status} ${body}`,
    );
  }

  return response.json() as Promise<ServChatResponse>;
}
