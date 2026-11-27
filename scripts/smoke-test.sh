#!/bin/sh
# The gate measures the source; this measures the tarball a consumer installs. It packs the built
# package, installs the tarball into an empty project and loads every entry by its published name,
# as an ES module and as CommonJS. Run it after `npm run build`.
set -e

# The published entries, relative to the package name ("" is the root entry).
ENTRIES="."

ROOT="$(pwd)"
NAME="$(node -p "require('./package.json').name")"
TARBALL="$ROOT/$(npm pack --silent | tail -n 1)"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"; rm -f "$TARBALL"' EXIT
cd "$WORK"
npm init -y >/dev/null
npm install --ignore-scripts --no-audit --no-fund --silent "$TARBALL"

for ENTRY in $ENTRIES; do
  [ "$ENTRY" = "." ] && ENTRY=""
  SPECIFIER="$NAME$ENTRY" node --input-type=module \
    -e "await import(process.env.SPECIFIER); console.log(process.env.SPECIFIER + ': ESM OK')"
  SPECIFIER="$NAME$ENTRY" node \
    -e "require(process.env.SPECIFIER); console.log(process.env.SPECIFIER + ': CJS OK')"
done
