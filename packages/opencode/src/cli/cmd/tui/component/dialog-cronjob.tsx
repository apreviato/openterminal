import { createMemo } from "solid-js"
import { DialogPrompt } from "@tui/ui/dialog-prompt"
import { DialogSelect } from "@tui/ui/dialog-select"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useLocal } from "@tui/context/local"
import { useSync } from "@tui/context/sync"
import { Cronjob } from "@/cronjob"

// ─── Shared types / data ─────────────────────────────────────────────────────

interface WizardProps {
  onDone: () => void
}

type PermissionRule = Cronjob.PermissionRule

const SCHEDULE_PRESETS = [
  { title: "Every 15 minutes", value: "*/15 * * * *", description: "*/15 * * * *" },
  { title: "Every hour", value: "0 * * * *", description: "0 * * * *" },
  { title: "Daily at 9am", value: "0 9 * * *", description: "0 9 * * *" },
  { title: "Weekdays at 9am", value: "0 9 * * 1-5", description: "0 9 * * 1-5" },
  { title: "Every Monday", value: "0 9 * * 1", description: "0 9 * * 1" },
  { title: "Monthly (1st)", value: "0 9 1 * *", description: "0 9 1 * *" },
  { title: "Custom…", value: "__custom__", description: "Enter a cron expression manually" },
]

const PERMISSION_PRESETS = [
  { title: "Ask for each tool", value: "ask-all", description: "Agent asks permission before each action (default)" },
  { title: "Allow all tools", value: "allow-all", description: "Read, write, shell and web — no restrictions" },
  { title: "Read-only", value: "read-only", description: "Allow read/search; deny bash, writes and web fetch" },
  { title: "No shell", value: "no-shell", description: "Allow read, search and web; deny bash and writes" },
  { title: "Custom…", value: "__custom__", description: "Configure allow / deny / ask per tool" },
]

const PRESET_RULES: Record<string, PermissionRule[]> = {
  "ask-all": [],
  "allow-all": [
    { permission: "bash", pattern: "*", action: "allow" },
    { permission: "edit", pattern: "*", action: "allow" },
    { permission: "read", pattern: "*", action: "allow" },
    { permission: "glob", pattern: "*", action: "allow" },
    { permission: "grep", pattern: "*", action: "allow" },
    { permission: "webfetch", pattern: "*", action: "allow" },
  ],
  "read-only": [
    { permission: "read", pattern: "*", action: "allow" },
    { permission: "glob", pattern: "*", action: "allow" },
    { permission: "grep", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "*", action: "deny" },
    { permission: "webfetch", pattern: "*", action: "deny" },
  ],
  "no-shell": [
    { permission: "read", pattern: "*", action: "allow" },
    { permission: "glob", pattern: "*", action: "allow" },
    { permission: "grep", pattern: "*", action: "allow" },
    { permission: "webfetch", pattern: "*", action: "allow" },
    { permission: "bash", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "*", action: "deny" },
  ],
}

const CUSTOM_TOOLS = [
  { key: "bash", label: "Shell commands (bash)" },
  { key: "edit", label: "File writes (edit / write)" },
  { key: "webfetch", label: "Web fetch" },
  { key: "read", label: "File reads" },
]

const TOOL_ACTIONS = [
  { title: "Ask (default)", value: "ask", description: "Agent requests permission before use" },
  { title: "Allow", value: "allow", description: "Always allow without prompting" },
  { title: "Deny", value: "deny", description: "Never allow; agent cannot use this tool" },
]

function validateName(value: string): string | undefined {
  if (!value.trim()) return "Name is required"
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(value.trim()))
    return "Use lowercase letters, digits and hyphens only (must start and end with a letter or digit)"
}

// ─── Step 1: Name ─────────────────────────────────────────────────────────────

