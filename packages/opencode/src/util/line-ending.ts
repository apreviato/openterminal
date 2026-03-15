export function normalizeToLF(text: string) {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n")
}

export function normalizeToCRLF(text: string) {
  return normalizeToLF(text).replaceAll("\n", "\r\n")
}

export function hasMixedLineEndings(text: string) {
  const hasCRLF = text.includes("\r\n")
  const stripped = text.replaceAll("\r\n", "")
  const hasLF = stripped.includes("\n")
  const hasCR = stripped.includes("\r")
  return (hasCRLF && (hasLF || hasCR)) || (hasLF && hasCR)
}

export function enforceWindowsCRLF(input: { content: string; enabled: boolean; platform?: NodeJS.Platform }) {
  const platform = input.platform ?? process.platform
  if (!input.enabled || platform !== "win32") return input.content
  return normalizeToCRLF(input.content)
}
