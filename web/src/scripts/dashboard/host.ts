export type HostKind = "main" | "bot" | "analytics";

export function hostKind(): HostKind {
  if (location.hostname.startsWith("bot.")) return "bot";
  if (location.hostname.startsWith("analytics.")) return "analytics";
  return "main";
}

export function applyHost() {
  const kind = hostKind();
  document.documentElement.dataset.host = kind;
  if (kind === "bot") document.title = "OpenCash Bots";
  if (kind === "analytics") document.title = "OpenCash Analytics";
}
