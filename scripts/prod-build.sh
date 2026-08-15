#!/bin/sh
set -e

rm -rf build
echo "Building memofy..."
rollup -c
echo "Created production build 📦"
