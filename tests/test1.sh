#!/bin/bash
set -e

# Start fresh each test run
rm -f queuectl.db

echo "Setting configs..."
node queuectl.js config set max_retries 2
node queuectl.js config set backoff_base 2

echo "Enqueuing successful job..."
node queuectl.js enqueue '{"id":"job1","command":"echo Hello, World!"}'

echo "Enqueuing failing job..."
node queuectl.js enqueue '{"id":"job2","command":"invalid_command"}'

echo "Starting workers in background..."
node queuectl.js worker start --count 2 &
WORKER_PID=$!

echo "Waiting 10 seconds for workers to process jobs..."
sleep 10

echo "Job status:"
node queuectl.js status

echo "DLQ jobs (initial):"
node queuectl.js dlq list

echo "Waiting for job2 to appear in DLQ (up to 30s)..."
TIMEOUT=30
COUNT=0
while [ $COUNT -lt $TIMEOUT ]; do
  if node queuectl.js dlq list | grep -q job2; then
    echo "job2 is now in DLQ."
    break
  fi
  sleep 1
  COUNT=$((COUNT + 1))
done

echo "Retrying job2 from DLQ..."
node queuectl.js dlq retry job2 || true

echo "Waiting 5 seconds for retried job to process..."
sleep 5

echo "Final status:"
node queuectl.js status

echo "Stopping workers..."
kill $WORKER_PID || true

echo "Test complete."
