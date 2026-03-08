import type { Argv } from "yargs"
import { cmd } from "./cmd"
import { UI } from "../ui"
import { Cronjob } from "../../cronjob"
import { bootstrap } from "../bootstrap"
import { Server } from "../../server/server"
import { createOpencodeClient } from "@opencode-ai/sdk/v2"
import { PermissionNext } from "../../permission/next"
import * as prompts from "@clack/prompts"
import { Agent } from "../../agent/agent"
import { Instance } from "../../project/instance"
import { Provider } from "../../provider/provider"
import fs from "fs/promises"
import path from "path"

// ─── logger ───────────────────────────────────────────────────────────────────

function ts() {
  return new Date().toISOString().replace("T", " ").slice(0, 19)
}

class CronjobLogger {
  private lines: string[] = []
  // part id → latest Part value, in insertion order
  private parts = new Map<string, any>()
  private startedAt = Date.now()

  constructor(
    private readonly job: Cronjob.Info,
    private readonly sessionID: string,
    private readonly agent: string | undefined,
    private readonly model: string | undefined,
  ) {}

  /** Write the opening header to the log file immediately. */
  async writeStart(): Promise<void> {
    const sep = "─".repeat(60)
    const header = [
      sep,
      `[${ts()}]  START  ${this.job.name}`,
      `  cron    : ${this.job.cron}`,
      `  agent   : ${this.agent || "(default)"}`,
      `  model   : ${this.model || "(default)"}`,
      `  session : ${this.sessionID}`,
      `  prompt  : ${this.job.prompt.replace(/\n/g, "\n           ")}`,
      "",
    ].join("\n")
    await this.append(header)
  }

  /** Buffer the latest state of a Part from a message.part.updated event. */
  trackPart(part: any): void {
    this.parts.set(part.id, part)
  }

  /** Log an inline error line (also buffered so it appears in the right place). */
  async writeError(msg: string): Promise<void> {
    const line = `[${ts()}]  ERROR  ${msg}\n`
    this.lines.push(line)
    await this.append(line)
  }

  /** Write a DONE / FAIL footer plus all buffered part details. */
  async writeFinish(failed = false): Promise<void> {
    const elapsed = ((Date.now() - this.startedAt) / 1000).toFixed(1)
    const entries: string[] = []

    for (const part of this.parts.values()) {
      if (part.sessionID !== this.sessionID) continue

      if (part.type === "text" && typeof part.text === "string" && part.text.trim()) {
        const preview = part.text.trim()
        entries.push(`  [text]  ${preview.replace(/\n/g, "\n          ")}`)
        continue
      }

      if (part.type === "tool") {
        const s = part.state
        if (!s || s.status === "pending") continue

        const inputRaw = JSON.stringify(s.input ?? {})
        const inputSummary = inputRaw.length > 200 ? inputRaw.slice(0, 200) + "…" : inputRaw

        if (s.status === "completed") {
          const outputRaw: string = typeof s.output === "string" ? s.output : ""
          const outputSummary =
            outputRaw.length > 400 ? outputRaw.trim().slice(0, 400) + "\n  …(truncated)" : outputRaw.trim()
          const dur = s.time?.end && s.time?.start ? ` (${((s.time.end - s.time.start) / 1000).toFixed(1)}s)` : ""
          entries.push(
            `  [tool:${part.tool}]${dur}  ${inputSummary}`,
            outputSummary ? `    → ${outputSummary.replace(/\n/g, "\n      ")}` : "",
          )
        } else if (s.status === "error") {
          const errMsg: string = typeof s.error === "string" ? s.error : JSON.stringify(s.error ?? "")
          entries.push(`  [tool:${part.tool}]  ERROR  ${inputSummary}`, `    → ${errMsg.slice(0, 300)}`)
        }
      }
    }

    const label = failed ? "FAIL " : "DONE "
    const footer = [
      ...(entries.length ? entries : ["  (no output)"]),
      "",
      `[${ts()}]  ${label}  ${this.job.name}  (${elapsed}s)`,
      "─".repeat(60),
      "",
    ].join("\n")

    await this.append(footer)
  }

  private async append(text: string): Promise<void> {
    try {
      const p = Cronjob.logPath()
      await fs.mkdir(path.dirname(p), { recursive: true })
      await fs.appendFile(p, text, "utf8")
    } catch {
      // log write failure must never crash the run
    }
  }
}

// ─── run ─────────────────────────────────────────────────────────────────────

