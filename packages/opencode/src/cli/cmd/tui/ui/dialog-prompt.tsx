import { TextareaRenderable, TextAttributes } from "@opentui/core"
import { useTheme } from "../context/theme"
import { useDialog, type DialogContext } from "./dialog"
import { onMount, Show, type JSX } from "solid-js"
import { useKeyboard } from "@opentui/solid"

export type DialogPromptProps = {
  title: string
  description?: () => JSX.Element
  placeholder?: string
  value?: string
  multiline?: boolean
  onConfirm?: (value: string) => void
  onCancel?: () => void
}

export function DialogPrompt(props: DialogPromptProps) {
  const dialog = useDialog()
  const { theme } = useTheme()
  let textarea: TextareaRenderable

  useKeyboard((evt) => {
    if (!props.multiline && evt.name === "return") {
      props.onConfirm?.(textarea.plainText)
    }
    if (props.multiline && evt.ctrl && evt.name === "return") {
      props.onConfirm?.(textarea.plainText)
    }
  })

  onMount(() => {
    dialog.setSize("medium")
    setTimeout(() => {
      if (!textarea || textarea.isDestroyed) return
      textarea.focus()
    }, 1)
    textarea.gotoLineEnd()
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {props.title}
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <box gap={1}>
        {props.description}
        <textarea
          onSubmit={() => {
            props.onConfirm?.(textarea.plainText)
          }}
          height={props.multiline ? 8 : 3}
          keyBindings={
            props.multiline
              ? [{ name: "return", ctrl: true, action: "submit" }]
              : [{ name: "return", action: "submit" }]
          }
          ref={(val: TextareaRenderable) => (textarea = val)}
          initialValue={props.value}
          placeholder={props.placeholder ?? "Enter text"}
          textColor={theme.text}
          focusedTextColor={theme.text}
          cursorColor={theme.text}
        />
      </box>
      <box paddingBottom={1} gap={1} flexDirection="row">
        <text fg={theme.text}>
          <Show
            when={props.multiline}
            fallback={
              <>
                enter <span style={{ fg: theme.textMuted }}>submit</span>
              </>
            }
          >
            ctrl+enter <span style={{ fg: theme.textMuted }}>submit</span>
          </Show>
        </text>
      </box>
    </box>
  )
}

DialogPrompt.show = (dialog: DialogContext, title: string, options?: Omit<DialogPromptProps, "title">) => {
  return new Promise<string | null>((resolve) => {
    dialog.replace(
      () => (
        <DialogPrompt title={title} {...options} onConfirm={(value) => resolve(value)} onCancel={() => resolve(null)} />
      ),
      () => resolve(null),
    )
  })
}
