#!/bin/sh
set -e

rm -rf build
echo "Building memoizer..."
rollup -c
echo "Created production build 📦"
