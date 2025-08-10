#!/bin/bash
# ZapStar Build Script
# This script creates a production-ready version of the app in the /dist folder.

# --- Configuration ---
# Exit immediately if a command exits with a non-zero status.
set -e

# --- Steps ---
echo "🧹 Cleaning up old build..."
rm -rf dist
mkdir dist

echo "📦 Building and bundling JavaScript..."
# Use npx to run esbuild without a local installation.
# --bundle: Follows imports and bundles them into a single file.
# --minify: Optimizes the code for size and speed.
# --outfile: Specifies the output file.
npx esbuild js/app.js --bundle --minify --outfile=dist/app.js

echo "🎨 Building and minifying CSS..."
npx esbuild style.css --minify --outfile=dist/style.css

echo "🖼️ Copying assets..."
cp -r images dist/
cp index.html dist/

echo "🔗 Updating script path in HTML..."
# Use sed to replace the script path to point to the bundled file.
# The '' after -i is required for macOS compatibility to prevent backup files.
sed -i '' 's|type="module" src="js/app.js"|src="app.js"|g' dist/index.html

echo "✅ Build complete. The /dist folder is ready for deployment."
