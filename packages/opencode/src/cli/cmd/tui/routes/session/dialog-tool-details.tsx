import { Show, createMemo } from "solid-js"
import { Dialog } from "@tui/ui/dialog"
import { useTheme } from "@tui/context/theme"
import type { ToolPart } from "@opencode-ai/sdk/v2"
import { formatDuration } from "@/util/format"

export function DialogToolDetails(props: { part: ToolPart; onClose: () => void }) {
  const { theme } = useTheme()

  const toolName = createMemo(() => props.part.tool)
  const status = createMemo(() => props.part.state.status)

  const error = createMemo(() => {
    return props.part.state.status === "error" ? props.part.state.error : undefined
  })

  const duration = createMemo(() => {
    const state = props.part.state
    if (state.status === "pending") return undefined
    const start = state.time.start
    const end = state.status === "completed" || state.status === "error" ? state.time.end : undefined
    if (!start || !end) return undefined
    return end - start
  })

  const inputJson = createMemo(() => {
    if (props.part.state.status === "pending") return props.part.state.raw
    try {
      return JSON.stringify(props.part.state.input, null, 2)
    } catch {
      return String(props.part.state.input)
    }
  })

  const outputJson = createMemo(() => {
    if (props.part.state.status !== "completed") return undefined
    try {
      return JSON.stringify(props.part.state.output, null, 2)
    } catch {
      return String(props.part.state.output)
    }
  })

  const statusColor = createMemo(() => {
    switch (status()) {
      case "completed":
        return theme.success
      case "error":
        return theme.error
      case "running":
        return theme.warning
      default:
        return theme.textMuted
    }
  })

  const statusText = createMemo(() => {
    switch (status()) {
      case "completed":
        return "✓ Complete"
      case "error":
        return "✗ Error"
      case "running":
        return "⟳ Running"
      default:
        return "○ Pending"
    }
  })

  return (
    <Dialog size="large" onClose={props.onClose}>
      <box gap={1} paddingLeft={2} paddingRight={2} paddingBottom={2}>
        {/* Header */}
        <text fg={theme.text} attributes={1}>
          Tool Execution Details
        </text>

        {/* Tool Name */}
        <box gap={0}>
          <text fg={theme.textMuted}>Tool:</text>
          <text fg={theme.text} paddingLeft={1}>
            {toolName()}
          </text>
        </box>

        {/* Status */}
        <box gap={0}>
          <text fg={theme.textMuted}>Status:</text>
          <text fg={statusColor()} paddingLeft={1}>
            {statusText()}
          </text>
        </box>

        {/* Duration */}
        <Show when={duration()}>
          <box gap={0}>
            <text fg={theme.textMuted}>Duration:</text>
            <text fg={theme.text} paddingLeft={1}>
              {formatDuration(duration()!)}
            </text>
          </box>
        </Show>

        {/* Call ID */}
        <Show when={props.part.callID}>
          <box gap={0}>
            <text fg={theme.textMuted}>Call ID:</text>
            <text fg={theme.text} paddingLeft={1}>
              {props.part.callID}
            </text>
          </box>
        </Show>

        {/* Input Parameters */}
        <box gap={1} marginTop={1}>
          <text fg={theme.text} attributes={1}>
            Input Parameters
          </text>
          <scroll-box maxHeight={10} backgroundColor={theme.background} paddingLeft={1} paddingRight={1}>
            <text fg={theme.text}>{inputJson()}</text>
          </scroll-box>
        </box>

        {/* Output */}
        <Show when={outputJson()}>
          <box gap={1} marginTop={1}>
            <text fg={theme.text} attributes={1}>
              Output
            </text>
            <scroll-box maxHeight={10} backgroundColor={theme.background} paddingLeft={1} paddingRight={1}>
              <text fg={theme.text}>{outputJson()}</text>
            </scroll-box>
          </box>
        </Show>

        {/* Error */}
        <Show when={error()}>
          <box gap={1} marginTop={1}>
            <text fg={theme.error} attributes={1}>
              Error
            </text>
            <scroll-box maxHeight={6} backgroundColor={theme.background} paddingLeft={1} paddingRight={1}>
              <text fg={theme.error}>{error()}</text>
            </scroll-box>
          </box>
        </Show>

        {/* Footer */}
        <text fg={theme.textMuted} marginTop={1}>
          Press Esc to close
        </text>
      </box>
    </Dialog>
  )
}
