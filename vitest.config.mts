import { library } from "@handijitcom/config/vitest";

// Server paths run in node, the `trace` path (`*.dom.test.ts`) in jsdom; 100 % coverage.
// lib/index.ts holds the Memoizer class, not a barrel, so only the type-only files stay out.
export default library({ barrels: ["lib/types/**"] });
