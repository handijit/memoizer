// Used by jest only — the published bundles are compiled by TypeScript via rollup, so nothing here
// affects what ships.
module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
};
