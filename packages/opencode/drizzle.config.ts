import { defineConfig } from "drizzle-kit"
import { xdgData } from "xdg-basedir"
import path from "path"

const dbPath = path.join(xdgData!, "openterminal", "openterminal.db")

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/**/*.sql.ts",
  out: "./migration",
  dbCredentials: {
    url: dbPath,
  },
})
