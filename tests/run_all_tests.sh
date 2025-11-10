#!/bin/bash
set -e

echo "Starting full queuectl test suite..."

echo "Running basic functional test (all_commands.sh)..."
./tests/all_commands.sh

echo "Running persistence test (test_persist.sh)..."
./tests/test_persist.sh

echo "Running retry and backoff test (retry_backoff.sh)..."
./tests/retry_backoff.sh

echo "Running Dead Letter Queue test (DLQ.sh)..."
./tests/DLQ.sh

echo "All tests completed successfully."
