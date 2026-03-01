import { For, Show, createResource, createSignal } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useRoute } from "@tui/context/route"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { Toast } from "@tui/ui/toast"
import { Cronjob } from "@/cronjob"
import { DialogCronjob } from "@tui/component/dialog-cronjob"

export function Cronjobs() {
  const { theme } = useTheme()
  const route = useRoute()
  const dialog = useDialog()
  const toast = useToast()

  const [selected, setSelected] = createSignal(0)
  const [revision, setRevision] = createSignal(0)

  const [jobs] = createResource(revision, () => Cronjob.list())

  function reload() {
    setRevision((n) => n + 1)
  }

  function clamp(n: number, len: number) {
    return Math.max(0, Math.min(n, len - 1))
  }

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return

    const list = jobs() ?? []
    const sel = selected()

    if (evt.name === "escape") {
      route.navigate({ type: "home" })
      evt.preventDefault()
      return
    }

    if (evt.name === "up" || (evt.ctrl && evt.name === "p") || evt.name === "k") {
      setSelected(clamp(sel - 1, list.length))
      evt.preventDefault()
      return
    }

    if (evt.name === "down" || (evt.ctrl && evt.name === "n") || evt.name === "j") {
      setSelected(clamp(sel + 1, list.length))
      evt.preventDefault()
      return
    }

    // c = create new cronjob
    if (evt.name === "c" && !evt.ctrl) {
      dialog.replace(() => (
        <DialogCronjob
          onDone={() => {
            dialog.clear()
            reload()
          }}
        />
      ))
      evt.preventDefault()
      return
    }

    // t = toggle active/inactive
    if (evt.name === "t" && !evt.ctrl && list.length > 0) {
      const job = list[clamp(sel, list.length)]
      if (!job) return
      Cronjob.toggle(job.name)
        .then(() => {
          const next = !job.active
          toast.show({
            message: `"${job.name}" ${next ? "enabled" : "disabled"}`,
            variant: "info",
          })
          reload()
        })
        .catch((err) => {
          toast.show({
            message: err instanceof Error ? err.message : "Failed to toggle",
            variant: "error",
          })
        })
      evt.preventDefault()
      return
    }

    // d = delete selected
    if (evt.name === "d" && !evt.ctrl && list.length > 0) {
      const job = list[clamp(sel, list.length)]
      if (!job) return
      Cronjob.remove(job.name)
        .then(() => {
          toast.show({ message: `"${job.name}" deleted`, variant: "info" })
          setSelected(clamp(sel, list.length - 1))
          reload()
        })
        .catch((err) => {
          toast.show({
            message: err instanceof Error ? err.message : "Failed to delete",
            variant: "error",
          })
        })
      evt.preventDefault()
      return
    }
  })

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <box flexDirection="row" flexShrink={0} marginBottom={1} gap={2} alignItems="center">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          Cronjobs
        </text>
        <text fg={theme.textMuted}>scheduled AI tasks</text>
      </box>

      {/* ── List ───────────────────────────────────────────────────── */}
      <box flexGrow={1} flexDirection="column" overflow="hidden">
        <Show when={(jobs() ?? []).length === 0}>
          <box flexGrow={1} alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>No cronjobs yet.</text>
            <text fg={theme.textMuted}>
              Press <span style={{ fg: theme.text }}>c</span> to create one.
            </text>
          </box>
        </Show>

        <Show when={(jobs() ?? []).length > 0}>
          {/* Column headers */}
          <box
            flexDirection="row"
            flexShrink={0}
            marginBottom={1}
            gap={2}
            paddingBottom={1}
            border={["bottom"]}
            borderColor={theme.border}
          >
            <text fg={theme.textMuted} width={2}>{" "}</text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={22}>name</text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={18}>schedule</text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={16}>agent</text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>status</text>
          </box>

          <For each={jobs() ?? []}>
            {(job, index) => {
              const isSelected = () => index() === selected()
              return (
                <box
                  flexDirection="row"
                  flexShrink={0}
                  gap={2}
                  backgroundColor={isSelected() ? theme.backgroundPanel : undefined}
                  paddingLeft={0}
                  paddingRight={1}
                >
                  <text fg={job.active ? theme.success : theme.textMuted} width={2}>
                    {job.active ? "●" : "○"}
                  </text>
                  <text
                    fg={theme.text}
                    attributes={isSelected() ? TextAttributes.BOLD : 0}
                    width={22}
                  >
                    {job.name}
                  </text>
                  <text fg={theme.textMuted} width={18}>
                    {job.cron}
                  </text>
                  <text fg={theme.textMuted} width={16}>
                    {job.agent || "(default)"}
                  </text>
                  <text fg={job.active ? theme.success : theme.textMuted}>
                    {job.active ? "active" : "inactive"}
                  </text>
                </box>
              )
            }}
          </For>
        </Show>
      </box>

      {/* ── Footer / keybinds ──────────────────────────────────────── */}
      <box
        flexDirection="row"
        flexShrink={0}
        marginTop={1}
        paddingTop={1}
        gap={3}
        border={["top"]}
        borderColor={theme.border}
      >
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>c</span> create
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>t</span> toggle
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>d</span> delete
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>↑↓</span> navigate
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>esc</span> back
        </text>
      </box>

      <Toast />
    </box>
  )
}
