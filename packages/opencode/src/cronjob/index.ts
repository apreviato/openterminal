import path from "path"
import fs from "fs/promises"
import { Global } from "../global"
import { Process } from "../util/process"

export namespace Cronjob {
  export type PermissionRule = {
    permission: string
    pattern: string
    action: "allow" | "deny" | "ask"
  }

  export type Info = {
    name: string
    cron: string
    active: boolean
    /** Agent name, empty string = use default agent */
    agent: string
    /** Model id as provider/model, empty string = use default model */
    model: string
    prompt: string
    /** Per-tool permission rules for this job */
    permissions: PermissionRule[]
  }

  export class CronNotSupportedError extends Error {
    constructor(cron: string) {
      super(
        `Cron expression "${cron}" is not supported on Windows Task Scheduler. ` +
          `Use a simpler expression (daily, weekly, monthly, every-N-minutes) or configure schtasks manually.`,
      )
      this.name = "CronNotSupportedError"
    }
  }

  const MARKER = "# openterminal-cronjob:"

  function dir() {
    return path.join(Global.Path.config, "cronjob")
  }

  export function logPath(): string {
    return path.join(dir(), "logs.txt")
  }

  function filePath(name: string) {
    return path.join(dir(), `${name}.md`)
  }

  function serialize(job: Info): string {
    const base = [job.name, job.cron, job.active ? "active" : "inactive", job.agent, job.model, job.prompt].join("\n")
    if (job.permissions.length > 0) {
      return base + "\n" + JSON.stringify(job.permissions)
    }
    return base
  }

  function isLikelyModel(value: string): boolean {
    // provider/model (model may include additional slashes)
    return /^[a-z0-9._-]+\/\S+$/i.test(value)
  }

  function parse(content: string, filename: string): Info | undefined {
    const lines = content.split("\n")
    if (lines.length < 4) return undefined
    const name = lines[0].trim()
    const cron = lines[1].trim()
    const active = lines[2].trim() === "active"
    const agent = lines[3].trim()
    const modelLine = lines[4]?.trim() ?? ""

    const hasModelLine = modelLine === "" || isLikelyModel(modelLine)
    const model = hasModelLine ? modelLine : ""

    // Backward compatibility: older format had no model line
    let promptLines = lines.slice(hasModelLine ? 5 : 4)
    let permissions: PermissionRule[] = []

    // If last non-empty line is a JSON array, treat it as permissions
    let lastIdx = promptLines.length - 1
    while (lastIdx >= 0 && !promptLines[lastIdx].trim()) lastIdx--
    if (lastIdx >= 0) {
      const lastLine = promptLines[lastIdx].trim()
      if (lastLine.startsWith("[")) {
        try {
          const parsed = JSON.parse(lastLine)
          if (
            Array.isArray(parsed) &&
            (parsed.length === 0 || (parsed[0] && typeof parsed[0].permission === "string"))
          ) {
            permissions = parsed
            promptLines = promptLines.slice(0, lastIdx)
          }
        } catch {}
      }
    }

    const prompt = promptLines.join("\n").trim()
    if (!name || !cron) return undefined
    // name must match filename stem
    const stem = path.basename(filename, ".md")
    if (name !== stem) return undefined
    return { name, cron, active, agent, model, prompt, permissions }
  }

