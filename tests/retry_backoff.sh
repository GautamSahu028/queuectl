#!/bin/bash
set -e

rm -f queuectl.db

echo "Setting retry config for test"
node queuectl.js config set max_retries 3
node queuectl.js config set backoff_base 2

echo "Enqueue failing job for retry test"
node queuectl.js enqueue '{"id":"retry_test","command":"invalid_cmd"}'

echo "Start 1 worker in background"
node queuectl.js worker start --count 1 &
WORKER_PID=$!

echo "Waiting for retries to occur..."
sleep 20 # Enough time for 3 retries with backoff 2,4,8 seconds

echo "Check final job status"
node queuectl.js status

echo "Check DLQ contains the job"
node queuectl.js dlq list | grep 'retry_test'

echo "Stopping worker"
kill $WORKER_PID

echo "Retry and backoff test complete."