const CronjobRunCommand = cmd({
  command: "run <name>",
  describe: "execute a cronjob by name (called by OS scheduler)",
  builder: (yargs: Argv) =>
    yargs
      .positional("name", {
        type: "string",
        describe: "cronjob name",
        demandOption: true,
      })
      .option("agent", {
        type: "string",
        describe: "override the agent configured for this cronjob",
      })
      .option("model", {
        type: "string",
        describe: "override the model configured for this cronjob (provider/model)",
      })
      .option("allow-inactive", {
        type: "boolean",
        default: false,
        describe: "run even when the cronjob is inactive (testing)",
      }),
  async handler(args) {
    const job = await Cronjob.get(args.name)
    if (!job) {
      UI.error(`Cronjob "${args.name}" not found`)
      process.exit(1)
    }
    if (!job.active && !args.allowInactive) {
      // Silently exit — job is disabled
      process.exit(0)
    }
    console.log(`OpenTerminal - CronJob Execution...`)
    const rules: PermissionNext.Ruleset = [
      { permission: "question", action: "deny", pattern: "*" },
      { permission: "plan_enter", action: "deny", pattern: "*" },
      { permission: "plan_exit", action: "deny", pattern: "*" },
      // Allow filesystem operations outside workspace for cronjobs
      { permission: "edit", action: "allow", pattern: "*" },
      { permission: "write", action: "allow", pattern: "*" },
      { permission: "read", action: "allow", pattern: "*" },
      { permission: "bash", action: "allow", pattern: "*" },
      { permission: "glob", action: "allow", pattern: "*" },
      { permission: "grep", action: "allow", pattern: "*" },
      { permission: "external_directory", action: "allow", pattern: "*" },
      ...(job.permissions ?? []),
    ]

    // Capture in const so TypeScript narrows the type in closures
    const resolvedJob = job
    // --agent CLI flag overrides the agent stored in the .md file
    const agentOverride = typeof args.agent === "string" ? args.agent.trim() : ""
    const jobAgent = agentOverride || resolvedJob.agent || undefined
    // --model CLI flag overrides the model stored in the .md file
    const modelOverride = typeof args.model === "string" ? args.model.trim() : ""
    const jobModelID = modelOverride || resolvedJob.model || ""
    const jobModel = jobModelID ? Provider.parseModel(jobModelID) : undefined

    await bootstrap(process.cwd(), async () => {
      const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
        return Server.App().fetch(new Request(input, init))
      }) as typeof globalThis.fetch

      const sdk = createOpencodeClient({
        baseUrl: "http://openterminal.internal",
        fetch: fetchFn,
      })

      const sessionResult = await sdk.session.create({
        title: `cronjob: ${resolvedJob.name}`,
        permission: rules,
      })
      const sessionID = sessionResult.data?.id
      if (!sessionID) {
        console.error("Failed to create session:", sessionResult.error)
        UI.error("Failed to create session")
        process.exit(1)
      }

      if (jobModel) {
        await Provider.getModel(jobModel.providerID, jobModel.modelID)
      }

      const logger = new CronjobLogger(resolvedJob, sessionID, jobAgent, jobModelID || undefined)
      await logger.writeStart()

      let failed = false

      // Subscribe to events and wait for idle
      async function loop() {
        const events = await sdk.event.subscribe()
        for await (const event of events.stream) {
          if (event.type === "session.error") {
            console.error(`Received session error for session ${sessionID}:`, event.properties)
            const props = event.properties
            if (props.sessionID !== sessionID) continue
            let err = String(props.error?.name ?? "Unknown error")
            if (props.error && "data" in props.error && props.error.data && "message" in (props.error.data as object)) {
              err = String((props.error.data as Record<string, unknown>).message)
            }
            failed = true
            UI.error(`Cronjob "${resolvedJob.name}" error: ${err}`)
            console.error(`Cronjob "${resolvedJob.name}" error:`, props.error)
            await logger.writeError(err)
          }

          if (event.type === "message.part.updated") {
            const part = (event.properties as any).part
            if (part?.sessionID === sessionID) logger.trackPart(part)
          }

          if (
            event.type === "session.status" &&
            event.properties.sessionID === sessionID &&
            event.properties.status.type === "idle"
          ) {
            break
          }
          // Auto-reject any permission requests (non-interactive)
          if (event.type === "permission.asked" && event.properties.sessionID === sessionID) {
            await sdk.permission.reply({
              requestID: event.properties.id,
              reply: "always",
            })
          }
        }
      }

      // Start event loop BEFORE sending prompt to avoid race condition
      const loopPromise = loop().catch(async (e) => {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`Cronjob "${resolvedJob.name}" loop error:`, e)
        await logger.writeError(`loop: ${msg}`)
        failed = true
      })

      // Give the event subscription time to establish
      await new Promise((resolve) => setTimeout(resolve, 100))

      UI.println(
        UI.Style.TEXT_INFO_BOLD + "▶",
        UI.Style.TEXT_NORMAL +
          `Started cronjob "${resolvedJob.name}"` +
          (jobAgent ? UI.Style.TEXT_DIM + ` [agent: ${jobAgent}]` : "") +
          (jobModelID ? UI.Style.TEXT_DIM + ` [model: ${jobModelID}]` : ""),
      )
      const promptResult = await sdk.session.prompt({
        sessionID,
        agent: jobAgent,
        model: jobModel,
        parts: [{ type: "text", text: resolvedJob.prompt }],
      })
      if (promptResult.error) {
        failed = true
        const errorData = promptResult.error.data as { message?: unknown } | undefined
        const err = typeof errorData?.message === "string" ? errorData.message : "Failed to send cronjob prompt"
        await logger.writeError(err)
        UI.error(`Cronjob "${resolvedJob.name}" failed to start: ${err}`)
        await logger.writeFinish(true)
        process.exit(1)
      }

      UI.println(
        failed ? UI.Style.TEXT_DANGER_BOLD + "✗" : UI.Style.TEXT_INFO_BOLD + "✓",
        UI.Style.TEXT_NORMAL + `Cronjob "${resolvedJob.name}" ${failed ? "failed" : "running"}`,
        UI.Style.TEXT_DIM + `→ ${Cronjob.logPath()}`,
      )

      // Wait for the event loop to complete
      await loopPromise

      await logger.writeFinish(failed)
    })
  },
})

