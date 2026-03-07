import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"

type ConfigItem = {
  key: string
  label: string
  description: string
  value: string | boolean | number | undefined
  type: "string" | "boolean" | "number" | "model"
  category: string
}

interface DialogConfigEditProps {
  item: ConfigItem
  onDone: (newValue: string | boolean | number | undefined) => void
}

export function DialogConfigEdit(props: DialogConfigEditProps) {
  const dialog = useDialog()
  const toast = useToast()

  // For boolean types, show a select dialog
  if (props.item.type === "boolean") {
    return (
      <DialogSelect
        title={`Edit ${props.item.label}`}
        options={[
          { title: "Enabled", value: "true", description: "Enable this setting" },
          { title: "Disabled", value: "false", description: "Disable this setting" },
        ]}
        onSelect={(option) => {
          const newValue = option.value === "true"
          props.onDone(newValue)
        }}
      />
    )
  }

  // For string/number/model types, show a prompt dialog
  return (
    <DialogPrompt
      title={`Edit ${props.item.label}`}
      placeholder={props.item.description}
      value={String(props.item.value || "")}
      description={() => <text>{props.item.description}</text>}
      onConfirm={(value) => {
        const trimmed = value.trim()

        if (!trimmed) {
          toast.show({ message: "Value cannot be empty", variant: "error" })
          return
        }

        if (props.item.type === "number") {
          const num = Number(trimmed)
          if (isNaN(num)) {
            toast.show({ message: "Value must be a number", variant: "error" })
            return
          }
          props.onDone(num)
          return
        }

        props.onDone(trimmed)
      }}
      onCancel={() => dialog.clear()}
    />
  )
}
