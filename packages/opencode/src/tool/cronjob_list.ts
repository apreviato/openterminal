import z from "zod"
import { Tool } from "./tool"
import { Cronjob } from "../cronjob"
import { Question } from "../question"
import DESCRIPTION from "./cronjob_list.txt"

async function confirmList(ctx: Tool.Context) {
  try {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
      questions: [
        {
          header: "Confirm list",
          question: "Do you want me to list the configured cronjobs now?",
          options: [
            { label: "Confirm", description: "List all cronjobs" },
            { label: "Cancel", description: "Do not list cronjobs" },
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

export const CronjobListTool = Tool.define("cronjob_list", {
  description: DESCRIPTION,
  parameters: z.object({}),
  async execute(_params, ctx) {
    await ctx.ask({
      permission: "cronjob_list",
      patterns: ["*"],
      always: ["*"],
      metadata: {},
    })

    const confirmed = await confirmList(ctx)
    if (!confirmed) {
      return {
        title: "Cronjob listing cancelled",
        output: "Cronjob listing was cancelled by the user.",
        metadata: {
          confirmed: false,
          count: 0,
          names: [] as string[],
        },
      }
    }

    const jobs = await Cronjob.list()
    const output =
      jobs.length === 0
        ? "No cronjobs configured."
        : jobs
            .map(
              (job) =>
                `${job.name} | ${job.cron} | ${job.active ? "active" : "inactive"} | ${job.agent || "(default)"} | ${job.model || "(default)"}`,
            )
            .join("\n")

    return {
      title: `Cronjobs (${jobs.length})`,
      output,
      metadata: {
        confirmed: true,
        count: jobs.length,
        names: jobs.map((job) => job.name),
      },
    }
  },
})
