const baseUrl = "https://inference-api.openserv.ai/v1/chat/completions";
const defaultModel = process.env.SERV_MODEL ?? "gpt-5.4-mini";

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
  const apiKey = process.env.SERV_API_KEY;
  if (!apiKey) {
    throw new Error("SERV_API_KEY is not set");
  }

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: defaultModel,
      messages: request.messages,
      tools: request.tools,
      tool_choice: request.toolChoice ?? "auto",
      temperature: request.temperature ?? 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SERV Reasoning request failed: ${response.status} ${body}`);
  }

  return response.json() as Promise<ServChatResponse>;
}
