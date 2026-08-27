import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";
import { dts } from "rollup-plugin-dts";

const input = "./lib/index.ts";

// TypeScript alone handles downlevelling to the tsconfig target, which keeps browser output
// deterministic.
const ts = () =>
  typescript({
    tsconfig: "./tsconfig.json",
    exclude: ["__tests__/**"],
  });

export default [
  {
    input,
    output: [
      {
        file: "./build/index.mjs",
        format: "es",
        sourcemap: true,
      },
      {
        file: "./build/index.cjs",
        format: "cjs",
        exports: "named",
        sourcemap: true,
      },
    ],
    plugins: [ts()],
  },
  {
    // Minified single file for <script> and CDN use.
    input,
    output: {
      file: "./build/index.umd.js",
      format: "umd",
      name: "memofy",
      exports: "named",
      sourcemap: true,
    },
    plugins: [ts(), terser()],
  },
  {
    input,
    output: { file: "./build/index.d.ts", format: "es" },
    plugins: [dts({ tsconfig: "./tsconfig.json" })],
  },
];
