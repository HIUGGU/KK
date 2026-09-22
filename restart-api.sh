#!/bin/bash
# Script to restart the API server with fresh code

echo "Stopping any running API servers..."
pkill -f "ts-node.*server.ts" || true
pkill -f "node.*server" || true
sleep 2

echo "Clearing TypeScript cache..."
rm -rf node_modules/.cache 2>/dev/null
rm -rf API/dist 2>/dev/null

echo "Starting API server..."
cd "$(dirname "$0")"
npm run dev:api








