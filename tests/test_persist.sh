#!/bin/bash
set -e

echo "Cleaning up previous DB"
rm -f queuectl.db

echo "Enqueuing jobs..."
node queuectl.js enqueue '{"id":"job_persist_1","command":"echo Persist Test 1"}'
node queuectl.js enqueue '{"id":"job_persist_2","command":"sleep 10 && echo Persist Test 2"}'

echo "Starting 2 workers in background..."
node queuectl.js worker start --count 2 &
WORKER_PID=$!

echo "Letting workers run for 5 seconds..."
sleep 5

echo "Stopping workers..."
kill $WORKER_PID
wait $WORKER_PID 2>/dev/null || true

echo "Workers stopped, verifying job persistence..."

echo "Listing pending jobs after restart..."
node queuectl.js list --state pending

echo "Listing completed jobs after restart..."
node queuectl.js list --state completed

echo "Restarting workers again..."
node queuectl.js worker start --count 2 &
WORKER_PID=$!

echo "Waiting for jobs to finish..."
sleep 12

echo "Final job status:"
node queuectl.js status

echo "Stopping workers..."
kill $WORKER_PID

echo "Persistence test complete."
