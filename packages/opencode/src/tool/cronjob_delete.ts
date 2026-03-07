import z from "zod"
import { Tool } from "./tool"
import { Cronjob } from "../cronjob"
import { Question } from "../question"
import DESCRIPTION from "./cronjob_delete.txt"

async function confirmDelete(ctx: Tool.Context, job: Cronjob.Info) {
  try {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
      questions: [
        {
          header: "Confirm delete",
          question:
            `Delete cronjob \"${job.name}\"? Schedule: ${job.cron}. ` +
            `State: ${job.active ? "active" : "inactive"}. Agent: ${job.agent || "(default)"}.`,
          options: [
            { label: "Confirm", description: "Delete this cronjob" },
            { label: "Cancel", description: "Keep cronjob" },
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

export const CronjobDeleteTool = Tool.define("cronjob_delete", {
  description: DESCRIPTION,
  parameters: z.object({
    name: z.string().describe("Cronjob name to delete"),
  }),
  async execute(params, ctx) {
    await ctx.ask({
      permission: "cronjob_delete",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const name = params.name.trim()
    if (!name) throw new Error("Cronjob name is required")

    const job = await Cronjob.get(name)
    if (!job) throw new Error(`Cronjob \"${name}\" not found`)

    const confirmed = await confirmDelete(ctx, job)
    if (!confirmed) {
      return {
        title: "Cronjob deletion cancelled",
        output: `Cronjob \"${name}\" was not deleted because the user cancelled confirmation.`,
        metadata: {
          confirmed: false,
          name,
          deleted: false,
        },
      }
    }

    await Cronjob.remove(name)

    return {
      title: `Cronjob deleted: ${name}`,
      output: `Deleted cronjob \"${name}\" and removed its scheduler registration.`,
      metadata: {
        confirmed: true,
        name,
        deleted: true,
      },
    }
  },
})
