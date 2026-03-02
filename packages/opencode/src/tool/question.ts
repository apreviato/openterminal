import z from "zod"
import { Tool } from "./tool"
import { Question } from "../question"
import DESCRIPTION from "./question.txt"

export const QuestionTool = Tool.define("question", {
  description: DESCRIPTION,
  parameters: z.object({
    questions: z
      .preprocess((raw) => {
        if (!Array.isArray(raw)) return raw
        return raw.map((item: any) => {
          if (!item || typeof item !== "object") return item
          // Normalize question text field
          const question =
            item.question ?? item.text ?? item.prompt ?? item.q ?? item.content ?? ""
          // Normalize header field (or derive from question)
          const header =
            item.header ??
            item.title ??
            item.label ??
            item.name ??
            (typeof question === "string" ? question.slice(0, 30) : "")
          // Normalize options — accept strings or objects with alternate field names
          let options = item.options ?? item.choices ?? []
          if (Array.isArray(options)) {
            options = options.map((opt: any) => {
              if (typeof opt === "string") return { label: opt, description: "" }
              return {
                label: opt.label ?? opt.text ?? opt.value ?? opt.name ?? String(opt),
                description: opt.description ?? opt.hint ?? opt.detail ?? "",
              }
            })
          }
          return { ...item, question, header, options }
        })
      }, z.array(Question.Info.omit({ custom: true })))
      .describe("Questions to ask"),
  }),
  async execute(params, ctx) {
    const answers = await Question.ask({
      sessionID: ctx.sessionID,
      questions: params.questions,
      tool: ctx.callID ? { messageID: ctx.messageID, callID: ctx.callID } : undefined,
    })

    function format(answer: Question.Answer | undefined) {
      if (!answer?.length) return "Unanswered"
      return answer.join(", ")
    }

    const formatted = params.questions.map((q, i) => `"${q.question}"="${format(answers[i])}"`).join(", ")

    return {
      title: `Asked ${params.questions.length} question${params.questions.length > 1 ? "s" : ""}`,
      output: `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`,
      metadata: {
        answers,
      },
    }
  },
})
