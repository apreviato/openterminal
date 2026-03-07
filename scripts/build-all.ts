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

console.log(`Building ${allPackages.length} packages...\n`)

let hasErrors = false

for (const pkg of allPackages) {
  const pkgPath = join(packagesDir, pkg)
  const pkgJsonPath = join(pkgPath, "package.json")

  if (!existsSync(pkgJsonPath)) {
    continue
  }

  const pkgJson = await Bun.file(pkgJsonPath).json()

  if (!pkgJson.scripts?.build) {
    console.log(`⏭️  Skipping ${pkg} (no build script)`)
    continue
  }

  console.log(`🔨 Building ${pkg}...`)

  try {
    await $`bun run --cwd ${pkgPath} build`.quiet()
    console.log(`✅ ${pkg} built\n`)
  } catch (error) {
    console.error(`❌ ${pkg} failed\n`)
    hasErrors = true
  }
}

if (hasErrors) {
  console.error("\n❌ Build failed in one or more packages")
  process.exit(1)
} else {
  console.log("\n✅ All packages built successfully!")
}
