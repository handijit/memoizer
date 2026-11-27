# Changelog

All notable changes to this package are documented in this file.

## [Unreleased]

## [1.0.1] - 2026-11-27

### Fixed

- TypeScript in Node's ES module resolution (`"moduleResolution": "node16"` or
  `"nodenext"`, importing from an ES module) read the CommonJS declaration file
  for the ES module entry ("masquerading as CommonJS"). The build now also
  ships `build/index.d.mts`, identical to `build/index.d.ts`, and `exports`
  names a `types` file per condition. The JavaScript is unchanged; bundler and
  CommonJS resolution are unaffected.

### Changed

- `CHANGELOG.md` is published with the package.
- Development only: tests moved from Jest and Babel to Vitest, the tooling to
  the `@handijitcom/config` presets (ESLint, Prettier, TypeScript 7 checking,
  Vitest), `publint` and `attw` joined the gate, and CI runs on Node 24 and 26.

## [1.0.0] - 2026-11-26

First release under the `@handijitcom` npm organization. The package was previously published as `@handijit/memoizer` (last version 1.0.0); the API is unchanged, only the package name and the version line reset.

### Changed

- Package name: `@handijit/memoizer` → `@handijitcom/memoizer`.
- CI/CD follows the Han Dijit standard (`ci.yml`, `publish.yml`).