export function DialogCronjob(props: WizardProps) {
  const dialog = useDialog()
  const toast = useToast()

  return (
    <DialogPrompt
      title="Cronjob name"
      placeholder="e.g. daily-standup"
      description={() => <text>Lowercase letters, digits, hyphens. Must be unique.</text>}
      onConfirm={(value) => {
        const err = validateName(value)
        if (err) {
          toast.show({ message: err, variant: "error" })
          return
        }
        const name = value.trim()
        dialog.replace(() => <ScheduleStep name={name} onDone={props.onDone} />)
      }}
      onCancel={() => dialog.clear()}
    />
  )
}

// ─── Step 2: Schedule ─────────────────────────────────────────────────────────

function ScheduleStep(props: { name: string; onDone: () => void }) {
  const dialog = useDialog()

  return (
    <DialogSelect
      title="Schedule"
      options={SCHEDULE_PRESETS}
      onSelect={(option) => {
        const val = option.value as string
        if (val === "__custom__") {
          dialog.replace(() => <CustomScheduleStep name={props.name} onDone={props.onDone} />)
        } else {
          dialog.replace(() => <AgentStep name={props.name} cron={val} onDone={props.onDone} />)
        }
      }}
    />
  )
}

// ─── Step 2b: Custom cron expression ─────────────────────────────────────────

function CustomScheduleStep(props: { name: string; onDone: () => void }) {
  const dialog = useDialog()
  const toast = useToast()

  return (
    <DialogPrompt
      title="Cron expression"
      placeholder="e.g. 0 9 * * 1-5"
      description={() => <text>Standard 5-field cron: minute hour day month weekday</text>}
      onConfirm={(value) => {
        const expr = value.trim()
        if (!expr) {
          toast.show({ message: "Cron expression is required", variant: "error" })
          return
        }
        if (expr.split(/\s+/).length !== 5) {
          toast.show({ message: "Must have exactly 5 fields (minute hour day month weekday)", variant: "error" })
          return
        }
        dialog.replace(() => <AgentStep name={props.name} cron={expr} onDone={props.onDone} />)
      }}
      onCancel={() => {
        dialog.replace(() => <ScheduleStep name={props.name} onDone={props.onDone} />)
      }}
    />
  )
}

// ─── Step 3: Agent ────────────────────────────────────────────────────────────

function AgentStep(props: { name: string; cron: string; onDone: () => void }) {
  const dialog = useDialog()
  const local = useLocal()

  const options = createMemo(() => {
    const agentList = local.agent.list()
    return [
      { title: "(default)", value: "", description: "Use the configured default agent" },
      ...agentList
        .filter((a) => a.mode !== "subagent")
        .map((a) => ({
          title: a.name,
          value: a.name,
          description: a.description ?? "",
        })),
    ]
  })

  return (
    <DialogSelect
      title="Agent"
      options={options()}
      onSelect={(option) => {
        const agent = option.value as string
        dialog.replace(() => <ModelStep name={props.name} cron={props.cron} agent={agent} onDone={props.onDone} />)
      }}
    />
  )
}

// ─── Step 4: Model ────────────────────────────────────────────────────────────

function ModelStep(props: { name: string; cron: string; agent: string; onDone: () => void }) {
  const dialog = useDialog()
  const sync = useSync()

  const options = createMemo(() => {
    const defaultFromConfig = typeof sync.data.config.model === "string" ? sync.data.config.model : ""
    const defaultFromProvider = (() => {
      for (const provider of sync.data.provider) {
        const modelID = sync.data.provider_default[provider.id]
        if (modelID) return `${provider.id}/${modelID}`
      }
      return ""
    })()
    const defaultModelID = defaultFromConfig || defaultFromProvider

    const list: Array<{ title: string; value: string; description?: string }> = [
      {
        title: "(default)",
        value: "",
        description: defaultModelID ? `Use default (${defaultModelID})` : "Use configured default model",
      },
    ]

    for (const provider of [...sync.data.provider].sort((a, b) => a.id.localeCompare(b.id))) {
      for (const [modelID, model] of Object.entries(provider.models).sort(([a], [b]) => a.localeCompare(b))) {
        list.push({
          title: `${provider.id}/${modelID}`,
          value: `${provider.id}/${modelID}`,
          description: model.name && model.name !== modelID ? model.name : undefined,
        })
      }
    }

    return list
  })

  return (
    <DialogSelect
      title="Model"
      options={options()}
      onSelect={(option) => {
        const model = option.value as string
        dialog.replace(() => (
          <PromptStep name={props.name} cron={props.cron} agent={props.agent} model={model} onDone={props.onDone} />
        ))
      }}
    />
  )
}