// ─── create ──────────────────────────────────────────────────────────────────

const SCHEDULE_PRESETS = [
  { value: "*/15 * * * *", label: "Every 15 minutes", hint: "*/15 * * * *" },
  { value: "0 * * * *", label: "Every hour", hint: "0 * * * *" },
  { value: "0 9 * * *", label: "Daily at 9am", hint: "0 9 * * *" },
  { value: "0 9 * * 1-5", label: "Weekdays at 9am", hint: "0 9 * * 1-5" },
  { value: "0 9 * * 1", label: "Every Monday", hint: "0 9 * * 1" },
  { value: "0 9 1 * *", label: "Monthly (1st)", hint: "0 9 1 * *" },
  { value: "__custom__", label: "Custom…", hint: "Enter a cron expression manually" },
]

const CronjobCreateCommand = cmd({
  command: "create",
  describe: "create a new cronjob interactively",
  builder: (yargs: Argv) =>
    yargs
      .option("name", {
        type: "string",
        describe: "cronjob name (lowercase, hyphens allowed)",
      })
      .option("cron", {
        type: "string",
        describe: "cron expression (e.g. '0 9 * * *')",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use (empty = default agent)",
      })
      .option("model", {
        type: "string",
        describe: "model to use in provider/model format (empty = default model)",
      })
      .option("prompt", {
        type: "string",
        describe: "prompt to send to the agent on each run",
      })
      .option("inactive", {
        type: "boolean",
        default: false,
        describe: "create the job in inactive state",
      }),
  async handler(args) {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        const isFullyNonInteractive = !!args.name && !!args.cron && args.agent !== undefined && !!args.prompt

        if (!isFullyNonInteractive) {
          UI.empty()
          prompts.intro("Create cronjob")
        }

        // ── Name ────────────────────────────────────────────────────────
        let name: string
        if (args.name) {
          name = args.name
        } else {
          const result = await prompts.text({
            message: "Name",
            placeholder: "e.g. daily-standup",
            validate: (v) => {
              if (!v?.trim()) return "Name is required"
              if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/.test(v?.trim() ?? ""))
                return "Use lowercase letters, digits and hyphens (must start/end with alphanumeric)"
            },
          })
          if (prompts.isCancel(result)) throw new UI.CancelledError()
          name = (result as string).trim()
        }

        // Check for duplicate
        const existing = await Cronjob.get(name)
        if (existing) {
          if (isFullyNonInteractive) {
            console.error(`Error: Cronjob "${name}" already exists`)
            process.exit(1)
          }
          prompts.log.error(`Cronjob "${name}" already exists`)
          throw new UI.CancelledError()
        }

        // ── Schedule ─────────────────────────────────────────────────────
        let cron: string
        if (args.cron) {
          cron = args.cron
        } else {
          const schedResult = await prompts.select({
            message: "Schedule",
            options: SCHEDULE_PRESETS,
          })
          if (prompts.isCancel(schedResult)) throw new UI.CancelledError()

          if (schedResult === "__custom__") {
            const customResult = await prompts.text({
              message: "Cron expression",
              placeholder: "e.g. 0 9 * * 1-5",
              validate: (v) => {
                if (!v?.trim()) return "Cron expression is required"
                if (v?.trim().split(/\s+/).length !== 5)
                  return "Must have exactly 5 fields: minute hour day month weekday"
              },
            })
            if (prompts.isCancel(customResult)) throw new UI.CancelledError()
            cron = (customResult as string).trim()
          } else {
            cron = schedResult as string
          }
        }

        // ── Agent ─────────────────────────────────────────────────────────
        let agentName: string
        if (args.agent !== undefined) {
          agentName = args.agent
        } else {
          const agentList = await Agent.list().catch(() => [])
          const primaryAgents = agentList.filter((a) => a.mode !== "subagent" && !a.hidden)
          const agentResult = await prompts.select({
            message: "Agent",
            options: [
              { value: "", label: "(default)", hint: "Use the configured default agent" },
              ...primaryAgents.map((a) => ({
                value: a.name,
                label: a.name,
                hint: a.description ?? "",
              })),
            ],
          })
          if (prompts.isCancel(agentResult)) throw new UI.CancelledError()
          agentName = agentResult as string
        }

        // ── Model ─────────────────────────────────────────────────────────
        let modelName: string
        if (args.model !== undefined) {
          modelName = args.model.trim()
        } else if (isFullyNonInteractive) {
          modelName = ""
        } else {
          const providers = await Provider.list().catch(() => ({}))
          const defaultModel = await Provider.defaultModel().catch(() => undefined)
          const defaultModelID = defaultModel ? `${defaultModel.providerID}/${defaultModel.modelID}` : ""

          const modelOptions: Array<{ value: string; label: string; hint?: string }> = [
            {
              value: "",
              label: "(default)",
              hint: defaultModelID ? `Use default (${defaultModelID})` : "Use configured default model",
            },
          ]

          for (const provider of Object.values(providers).sort((a, b) => a.id.localeCompare(b.id))) {
            for (const model of Object.values(provider.models).sort((a, b) => a.id.localeCompare(b.id))) {
              modelOptions.push({
                value: `${provider.id}/${model.id}`,
                label: `${provider.id}/${model.id}`,
                hint: model.name && model.name !== model.id ? model.name : undefined,
              })
            }
          }

          const modelResult = await prompts.select({
            message: "Model",
            options: modelOptions,
            maxItems: 10,
          })
          if (prompts.isCancel(modelResult)) throw new UI.CancelledError()
          modelName = (modelResult as string).trim()
        }

        if (modelName) {
          try {
            const parsedModel = Provider.parseModel(modelName)
            await Provider.getModel(parsedModel.providerID, parsedModel.modelID)
          } catch (err) {
            const message = err instanceof Error ? err.message : `Invalid model: ${modelName}`
            if (isFullyNonInteractive) {
              console.error(`Error: ${message}`)
              process.exit(1)
            }
            prompts.log.error(message)
            throw new UI.CancelledError()
          }
        }

        // ── Prompt ───────────────────────────────────────────────────────
        let jobPrompt: string
        if (args.prompt) {
          jobPrompt = args.prompt
        } else {
          const promptResult = await prompts.text({
            message: "Prompt",
            placeholder: "What should the agent do when this job runs?",
            validate: (v) => (v?.trim() ? undefined : "Prompt is required"),
          })
          if (prompts.isCancel(promptResult)) throw new UI.CancelledError()
          jobPrompt = (promptResult as string).trim()
        }

        // ── Save ─────────────────────────────────────────────────────────
        const job: Cronjob.Info = {
          name,
          cron,
          active: !args.inactive,
          agent: agentName,
          model: modelName,
          prompt: jobPrompt,
          permissions: [],
        }

        try {
          await Cronjob.save(job)
        } catch (err) {
          if (err instanceof Cronjob.CronNotSupportedError) {
            if (isFullyNonInteractive) {
              console.error(`Error: ${err.message}`)
              process.exit(1)
            }
            prompts.log.error(err.message)
            throw new UI.CancelledError()
          }
          throw err
        }

        if (isFullyNonInteractive) {
          console.log(`Cronjob "${name}" created`)
        } else {
          prompts.log.success(`Cronjob "${name}" created (${job.active ? "active" : "inactive"})`)
          prompts.log.info(
            `Schedule: ${cron}${agentName ? `  Agent: ${agentName}` : ""}${modelName ? `  Model: ${modelName}` : ""}`,
          )
          prompts.outro("Done")
        }
      },
    })
  },
})

