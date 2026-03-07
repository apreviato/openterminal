#!/usr/bin/env bun
import { $ } from "bun"
import { readdirSync, existsSync } from "fs"
import { join } from "path"

const packagesDir = join(import.meta.dir, "..", "packages")
const packages = readdirSync(packagesDir, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)

// Add nested packages
const nestedPackages = ["sdk/js"]

const allPackages = [...packages, ...nestedPackages]

console.log(`Running typecheck on ${allPackages.length} packages...\n`)

let hasErrors = false

for (const pkg of allPackages) {
  const pkgPath = join(packagesDir, pkg)
  const pkgJsonPath = join(pkgPath, "package.json")

  if (!existsSync(pkgJsonPath)) {
    continue
  }

  const pkgJson = await Bun.file(pkgJsonPath).json()

  if (!pkgJson.scripts?.typecheck) {
    console.log(`⏭️  Skipping ${pkg} (no typecheck script)`)
    continue
  }

  console.log(`🔍 Typechecking ${pkg}...`)

  try {
    await $`bun run --cwd ${pkgPath} typecheck`
    console.log(`✅ ${pkg} passed\n`)
  } catch (error) {
    console.error(`❌ ${pkg} failed\n`)
    hasErrors = true
  }
}

if (hasErrors) {
  console.error("\n❌ Typecheck failed in one or more packages")
  process.exit(1)
} else {
  console.log("\n✅ All packages passed typecheck!")
}