// ─── Step 5: Prompt ───────────────────────────────────────────────────────────

function PromptStep(props: { name: string; cron: string; agent: string; model: string; onDone: () => void }) {
  const dialog = useDialog()
  const toast = useToast()

  return (
    <DialogPrompt
      title="Prompt"
      placeholder="What should the agent do when this job runs?"
      description={() => <text>This prompt is sent to the agent on each scheduled run.</text>}
      onConfirm={(value) => {
        if (!value.trim()) {
          toast.show({ message: "Prompt is required", variant: "error" })
          return
        }
        dialog.replace(() => (
          <PermissionsStep
            name={props.name}
            cron={props.cron}
            agent={props.agent}
            model={props.model}
            prompt={value.trim()}
            onDone={props.onDone}
          />
        ))
      }}
      onCancel={() => {
        dialog.replace(() => (
          <ModelStep name={props.name} cron={props.cron} agent={props.agent} onDone={props.onDone} />
        ))
      }}
    />
  )
}

// ─── Step 6: Permissions ──────────────────────────────────────────────────────

interface JobParams {
  name: string
  cron: string
  agent: string
  model: string
  prompt: string
  onDone: () => void
}

function PermissionsStep(props: JobParams) {
  const dialog = useDialog()
  const toast = useToast()

  async function save(permissions: PermissionRule[]) {
    const job: Cronjob.Info = {
      name: props.name,
      cron: props.cron,
      active: true,
      agent: props.agent,
      model: props.model,
      prompt: props.prompt,
      permissions,
    }
    try {
      await Cronjob.save(job)
      toast.show({ message: `Cronjob "${job.name}" created`, variant: "info" })
      props.onDone()
    } catch (err) {
      if (err instanceof Cronjob.CronNotSupportedError) {
        toast.show({ message: err.message, variant: "error" })
      } else {
        toast.show({
          message: err instanceof Error ? err.message : "Failed to create cronjob",
          variant: "error",
        })
      }
      props.onDone()
    }
  }

  return (
    <DialogSelect
      title="Permissions"
      options={PERMISSION_PRESETS}
      onSelect={(option) => {
        const val = option.value as string
        if (val === "__custom__") {
          dialog.replace(() => <CustomPermStep {...props} toolIndex={0} accumulated={[]} onSave={save} />)
        } else {
          void save(PRESET_RULES[val] ?? [])
        }
      }}
    />
  )
}

// ─── Step 6b: Custom per-tool permissions ─────────────────────────────────────

function CustomPermStep(
  props: JobParams & {
    toolIndex: number
    accumulated: PermissionRule[]
    onSave: (perms: PermissionRule[]) => Promise<void>
  },
) {
  const dialog = useDialog()
  const tool = CUSTOM_TOOLS[props.toolIndex]!

  return (
    <DialogSelect
      title={tool.label}
      options={TOOL_ACTIONS}
      onSelect={(option) => {
        const action = option.value as "allow" | "deny" | "ask"
        const rule: PermissionRule | undefined =
          action === "ask" ? undefined : { permission: tool.key, pattern: "*", action }
        const next = rule ? [...props.accumulated, rule] : [...props.accumulated]

        if (props.toolIndex + 1 < CUSTOM_TOOLS.length) {
          dialog.replace(() => <CustomPermStep {...props} toolIndex={props.toolIndex + 1} accumulated={next} />)
        } else {
          void props.onSave(next)
        }
      }}
    />
  )
}