// ─── list ────────────────────────────────────────────────────────────────────

const CronjobListCommand = cmd({
  command: "list",
  describe: "list all cronjobs",
  builder: (yargs: Argv) => yargs,
  async handler() {
    const jobs = await Cronjob.list()
    if (jobs.length === 0) {
      UI.println(UI.Style.TEXT_DIM + "No cronjobs configured.")
      UI.println(
        UI.Style.TEXT_DIM +
          `Store jobs in ${process.env["XDG_CONFIG_HOME"] ?? "~/.config"}/openterminal/cronjob/<name>.md`,
      )
      return
    }
    for (const job of jobs) {
      const status = job.active ? UI.Style.TEXT_SUCCESS_BOLD + "● " : UI.Style.TEXT_DIM + "○ "
      const details = [job.agent ? `agent:${job.agent}` : "", job.model ? `model:${job.model}` : ""]
        .filter(Boolean)
        .join(" ")
      UI.println(
        status +
          UI.Style.TEXT_NORMAL +
          job.name.padEnd(24) +
          UI.Style.TEXT_DIM +
          job.cron.padEnd(16) +
          (details ? ` [${details}]` : ""),
      )
    }
    UI.empty()
    UI.println(UI.Style.TEXT_DIM + `${jobs.length} job${jobs.length === 1 ? "" : "s"} total`)
  },
})

