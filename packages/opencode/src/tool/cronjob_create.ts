import z from "zod"
import { Tool } from "./tool"
import { Cronjob } from "../cronjob"
import { Question } from "../question"
import DESCRIPTION from "./cronjob_create.txt"

const namePattern = /^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/

async function confirmCreate(
  ctx: Tool.Context,
  input: {
    name: string
    cron: string
    agent: string
    active: boolean
    prompt: string
  },
) {
  const promptPreview = input.prompt.length > 160 ? input.prompt.slice(0, 160) + "..." : input.prompt
  try {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
      questions: [
        {
          header: "Confirm create",
          question:
            `Create cronjob \"${input.name}\" with schedule \"${input.cron}\"? ` +
            `Agent: ${input.agent || "(default)"}. State: ${input.active ? "active" : "inactive"}. ` +
            `Prompt preview: ${promptPreview}`,
          options: [
            { label: "Confirm", description: "Create this cronjob" },
            { label: "Cancel", description: "Do not create" },
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

export const CronjobCreateTool = Tool.define("cronjob_create", {
  description: DESCRIPTION,
  parameters: z.object({
    name: z.string().describe("Cronjob name (lowercase letters, digits, hyphens)"),
    cron: z.string().describe("Cron expression (5 fields, e.g. '0 9 * * 1-5')"),
    prompt: z.string().describe("Prompt sent to the agent when the job runs"),
    agent: z.string().describe("Agent name (empty or omitted = default)").optional(),
    active: z.boolean().describe("Whether job should be active after creation (default: true)").optional(),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "cronjob_create",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const name = params.name.trim()
    const cron = params.cron.trim()
    const prompt = params.prompt.trim()
    const agent = (params.agent ?? "").trim()
    const active = params.active ?? true

    if (!namePattern.test(name)) {
      throw new Error(
        "Invalid cronjob name. Use lowercase letters, digits, and hyphens; must start and end with alphanumeric.",
      )
    }

    if (!prompt) throw new Error("Prompt is required")
    if (cron.split(/\s+/).length !== 5) {
      throw new Error("Invalid cron expression. Expected exactly 5 fields: minute hour day month weekday")
    }

    const existing = await Cronjob.get(name)
    if (existing) throw new Error(`Cronjob \"${name}\" already exists`)

    const confirmed = await confirmCreate(ctx, { name, cron, prompt, agent, active })
    if (!confirmed) {
      return {
        title: "Cronjob creation cancelled",
        output: `Cronjob \"${name}\" was not created because the user cancelled confirmation.`,
        metadata: {
          confirmed: false,
          name,
          created: false,
        },
      }
    }

    const job: Cronjob.Info = {
      name,
      cron,
      prompt,
      agent,
      active,
      permissions: [],
    }

    await Cronjob.save(job)

    return {
      title: `Cronjob created: ${name}`,
      output: `Created cronjob \"${name}\" (${active ? "active" : "inactive"}) on schedule \"${cron}\" with agent ${agent || "(default)"}.`,
      metadata: {
        confirmed: true,
        name,
        created: true,
      },
    }
  },
})
