import { TextAttributes, RGBA } from "@opentui/core"
import { For, type JSX } from "solid-js"
import { useTheme, tint } from "@tui/context/theme"
import { logo } from "@/cli/logo"

// Shadow markers (rendered chars in parens):
// _ = full shadow cell (space with bg=shadow)
// ^ = letter top, shadow bottom (▀ with fg=letter, bg=shadow)
// ~ = shadow top only (▀ with fg=shadow)
const MARKERS = new Set(["_", "^", "~"] as const)

export function Logo() {
  const { theme } = useTheme()

  const renderLine = (line: string, fg: RGBA, bold: boolean): JSX.Element[] => {
    const shadow = tint(theme.background, fg, 0.25)
    const attrs = bold ? TextAttributes.BOLD : undefined
    const elements: JSX.Element[] = []

    let i = 0
    while (i < line.length) {
      // Find next marker without regex (prevents accidental matches that can break words like "OPENTERM")
      let markerIndex = -1
      for (let j = i; j < line.length; j++) {
        if (MARKERS.has(line[j] as "_" | "^" | "~")) {
          markerIndex = j
          break
        }
      }

      if (markerIndex === -1) {
        elements.push(
          <text fg={fg} attributes={attrs} selectable={false}>
            {line.slice(i)}
          </text>,
        )
        break
      }

      if (markerIndex > i) {
        elements.push(
          <text fg={fg} attributes={attrs} selectable={false}>
            {line.slice(i, markerIndex)}
          </text>,
        )
      }

      const marker = line[markerIndex] as "_" | "^" | "~"
      switch (marker) {
        case "_":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              {" "}
            </text>,
          )
          break
        case "^":
          elements.push(
            <text fg={fg} bg={shadow} attributes={attrs} selectable={false}>
              {"▀"}
            </text>,
          )
          break
        case "~":
          elements.push(
            <text fg={shadow} attributes={attrs} selectable={false}>
              {"▀"}
            </text>,
          )
          break
      }

      i = markerIndex + 1
    }

    return elements
  }

  return (
    <box>
      <For each={logo.left}>
        {(line, index) => (
          <box flexDirection="row" gap={1}>
            <box flexDirection="row">{renderLine(line, theme.textMuted, false)}</box>
            <box flexDirection="row">{renderLine(logo.right[index()], theme.text, true)}</box>
          </box>
        )}
      </For>
    </box>
  )
}