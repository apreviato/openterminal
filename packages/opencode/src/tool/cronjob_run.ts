import z from "zod"
import { Tool } from "./tool"
import { Cronjob } from "../cronjob"
import { Question } from "../question"
import { Process } from "../util/process"
import { Filesystem } from "../util/filesystem"
import DESCRIPTION from "./cronjob_run.txt"

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000

async function confirmRun(ctx: Tool.Context, job: Cronjob.Info, agentOverride: string) {
  try {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
      questions: [
        {
          header: "Confirm run",
          question:
            `Run cronjob \"${job.name}\" now for testing? Schedule: ${job.cron}. ` +
            `State: ${job.active ? "active" : "inactive"}. ` +
            `Agent: ${agentOverride || job.agent || "(default)"}.`,
          options: [
            { label: "Confirm", description: "Run this cronjob now" },
            { label: "Cancel", description: "Do not run" },
          ],
          multiple: false,
          custom: false,
        },
      ],
    })
    return answers[0]?.includes("Confirm") ?? false
  } catch {
    return false
  }
}

async function runCronjobCli(command: string[], abort: AbortSignal, timeout: number) {
  const candidates = [] as string[][]
  const preferredBin = Cronjob.binaryPath()
  if (await Filesystem.exists(preferredBin)) {
    candidates.push([preferredBin, ...command])
  }
  candidates.push(["openterminal", ...command])

  let lastError: unknown
  for (const candidate of candidates) {
    try {
      return await Process.run(candidate, {
        nothrow: true,
        abort,
        timeout,
      })
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to execute cronjob test run")
}

export const CronjobRunTool = Tool.define("cronjob_run", {
  description: DESCRIPTION,
  parameters: z.object({
    name: z.string().describe("Cronjob name to execute"),
    agent: z.string().describe("Optional agent override for this run").optional(),
    allow_inactive: z.boolean().describe("Allow test execution when cronjob is inactive").optional(),
    timeout_ms: z.number().int().positive().describe("Timeout in milliseconds for the CLI run").optional(),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "cronjob_run",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const name = params.name.trim()
    const agent = (params.agent ?? "").trim()
    const allowInactive = params.allow_inactive ?? true
    const timeout = params.timeout_ms ?? DEFAULT_TIMEOUT_MS

    if (!name) throw new Error("Cronjob name is required")

    const job = await Cronjob.get(name)
    if (!job) throw new Error(`Cronjob \"${name}\" not found`)

    const confirmed = await confirmRun(ctx, job, agent)
    if (!confirmed) {
      return {
        title: "Cronjob test run cancelled",
        output: `Cronjob \"${name}\" was not executed because the user cancelled confirmation.`,
        metadata: {
          confirmed: false,
          name,
          exit: null as number | null,
        },
      }
    }

    const command = ["cronjob", "run", name]
    if (allowInactive) command.push("--allow-inactive")
    if (agent) {
      command.push("--agent", agent)
    }

    const result = await runCronjobCli(command, ctx.abort, timeout)
    const stdout = result.stdout.toString().trim()
    const stderr = result.stderr.toString().trim()
    const output = [
      `Command: ${["openterminal", ...command].join(" ")}`,
      `Exit code: ${result.code}`,
      stdout ? `\n[stdout]\n${stdout}` : "",
      stderr ? `\n[stderr]\n${stderr}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    return {
      title: `Cronjob test run: ${name}`,
      output,
      metadata: {
        confirmed: true,
        name,
        exit: result.code,
      },
    }
  },
})
