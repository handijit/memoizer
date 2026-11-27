import { library } from "@handijitcom/config/eslint";

export default [
  ...library({ rootDir: import.meta.dirname }),
  {
    // `hasLogs` reports cache hits through this helper, the one place allowed to print.
    files: ["lib/helpers/logger.ts"],
    rules: { "no-console": "off" },
  },
];
