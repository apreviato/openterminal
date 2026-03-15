import path from "path"
import type { Tool } from "./tool"
import { Instance } from "../project/instance"

type Kind = "file" | "directory"

type Options = {
  bypass?: boolean
  kind?: Kind
}

function normalizePath(value: string) {
  const resolved = path.resolve(value)
  if (process.platform === "win32") {
    return resolved.replaceAll("/", "\\").toLowerCase()
  }
  return resolved.replaceAll("\\", "/")
}

function isWithin(target: string, root: string) {
  if (target === root) return true
  const suffix = process.platform === "win32" ? "\\" : "/"
  return target.startsWith(root + suffix)
}

function protectedRoots() {
  if (process.platform === "win32") {
    const systemDrive = process.env.SystemDrive ?? "C:"
    const windowsRoot = process.env.SystemRoot ?? process.env.windir ?? path.join(systemDrive, "Windows")
    const roots = [
      windowsRoot,
      process.env.ProgramData ?? path.join(systemDrive, "ProgramData"),
      process.env.ProgramFiles ?? path.join(systemDrive, "Program Files"),
      process.env["ProgramFiles(x86)"] ?? path.join(systemDrive, "Program Files (x86)"),
    ]
    return roots.map(normalizePath)
  }

  const roots = [
    "/bin",
    "/boot",
    "/dev",
    "/etc",
    "/lib",
    "/lib64",
    "/proc",
    "/root",
    "/run",
    "/sbin",
    "/sys",
    "/usr",
    "/var/run",
    "/System",
    "/Library",
    "/Applications",
  ]

  return roots.map(normalizePath)
}

function assertNotProtected(target: string) {
  const normalizedTarget = normalizePath(target)
  for (const root of protectedRoots()) {
    if (isWithin(normalizedTarget, root)) {
      throw new Error(`Access to system directories is blocked: ${target}`)
    }
  }
}

export async function assertExternalDirectory(ctx: Tool.Context, target?: string, options?: Options) {
  if (!target) return

  if (options?.bypass) return

  if (Instance.containsPath(target)) return

  const kind = options?.kind ?? "file"
  const parentDir = kind === "directory" ? target : path.dirname(target)
  assertNotProtected(parentDir)
  const glob = path.join(parentDir, "*").replaceAll("\\", "/")

  await ctx.ask({
    permission: "external_directory",
    patterns: [glob],
    always: [glob],
    metadata: {
      filepath: target,
      parentDir,
    },
  })
}
