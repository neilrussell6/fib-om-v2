/**
 * Only internal paths are honoured as a post-login destination: the value must
 * start with a single "/" (not "//" or "/\", which browsers treat as another host).
 */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
