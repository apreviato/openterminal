import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { useSDK } from "@tui/context/sdk"
import { useSync } from "@tui/context/sync"
import { useTheme } from "@tui/context/theme"
import { useDialog } from "@tui/ui/dialog"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { Cronjob } from "@/cronjob"
import { PermissionNext } from "@/permission/next"

export function DialogCronjobRun(props: { job: Cronjob.Info; onDone: () => void }) {
  const sdk = useSDK()
  const sync = useSync()
  const { theme } = useTheme()
  const dialog = useDialog()

  const [sessionID, setSessionID] = createSignal<string | null>(null)
  const [statusLabel, setStatusLabel] = createSignal("starting…")
  const [finished, setFinished] = createSignal(false)
  const [errorMsg, setErrorMsg] = createSignal<string | null>(null)

  useKeyboard((evt) => {
    if (!finished() && !errorMsg()) return
    if (evt.name === "escape" || evt.name === "return" || evt.name === "q") {
      dialog.clear()
      props.onDone()
      evt.preventDefault()
    }
  })

  // Reactive messages / parts from sync store
  const messages = createMemo(() => {
    const sid = sessionID()
    if (!sid) return []
    return sync.data.message[sid] ?? []
  })

  const allParts = createMemo(() =>
    messages().flatMap((msg) => sync.data.part[msg.id] ?? []),
  )

  const textParts = createMemo(() =>
    allParts().filter((p: any) => p.type === "text" && p.text?.trim()),
  )

  const toolParts = createMemo(() =>
    allParts().filter((p: any) => p.type === "tool" && p.state?.status !== "pending"),
  )

  // Watch session_status for idle
  const sessionStatus = createMemo(() => {
    const sid = sessionID()
    if (!sid) return null
    return sync.data.session_status[sid] ?? null
  })

  // Detect idle (finished)
  createMemo(() => {
    const s = sessionStatus()
    if (s && (s as any).type === "idle" && sessionID()) {
      if (!finished()) {
        setFinished(true)
        setStatusLabel("done")
      }
    }
  })

  onMount(async () => {
    try {
      const jobAgent = props.job.agent || undefined
      const rules: PermissionNext.Ruleset = [
        { permission: "question",   action: "deny", pattern: "*" },
        { permission: "plan_enter", action: "deny", pattern: "*" },
        { permission: "plan_exit",  action: "deny", pattern: "*" },
        ...(props.job.permissions ?? []),
      ]

      const sessionResult = await sdk.client.session.create({
        title: `cronjob: ${props.job.name}`,
        permission: rules,
      })
      const sid = sessionResult.data?.id
      if (!sid) {
        setErrorMsg("Failed to create session")
        setFinished(true)
        return
      }

      setSessionID(sid)
      setStatusLabel("running…")

      // Auto-reject permission requests
      const unsub = sdk.event.listen((e: any) => {
        const evt = e.details
        if (evt.type === "permission.asked" && evt.properties.sessionID === sid) {
          void sdk.client.permission.reply({ requestID: evt.properties.id, reply: "reject" })
        }
        if (evt.type === "session.error" && evt.properties.sessionID === sid) {
          const msg = String(evt.properties.error?.name ?? "Unknown error")
          setErrorMsg(msg)
          setStatusLabel("error")
          setFinished(true)
        }
      })
      onCleanup(unsub)

      await sdk.client.session.prompt({
        sessionID: sid,
        agent: jobAgent,
        parts: [{ type: "text", text: props.job.prompt }],
      })
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatusLabel("error")
      setFinished(true)
    }
  })

  return (
    <box flexDirection="column" gap={1} paddingLeft={4} paddingRight={4} paddingTop={1} paddingBottom={1}>
      {/* Header */}
      <box flexDirection="row" justifyContent="space-between" flexShrink={0}>
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          {props.job.name}
        </text>
        <text fg={finished() ? (errorMsg() ? theme.error : theme.success) : theme.textMuted}>
          {statusLabel()}
        </text>
      </box>

      {/* Tool calls */}
      <Show when={toolParts().length > 0}>
        <box flexDirection="column" flexShrink={0}>
          <For each={toolParts()}>
            {(part: any) => {
              const inputStr = JSON.stringify(part.state?.input ?? {})
              const statusIcon = part.state?.status === "error" ? "✗" : "→"
              return (
                <text fg={part.state?.status === "error" ? theme.error : theme.textMuted}>
                  {statusIcon}{" "}
                  <span style={{ fg: theme.text }}>[{part.tool}]</span>{" "}
                  {inputStr.length > 60 ? inputStr.slice(0, 60) + "…" : inputStr}
                </text>
              )
            }}
          </For>
        </box>
      </Show>

      {/* Text output (last assistant message) */}
      <Show when={textParts().length > 0}>
        <box flexDirection="column" flexShrink={0}>
          <For each={textParts().slice(-3)}>
            {(part: any) => {
              const preview = part.text.trim().slice(0, 300)
              const firstLine = preview.split("\n")[0]
              return <text fg={theme.textMuted}>{firstLine}</text>
            }}
          </For>
        </box>
      </Show>

      {/* Error */}
      <Show when={errorMsg()}>
        <text fg={theme.error}>{errorMsg()}</text>
      </Show>

      {/* Footer hint */}
      <Show when={finished() || errorMsg()}>
        <text fg={theme.textMuted}>
          press <span style={{ fg: theme.text }}>esc</span> to close
        </text>
      </Show>
    </box>
  )
}
