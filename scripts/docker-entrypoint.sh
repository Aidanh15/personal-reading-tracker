#!/bin/bash
set -e

echo "🚀 Starting Personal Reading Tracker..."

# Detect if running on Raspberry Pi
if [ "${RASPBERRY_PI:-false}" = "true" ] || [ "$(uname -m)" = "aarch64" ] || [ "$(uname -m)" = "arm64" ]; then
    echo "🍓 Raspberry Pi detected - applying optimizations"
    export RASPBERRY_PI=true
fi

# Change to backend directory for seeding
cd /app/backend

# Run database seeding with user data (only if database is empty)
echo "📚 Checking if database needs seeding..."
if node dist/scripts/seed.js seed-user-data; then
    echo "✅ Database seeding completed successfully"
else
    echo "⚠️  Database seeding failed or was skipped (data already exists)"
fi

# Reconcile the numbered master list without resetting existing reading progress.
echo "🧭 Syncing the master reading plan..."
if node dist/scripts/seed.js sync-reading-plan; then
    echo "✅ Master reading plan is up to date"
else
    echo "⚠️  Master reading plan sync failed; existing library data was left in place"
fi

# Change back to app directory
cd /app

# Start the main application with Pi optimizations if needed
echo "🌟 Starting the application server..."
if [ "${RASPBERRY_PI:-false}" = "true" ]; then
    echo "🍓 Starting with Raspberry Pi optimizations..."
    exec node --max-old-space-size=256 --max-semi-space-size=32 backend/dist/index.js
else
    exec node backend/dist/index.js
fi
