#!/bin/bash
set -e

# Clean db
rm -f queuectl.db

# Set configs
node queuectl.js config set max_retries 2
node queuectl.js config set backoff_base 2

# Enqueue successful job
node queuectl.js enqueue '{"id":"test1","command":"echo success"}'

# Enqueue failing job
node queuectl.js enqueue '{"id":"test2","command":"invalid_cmd"}'

# Start workers
node queuectl.js worker start --count 2 &
WORKER_PID=$!

# Wait and check status
sleep 12
node queuectl.js status

# List DLQ jobs (should include test2)
node queuectl.js dlq list

# Retry DLQ job
node queuectl.js dlq retry test2

# Wait for retry job to process
sleep 6

node queuectl.js status

# Stop workers
kill $WORKER_PID

echo "All commands checked with retry, DLQ, status"