// ─── enable / disable ────────────────────────────────────────────────────────

function makeToggleCommand(enable: boolean) {
  return cmd({
    command: `${enable ? "enable" : "disable"} <name>`,
    describe: `${enable ? "enable" : "disable"} a cronjob`,
    builder: (yargs: Argv) =>
      yargs.positional("name", { type: "string", describe: "cronjob name", demandOption: true }),
    async handler(args) {
      const job = await Cronjob.get(args.name)
      if (!job) {
        UI.error(`Cronjob "${args.name}" not found`)
        process.exit(1)
      }
      if (job.active === enable) {
        UI.println(UI.Style.TEXT_DIM + `Cronjob "${args.name}" is already ${enable ? "enabled" : "disabled"}.`)
        return
      }
      try {
        await Cronjob.toggle(args.name)
        UI.println(
          UI.Style.TEXT_SUCCESS_BOLD + "✓ ",
          UI.Style.TEXT_NORMAL + `Cronjob "${args.name}" ${enable ? "enabled" : "disabled"}`,
        )
      } catch (err) {
        if (err instanceof Cronjob.CronNotSupportedError) {
          UI.error(err.message)
          process.exit(1)
        }
        throw err
      }
    },
  })
}

const CronjobEnableCommand = makeToggleCommand(true)
const CronjobDisableCommand = makeToggleCommand(false)

// ─── delete ──────────────────────────────────────────────────────────────────

const CronjobDeleteCommand = cmd({
  command: "delete <name>",
  describe: "delete a cronjob",
  builder: (yargs: Argv) => yargs.positional("name", { type: "string", describe: "cronjob name", demandOption: true }),
  async handler(args) {
    const job = await Cronjob.get(args.name)
    if (!job) {
      UI.error(`Cronjob "${args.name}" not found`)
      process.exit(1)
    }
    await Cronjob.remove(args.name)
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + "✓ ", UI.Style.TEXT_NORMAL + `Cronjob "${args.name}" deleted`)
  },
})

// ─── root command ────────────────────────────────────────────────────────────

export const CronjobCommand = cmd({
  command: "cronjob",
  describe: "manage scheduled cronjobs",
  builder: (yargs: Argv) =>
    yargs
      .command(CronjobCreateCommand)
      .command(CronjobRunCommand)
      .command(CronjobListCommand)
      .command(CronjobEnableCommand)
      .command(CronjobDisableCommand)
      .command(CronjobDeleteCommand)
      .demandCommand(),
  handler() {},
})
