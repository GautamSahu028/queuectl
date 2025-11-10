#!/bin/bash
set -e

rm -f queuectl.db

echo "Setup retry config"
node queuectl.js config set max_retries 2
node queuectl.js config set backoff_base 2

echo "Enqueue failing job to push to DLQ"
node queuectl.js enqueue '{"id":"dlq_test","command":"fail_cmd"}'

echo "Start worker"
node queuectl.js worker start --count 1 &
WORKER_PID=$!

# Wait for job to move to DLQ (approx 2 retries with backoff delays)
sleep 15

echo "List DLQ jobs"
node queuectl.js dlq list

echo "Retry job from DLQ"
node queuectl.js dlq retry dlq_test

echo "Watch retries occur again"
sleep 10

echo "Final status"
node queuectl.js status

echo "Stop worker"
kill $WORKER_PID

echo "DLQ operational test complete."