  export async function list(): Promise<Info[]> {
    const d = dir()
    await fs.mkdir(d, { recursive: true })
    let entries: string[]
    try {
      entries = await fs.readdir(d)
    } catch {
      return []
    }
    const jobs: Info[] = []
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue
      const fp = path.join(d, entry)
      const content = await fs.readFile(fp, "utf8").catch(() => "")
      const job = parse(content, entry)
      if (job) jobs.push(job)
    }
    return jobs.sort((a, b) => a.name.localeCompare(b.name))
  }

  export async function get(name: string): Promise<Info | undefined> {
    const fp = filePath(name)
    const content = await fs.readFile(fp, "utf8").catch(() => "")
    if (!content) return undefined
    return parse(content, `${name}.md`)
  }

  export async function save(job: Info): Promise<void> {
    const d = dir()
    await fs.mkdir(d, { recursive: true })
    await fs.writeFile(filePath(job.name), serialize(job), "utf8")
    // Re-sync OS scheduler entry for this job
    await uninstall(job.name).catch(() => {})
    if (job.active) await install(job)
  }

  export async function remove(name: string): Promise<void> {
    await uninstall(name).catch(() => {})
    await fs.unlink(filePath(name)).catch(() => {})
  }

  export async function toggle(name: string): Promise<void> {
    const job = await get(name)
    if (!job) throw new Error(`Cronjob "${name}" not found`)
    const updated = { ...job, active: !job.active }
    await fs.writeFile(filePath(name), serialize(updated), "utf8")
    if (updated.active) {
      await install(updated)
    } else {
      await uninstall(name)
    }
  }

  export function binaryPath(): string {
    const env = process.env["OPENTERMINAL_BIN"]
    if (env) return env

    // On Windows, prefer the .cmd wrapper
    if (process.platform === "win32") {
      const home = process.env["USERPROFILE"] || process.env["HOME"] || "~"
      return path.join(home, ".openterminal", "bin", "openterminal.cmd")
    }

    // On Unix, try $HOME/.openterminal/bin first
    const home = process.env["HOME"] || "~"
    return path.join(home, ".openterminal", "bin", "openterminal")
  }

  export async function install(job: Info): Promise<void> {
    if (process.platform === "win32") {
      await installWindows(job)
    } else {
      await installUnix(job)
    }
  }

  export async function uninstall(name: string): Promise<void> {
    if (process.platform === "win32") {
      await uninstallWindows(name)
    } else {
      await uninstallUnix(name)
    }
  }

  // ─── Unix / macOS ────────────────────────────────────────────────────────────

  async function readCrontab(): Promise<string> {
    const result = await Process.run(["crontab", "-l"], { nothrow: true })
    if (result.code !== 0) return ""
    return result.stdout.toString()
  }

  async function writeCrontab(content: string): Promise<void> {
    // Feed content to crontab via a temp file (avoids shell escaping issues)
    const tmp = path.join(Global.Path.cache, `crontab-${Date.now()}.txt`)
    await fs.writeFile(tmp, content, "utf8")
    try {
      await Process.run(["crontab", tmp], { nothrow: true })
    } finally {
      await fs.unlink(tmp).catch(() => {})
    }
  }

  async function installUnix(job: Info): Promise<void> {
    const bin = binaryPath()
    const existing = await readCrontab()
    // Remove any existing entry for this job
    const cleaned = removeJobFromCrontab(existing, job.name)
    const entry = `${MARKER}${job.name}\n${job.cron} "${bin}" cronjob run ${job.name}`
    const updated = cleaned.trimEnd() + (cleaned.trim() ? "\n" : "") + entry + "\n"
    await writeCrontab(updated)
  }

  async function uninstallUnix(name: string): Promise<void> {
    const existing = await readCrontab()
    if (!existing.includes(`${MARKER}${name}`)) return
    const cleaned = removeJobFromCrontab(existing, name)
    await writeCrontab(cleaned)
  }

  function removeJobFromCrontab(content: string, name: string): string {
    const lines = content.split("\n")
    const result: string[] = []
    let skip = false
    for (const line of lines) {
      if (line === `${MARKER}${name}`) {
        skip = true
        continue
      }
      if (skip) {
        skip = false
        continue // skip the cron line that follows the marker
      }
      result.push(line)
    }
    return result.join("\n")
  }

  // ─── Windows ─────────────────────────────────────────────────────────────────

  /**
   * Maps a simple cron expression to schtasks arguments.
   * Supports: * * * * *, M H * * *, M H * * D, M H D * *
   * Throws CronNotSupportedError for complex expressions.
   */
  export function parseCronForSchtasks(cron: string): string[] {
    const parts = cron.trim().split(/\s+/)
    if (parts.length !== 5) throw new CronNotSupportedError(cron)

    const [minute, hour, dom, month, dow] = parts

    // Every minute: * * * * *
    if (minute === "*" && hour === "*" && dom === "*" && month === "*" && dow === "*") {
      return ["/SC", "MINUTE", "/MO", "1"]
    }

    // Every N minutes: */N * * * *
    const everyN = minute.match(/^\*\/(\d+)$/)
    if (everyN && hour === "*" && dom === "*" && month === "*" && dow === "*") {
      return ["/SC", "MINUTE", "/MO", everyN[1]]
    }

    // Only support fixed hour/minute from here on
    if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) throw new CronNotSupportedError(cron)
    if (month !== "*") throw new CronNotSupportedError(cron)

    const hh = hour.padStart(2, "0")
    const mm = minute.padStart(2, "0")
    const startTime = `${hh}:${mm}`

    // Daily: M H * * *
    if (dom === "*" && dow === "*") {
      return ["/SC", "DAILY", "/ST", startTime]
    }

    // Weekly: M H * * D or M H * * D-D or M H * * D,D,...
    if (dom === "*" && dow !== "*") {
      const dayMap: Record<string, string> = {
        "0": "SUN",
        "1": "MON",
        "2": "TUE",
        "3": "WED",
        "4": "THU",
        "5": "FRI",
        "6": "SAT",
        "7": "SUN",
      }
      // Handle ranges like 1-5
      let days = dow
      if (dow.includes("-")) {
        const [start, end] = dow.split("-").map(Number)
        const dayNums = Array.from({ length: end - start + 1 }, (_, i) => String(i + start))
        days = dayNums.map((d) => dayMap[d] || d).join(",")
      } else {
        days = dow
          .split(",")
          .map((d) => dayMap[d.trim()] || d.trim())
          .join(",")
      }
      return ["/SC", "WEEKLY", "/D", days, "/ST", startTime]
    }

    // Monthly: M H D * *
    if (dom !== "*" && dow === "*") {
      if (!/^\d+$/.test(dom)) throw new CronNotSupportedError(cron)
      return ["/SC", "MONTHLY", "/D", dom, "/ST", startTime]
    }

    throw new CronNotSupportedError(cron)
  }

  async function installWindows(job: Info): Promise<void> {
    const scheduleFlags = parseCronForSchtasks(job.cron)
    const bin = binaryPath()
    const taskName = `openterminal-${job.name}`
    const tr = `"${bin}" cronjob run ${job.name}`
    const args = ["schtasks", "/Create", "/F", "/TN", taskName, "/TR", tr, ...scheduleFlags]
    const result = await Process.run(args, { nothrow: true })
    if (result.code !== 0) {
      throw new Error(`schtasks failed: ${result.stderr}`)
    }
  }

  async function uninstallWindows(name: string): Promise<void> {
    const taskName = `openterminal-${name}`
    await Process.run(["schtasks", "/Delete", "/TN", taskName, "/F"], { nothrow: true })
  }
}
