import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    external: ["yaml"],
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    // Keep yaml external — it ships as a package dependency.
    external: ["yaml"],
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
]);
