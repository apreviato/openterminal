import { For, Show, createResource, createSignal, createMemo } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useRoute } from "@tui/context/route"
import { useDialog } from "@tui/ui/dialog"
import { useToast } from "@tui/ui/toast"
import { useKeyboard } from "@opentui/solid"
import { TextAttributes } from "@opentui/core"
import { Toast } from "@tui/ui/toast"
import { useSDK } from "@tui/context/sdk"
import { DialogConfigEdit } from "@tui/component/dialog-config-edit"

type ConfigItem = {
  key: string
  label: string
  description: string
  value: string | string[] | boolean | number | undefined
  type: "string" | "string_array" | "boolean" | "number" | "model"
  category:
    | "General"
    | "Model"
    | "Agent"
    | "Server"
    | "Providers"
    | "Permissions"
    | "Compaction"
    | "Watcher"
    | "Experimental"
    | "Enterprise"
}

// Define all possible configurations with their metadata
const CONFIG_DEFINITIONS: Omit<ConfigItem, "value">[] = [
  // ═══════════════════════════════════════════════════════════════
  // General
  // ═══════════════════════════════════════════════════════════════
  {
    key: "username",
    label: "Username",
    description: "Custom username to display in conversations",
    type: "string",
    category: "General",
  },
  {
    key: "logLevel",
    label: "Log Level",
    description: "Logging verbosity (debug, info, warn, error)",
    type: "string",
    category: "General",
  },
  {
    key: "share",
    label: "Share Mode",
    description: "Control sharing behavior (manual, auto, disabled)",
    type: "string",
    category: "General",
  },
  {
    key: "autoupdate",
    label: "Auto Update",
    description: "Automatically update to latest version (true, false, notify)",
    type: "string",
    category: "General",
  },
  {
    key: "snapshot",
    label: "Enable Snapshots",
    description: "Enable session snapshots",
    type: "boolean",
    category: "General",
  },
  {
    key: "enabled_providers",
    label: "Enabled Providers",
    description: "Only these providers will be enabled (comma-separated)",
    type: "string_array",
    category: "General",
  },
  {
    key: "disabled_providers",
    label: "Disabled Providers",
    description: "Providers to disable (comma-separated)",
    type: "string_array",
    category: "General",
  },

  // ═══════════════════════════════════════════════════════════════
  // Model
  // ═══════════════════════════════════════════════════════════════
  {
    key: "model",
    label: "Default Model",
    description: "Default model to use (provider/model format)",
    type: "model",
    category: "Model",
  },
  {
    key: "small_model",
    label: "Small Model",
    description: "Small model for tasks like title generation",
    type: "model",
    category: "Model",
  },

  // ═══════════════════════════════════════════════════════════════
  // Agent
  // ═══════════════════════════════════════════════════════════════
  {
    key: "default_agent",
    label: "Default Agent",
    description: "Default agent to use when none is specified",
    type: "string",
    category: "Agent",
  },

  // ═══════════════════════════════════════════════════════════════
  // Server
  // ═══════════════════════════════════════════════════════════════
  {
    key: "server.port",
    label: "Server Port",
    description: "Port to listen on for server mode",
    type: "number",
    category: "Server",
  },
  {
    key: "server.hostname",
    label: "Server Hostname",
    description: "Hostname to listen on",
    type: "string",
    category: "Server",
  },
  {
    key: "server.mdns",
    label: "Enable mDNS",
    description: "Enable mDNS service discovery",
    type: "boolean",
    category: "Server",
  },
  {
    key: "server.mdnsDomain",
    label: "mDNS Domain",
    description: "Custom domain name for mDNS service",
    type: "string",
    category: "Server",
  },
  {
    key: "server.cors",
    label: "CORS Allowed Origins",
    description: "Additional domains allowed for CORS (comma-separated)",
    type: "string_array",
    category: "Server",
  },

  // ═══════════════════════════════════════════════════════════════
  // Permissions
  // ═══════════════════════════════════════════════════════════════
  {
    key: "permission.read",
    label: "Read Permission",
    description: "Permission for file read operations (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.edit",
    label: "Edit Permission",
    description: "Permission for file edit operations (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.bash",
    label: "Bash Permission",
    description: "Permission for shell commands (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.glob",
    label: "Glob Permission",
    description: "Permission for file globbing (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.grep",
    label: "Grep Permission",
    description: "Permission for content search (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.webfetch",
    label: "Web Fetch Permission",
    description: "Permission for web fetching (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.task",
    label: "Task Permission",
    description: "Permission for task delegation (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.question",
    label: "Question Permission",
    description: "Permission for asking questions (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.todowrite",
    label: "Todo Write Permission",
    description: "Permission for writing todos (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.cronjob_list",
    label: "Cronjob List Permission",
    description: "Permission for listing cronjobs (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.cronjob_create",
    label: "Cronjob Create Permission",
    description: "Permission for creating cronjobs (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.cronjob_delete",
    label: "Cronjob Delete Permission",
    description: "Permission for deleting cronjobs (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.cronjob_run",
    label: "Cronjob Run Permission",
    description: "Permission for running cronjobs (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.external_directory",
    label: "External Directory Permission",
    description: "Permission for paths outside project/worktree (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.todoread",
    label: "Todo Read Permission",
    description: "Permission for reading todos (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.websearch",
    label: "Web Search Permission",
    description: "Permission for web search (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.codesearch",
    label: "Code Search Permission",
    description: "Permission for code search (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.lsp",
    label: "LSP Permission",
    description: "Permission for LSP tool operations (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.skill",
    label: "Skill Permission",
    description: "Permission for loading skills (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },
  {
    key: "permission.doom_loop",
    label: "Doom Loop Permission",
    description: "Permission guard for repeated tool loops (ask, allow, deny)",
    type: "string",
    category: "Permissions",
  },

  // ═══════════════════════════════════════════════════════════════
  // Compaction
  // ═══════════════════════════════════════════════════════════════
  {
    key: "compaction.auto",
    label: "Auto Compaction",
    description: "Enable automatic compaction when context is full",
    type: "boolean",
    category: "Compaction",
  },
  {
    key: "compaction.prune",
    label: "Prune Old Outputs",
    description: "Enable pruning of old tool outputs",
    type: "boolean",
    category: "Compaction",
  },
  {
    key: "compaction.threshold",
    label: "Compaction Threshold",
    description: "Context usage fraction to trigger compaction (0.1-1.0)",
    type: "number",
    category: "Compaction",
  },
  {
    key: "compaction.reserved",
    label: "Reserved Tokens",
    description: "Token buffer for compaction to avoid overflow",
    type: "number",
    category: "Compaction",
  },
  {
    key: "compaction.prune_minimum",
    label: "Prune Minimum",
    description: "Minimum tokens that must be prunable before prune runs",
    type: "number",
    category: "Compaction",
  },
  {
    key: "compaction.prune_protect",
    label: "Prune Protection",
    description: "Tokens of recent tool output to keep when pruning",
    type: "number",
    category: "Compaction",
  },

  // ═══════════════════════════════════════════════════════════════
  // Experimental
  // ═══════════════════════════════════════════════════════════════
  {
    key: "experimental.batch_tool",
    label: "Batch Tool",
    description: "Enable the experimental batch tool",
    type: "boolean",
    category: "Experimental",
  },
  {
    key: "experimental.disable_paste_summary",
    label: "Disable Paste Summary",
    description: "Disable automatic summarization of pasted content",
    type: "boolean",
    category: "Experimental",
  },
  {
    key: "experimental.continue_loop_on_deny",
    label: "Continue on Deny",
    description: "Continue agent loop when a tool call is denied",
    type: "boolean",
    category: "Experimental",
  },

  {
    key: "experimental.enable_exa_search",
    label: "Enable EXA Search",
    description: "Enable EXA Search integration for code/web search capabilities",
    type: "boolean",
    category: "Experimental",
  },
  {
    key: "experimental.mcp_timeout",
    label: "MCP Timeout",
    description: "Timeout in milliseconds for MCP requests",
    type: "number",
    category: "Experimental",
  },
  {
    key: "experimental.windows_crlf_only",
    label: "Windows CRLF Only",
    description: "On Windows, save edited/written files using CRLF only",
    type: "boolean",
    category: "Experimental",
  },
  {
    key: "experimental.primary_tools",
    label: "Primary Tools",
    description: "Tools available only to primary agents (comma-separated)",
    type: "string_array",
    category: "Experimental",
  },

  // ═══════════════════════════════════════════════════════════════
  // Enterprise
  // ═══════════════════════════════════════════════════════════════
  {
    key: "enterprise.url",
    label: "Enterprise URL",
    description: "Enterprise server URL",
    type: "string",
    category: "Enterprise",
  },
]

export function Config() {
  const { theme } = useTheme()
  const route = useRoute()
  const dialog = useDialog()
  const toast = useToast()
  const sdk = useSDK()

  const [selected, setSelected] = createSignal(0)
  const [revision, setRevision] = createSignal(0)
  const [categoryFilter, setCategoryFilter] = createSignal<string | null>(null)

  const [config] = createResource(revision, async () => {
    const result = await sdk.client.global.config.get()
    return result.data
  })

  function reload() {
    setRevision((n) => n + 1)
  }

  function clamp(n: number, len: number) {
    return Math.max(0, Math.min(n, len - 1))
  }

  // Helper function to get nested value from config
  function getNestedValue(obj: any, path: string): any {
    const keys = path.split(".")
    let current = obj
    for (const key of keys) {
      if (current === undefined || current === null) return undefined
      current = current[key]
    }
    return current
  }

  const allConfigItems = (): ConfigItem[] => {
    const cfg = config()
    if (!cfg) return []

    // Map all definitions to items with their current values
    return CONFIG_DEFINITIONS.map((def) => {
      let value = getNestedValue(cfg, def.key)

      // Special handling for autoupdate which can be boolean or "notify"
      if (def.key === "autoupdate" && typeof value === "boolean") {
        value = String(value)
      }

      return {
        ...def,
        value,
      }
    })
  }

  const configItems = createMemo(() => {
    const items = allConfigItems()
    const filter = categoryFilter()
    if (!filter) return items
    return items.filter((item) => item.category === filter)
  })

  const categories = createMemo((): ConfigItem["category"][] => {
    const items = allConfigItems()
    const cats = new Set(items.map((item) => item.category))
    return Array.from(cats).sort() as ConfigItem["category"][]
  })

  useKeyboard((evt) => {
    if (dialog.stack.length > 0) return

    const list = configItems()
    const sel = selected()

    if (evt.name === "escape") {
      if (categoryFilter()) {
        setCategoryFilter(null)
        setSelected(0)
        evt.preventDefault()
        return
      }
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

    // f = filter by category
    if (evt.name === "f" && !evt.ctrl && list.length > 0) {
      const cats = categories()
      if (cats.length === 0) return

      const currentFilter = categoryFilter()
      const currentIndex = currentFilter ? cats.findIndex((c) => c === currentFilter) : -1
      const nextIndex = (currentIndex + 1) % (cats.length + 1)

      if (nextIndex === cats.length) {
        setCategoryFilter(null)
      } else {
        setCategoryFilter(cats[nextIndex] || null)
      }
      setSelected(0)
      evt.preventDefault()
      return
    }

    // e = edit selected config
    if ((evt.name === "e" || evt.name === "return") && !evt.ctrl && list.length > 0) {
      const item = list[clamp(sel, list.length)]
      if (!item) return

      dialog.replace(() => (
        <DialogConfigEdit
          item={item}
          onDone={(newValue) => {
            if (newValue !== undefined) {
              // Handle nested keys like "compaction.auto"
              const keys = item.key.split(".")
              const configUpdate: any = {}

              if (keys.length === 1) {
                configUpdate[keys[0]] = newValue
              } else if (keys.length === 2) {
                configUpdate[keys[0]] = { [keys[1]]: newValue }
              } else if (keys.length === 3) {
                configUpdate[keys[0]] = { [keys[1]]: { [keys[2]]: newValue } }
              }

              sdk.client.global.config
                .update({
                  config: configUpdate,
                })
                .then(() => {
                  toast.show({
                    message: `"${item.label}" updated`,
                    variant: "info",
                  })
                  reload()
                })
                .catch((err) => {
                  toast.show({
                    message: err instanceof Error ? err.message : "Failed to update",
                    variant: "error",
                  })
                })
            }
            dialog.clear()
          }}
        />
      ))
      evt.preventDefault()
      return
    }

    // r = reset to default (remove from config)
    if (evt.name === "r" && !evt.ctrl && list.length > 0) {
      const item = list[clamp(sel, list.length)]
      if (!item) return

      // Handle nested keys like "compaction.auto"
      const keys = item.key.split(".")
      const configUpdate: any = {}

      if (keys.length === 1) {
        configUpdate[keys[0]] = undefined
      } else if (keys.length === 2) {
        configUpdate[keys[0]] = { [keys[1]]: undefined }
      } else if (keys.length === 3) {
        configUpdate[keys[0]] = { [keys[1]]: { [keys[2]]: undefined } }
      }

      sdk.client.global.config
        .update({
          config: configUpdate,
        })
        .then(() => {
          toast.show({ message: `"${item.label}" reset to default`, variant: "info" })
          reload()
        })
        .catch((err) => {
          toast.show({
            message: err instanceof Error ? err.message : "Failed to reset",
            variant: "error",
          })
        })
      evt.preventDefault()
      return
    }
  })

  const formatValue = (item: ConfigItem): string => {
    if (item.value === undefined) return "(not set)"
    if (Array.isArray(item.value)) return item.value.length > 0 ? item.value.join(", ") : "(empty)"
    if (typeof item.value === "boolean") return item.value ? "enabled" : "disabled"
    return String(item.value)
  }

  return (
    <box flexDirection="column" flexGrow={1} paddingLeft={2} paddingRight={2} paddingTop={1} paddingBottom={1}>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <box flexDirection="column" flexShrink={0} marginBottom={1} gap={1}>
        <box flexDirection="row" gap={2} alignItems="center">
          <text attributes={TextAttributes.BOLD} fg={theme.text}>
            Configuration
          </text>
          <text fg={theme.textMuted}>manage OpenTerminal settings</text>
          <Show when={categoryFilter()}>
            <text fg={theme.primary}>[{categoryFilter()}]</text>
          </Show>
        </box>
        <text fg={theme.textMuted}>
          Showing {configItems().length} of {allConfigItems().length} settings
        </text>
      </box>

      {/* ── List ───────────────────────────────────────────────────── */}
      <box flexGrow={1} flexDirection="column" overflow="hidden">
        <Show when={configItems().length === 0}>
          <box flexGrow={1} alignItems="center" justifyContent="center" flexDirection="column" gap={1}>
            <text fg={theme.textMuted}>
              {allConfigItems().length === 0 ? "Loading configuration..." : "No settings in this category"}
            </text>
          </box>
        </Show>

        <Show when={configItems().length > 0}>
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
            <text fg={theme.textMuted} width={2}>
              {" "}
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={24}>
              setting
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={16}>
              category
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD} width={20}>
              value
            </text>
            <text fg={theme.textMuted} attributes={TextAttributes.BOLD}>
              description
            </text>
          </box>

          <For each={configItems()}>
            {(item, index) => {
              const isSelected = () => index() === selected()
              const isNotSet = () => item.value === undefined
              return (
                <box
                  flexDirection="row"
                  flexShrink={0}
                  gap={2}
                  backgroundColor={isSelected() ? theme.backgroundPanel : undefined}
                  paddingLeft={0}
                  paddingRight={1}
                >
                  <text fg={theme.primary} width={2}>
                    {isSelected() ? "▸" : " "}
                  </text>
                  <text fg={theme.text} attributes={isSelected() ? TextAttributes.BOLD : 0} width={24}>
                    {item.label}
                  </text>
                  <text fg={theme.textMuted} width={16}>
                    {item.category}
                  </text>
                  <text fg={isNotSet() ? theme.textMuted : theme.text} width={20}>
                    {formatValue(item)}
                  </text>
                  <text fg={theme.textMuted}>{item.description}</text>
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
          <span style={{ fg: theme.text }}>e</span> edit
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>r</span> reset
        </text>
        <text fg={theme.textMuted}>
          <span style={{ fg: theme.text }}>f</span> filter
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
