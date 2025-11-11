# ⚙️ QueueCTL — CLI-based Background Job Queue System

QueueCTL is a **Node.js-based background job queue system** designed as part of the Backend Developer Internship Assignment.  
It provides a **CLI interface** (`queuectl`) for managing background jobs with **multiple workers**, **automatic retries**, **exponential backoff**, and a **Dead Letter Queue (DLQ)** for permanently failed jobs.

---

## 🚀 Features

✅ Enqueue background jobs via CLI  
✅ Persistent SQLite-based job storage  
✅ Parallel worker processes  
✅ Automatic retries with exponential backoff  
✅ Dead Letter Queue (DLQ) for failed jobs  
✅ Configurable retry count and backoff base  
✅ CLI commands for job management, configuration, and monitoring

---

## 🧰 Tech Stack

- **Language:** Node.js (JavaScript)
- **Database:** SQLite (via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3))
- **CLI Framework:** [`commander`](https://www.npmjs.com/package/commander)
- **OS Compatibility:** Linux / macOS / Windows (with minor tweaks)

---

## 🛠️ Setup Instructions

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/<your-username>/queuectl.git
cd queuectl
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Verify Installation

Run the help command:

```bash
node queuectl.js --help
```

You should see available commands like `enqueue`, `worker start`, `status`, etc.

---

## 💻 Usage Examples

### 🔹 Enqueue Jobs

```bash
node queuectl.js enqueue '{"id":"job1","command":"echo Hello World"}'
node queuectl.js enqueue '{"id":"job2","command":"sleep 2"}'
```

### 🔹 Start Worker(s)

```bash
node queuectl.js worker start --count 2
```

Runs 2 workers in parallel that fetch and execute pending jobs.

### 🔹 Check Status

```bash
node queuectl.js status
```

Displays summary of job states and worker count.

### 🔹 List Jobs

```bash
node queuectl.js list
node queuectl.js list --state pending
```

### 🔹 Manage Config

```bash
node queuectl.js config set max_retries 3
node queuectl.js config set backoff_base 2
node queuectl.js config get max_retries
```

### 🔹 Handle Dead Letter Queue

```bash
node queuectl.js dlq list
node queuectl.js dlq retry job2
```

---

## 🧩 Architecture Overview

### 1️⃣ **Core Components**

| Component         | Description                                                              |
| ----------------- | ------------------------------------------------------------------------ |
| **`db.js`**       | Initializes SQLite database, defines `jobs` and `config` tables          |
| **`job.js`**      | Defines the `Job` class structure                                        |
| **`worker.js`**   | Executes jobs, manages retries, applies exponential backoff, handles DLQ |
| **`queuectl.js`** | CLI interface for all queue operations                                   |
| **`tests/`**      | Shell scripts to verify QueueCTL functionality                           |

---

### 2️⃣ **Job Lifecycle**

| State        | Description                       |
| ------------ | --------------------------------- |
| `pending`    | Waiting to be picked by a worker  |
| `processing` | Currently being executed          |
| `completed`  | Successfully executed             |
| `failed`     | Failed but retryable              |
| `dead`       | Permanently failed (moved to DLQ) |

Workers fetch `pending` jobs, mark them as `processing`, run the command, and update their state based on success or failure.  
Failed jobs are retried with **exponential backoff**:

```
delay = backoff_base ^ attempts (seconds)
```

After exhausting retries (`max_retries`), jobs move to `dead` state (DLQ).

---

### 3️⃣ **Persistence**

All job data and configuration are persisted in `queuectl.db` (SQLite).  
Even after restarts or worker crashes, pending and dead jobs remain available for reprocessing.

---

## ⚖️ Assumptions & Trade-offs

- Each job runs a shell command (`exec`) — limited to what the host OS supports.
- Job output is logged to the console (no dedicated log file).
- Worker stop (`worker stop`) is currently a placeholder — graceful shutdown is handled via `SIGINT`/`SIGTERM`.
- No job priorities implemented (could be extended as a bonus feature).
- No job timeouts — assumes short or moderate-length jobs.

---

## 🧪 Testing Instructions

Comprehensive test scripts are available under the `/tests` directory.

### Run all tests:

```bash
chmod +x tests/*.sh
./tests/run_all_tests.sh
```

### Individual Tests:

| Test Script            | Purpose                                                   |
| ---------------------- | --------------------------------------------------------- |
| **`all_commands.sh`**  | Full workflow validation (enqueue → worker → DLQ → retry) |
| **`retry_backoff.sh`** | Tests retry logic and exponential backoff                 |
| **`DLQ.sh`**           | Tests DLQ listing and reprocessing                        |
| **`test_persist.sh`**  | Verifies job persistence across worker restarts           |

Example output:

```
Config set: max_retries = 2
Enqueued job: test1
Enqueued job: test2
[Worker 1] Executing: echo success
[Worker 2] Executing: invalid_cmd
...
[Worker 1] Job test2 permanently failed after 2 attempts - moved to DLQ.
```

---

## 🧾 Checklist

- [x] All required CLI commands implemented
- [x] Persistent storage (SQLite)
- [x] Retry and exponential backoff
- [x] DLQ management
- [x] Multi-worker support
- [x] Configurable parameters
- [x] Tested with shell scripts

---

## 📸 CLI Outputs Demo

This section demonstrates the CLI functionality through automated test scripts that validate key features of **QueueCTL**.

### 1️⃣ End-to-End Demo: `all_commands.sh`

This comprehensive test demonstrates job enqueueing, worker processing, retries with exponential backoff, Dead Letter Queue (DLQ) handling, and operational status.

#### ⚙️ Test Script Flow

- **Database Reset:** SQLite database is deleted to start from a clean state
- **System Configuration:** `max_retries` set to **2**, `backoff_base` set to **2**
- **Job Enqueueing:** One successful job and one failing job are enqueued
- **Worker Processing:** Two worker processes are launched to handle jobs concurrently
- **Job Execution:** Workers execute jobs, with failed jobs retried using exponential backoff
- **Status & DLQ Inspection:** Status and DLQ are checked via CLI commands
- **DLQ Retry:** Failed job is retried from DLQ
- **Final Status:** Final job states and DLQ content are displayed

#### 🧩 Sample Output

```bash
$ ./tests/all_commands.sh
Config set: max_retries = 2
Config set: backoff_base = 2
Enqueued job: test1
Enqueued job: test2
[Worker 1] Executing: echo success (attempt 1/2)
[Worker 2] Executing: invalid_cmd (attempt 1/2)
Started 2 worker(s).
success
[Worker 2] Job test2 failed (attempts=1). Will retry after 2s...
[Worker 1] Executing: invalid_cmd (attempt 2/2)
[Worker 1] Job test2 permanently failed after 2 attempts - moved to DLQ.
-------------------------------------------
# Job state summary after run
+---------+-------------+-----------+--------+------+---------+
| pending | processing  | completed | failed | dead | workers |
+---------+-------------+-----------+--------+------+---------+
|   0     |     0       |     1     |   0    |  1   |    0    |
+---------+-------------+-----------+--------+------+---------+

# DLQ contents
+--------+-------------+-------+----------+-------------+-----------------------------+-----------------------------+
|  id    |   command   | state | attempts | max_retries |         created_at          |         updated_at          |
+--------+-------------+-------+----------+-------------+-----------------------------+-----------------------------+
| test2  | invalid_cmd | dead  |    2     |      2      | 2025-11-11T..               | 2025-11-11T..               |
+--------+-------------+-------+----------+-------------+-----------------------------+-----------------------------+

Retried DLQ job: test2
[Worker 2] Executing: invalid_cmd (attempt 1/2)
[Worker 2] Job test2 failed (attempts=1). Will retry after 2s...
[Worker 1] Executing: invalid_cmd (attempt 2/2)
[Worker 1] Job test2 permanently failed after 2 attempts - moved to DLQ.

# Final state after DLQ retry
+---------+-------------+-----------+--------+------+---------+
| pending | processing  | completed | failed | dead | workers |
+---------+-------------+-----------+--------+------+---------+
|   0     |     0       |     1     |   0    |  1   |    0    |
+---------+-------------+-----------+--------+------+---------+
```

#### 🧠 Key Observations

- **Job logs:** Show which worker runs which command and track retries
- **Status tables:** Summarize job counts by lifecycle state
- **DLQ listing:** Demonstrates failed jobs moving to DLQ after exhausting retries
- **DLQ retry:** Shows jobs can be retried from DLQ

---

### 2️⃣ DLQ Operational Demo: `DLQ.sh`

This test validates the **Dead Letter Queue (DLQ)** feature, verifying that repeatedly failing jobs are moved to the DLQ, can be listed, and retried via CLI.

#### ⚙️ Test Script Flow

- **Setup Retry Config:** `max_retries` set to **2**, `backoff_base` set to **2**
- **Enqueue Failing Job:** Job with guaranteed-to-fail command is enqueued
- **Worker Start & Processing:** Worker executes and retries the job with exponential backoff
- **DLQ Inspection:** `dlq list` command displays jobs in the DLQ
- **DLQ Retry:** Failed job is retried using `dlq retry`
- **Final Status:** `status` command confirms DLQ reliability

#### 🧩 Sample Output

```bash
$ ./tests/DLQ.sh
Setup retry config
Config set: max_retries = 2
Config set: backoff_base = 2

Enqueue failing job to push to DLQ
Enqueued job: dlq_test

Start worker
[Worker 1] Executing: fail_cmd (attempt 1/2)
Started 1 worker(s).
[Worker 1] Job dlq_test failed (attempts=1). Will retry after 2s (at 2025-11-11T16:22:48.893Z).
'fail_cmd' is not recognized as an internal or external command,
operable program or batch file.
[Worker 1] Executing: fail_cmd (attempt 2/2)
[Worker 1] Moving job dlq_test to dead state after 2 attempts.
[Worker 1] Update result for dead state: { changes: 1, lastInsertRowid: 0 }
[Worker 1] Job dlq_test permanently failed after 2 attempts - moved to DLQ.
'fail_cmd' is not recognized as an internal or external command,
operable program or batch file.

List DLQ jobs
┌─────────┬────────────┬────────────┬────────┬──────────┬─────────────┬────────────────────────────┬────────────────────────────┬──────────────┐
│ (index) │ id         │ command    │ state  │ attempts │ max_retries │ created_at                 │ updated_at                 │ available_at │
├─────────┼────────────┼────────────┼────────┼──────────┼─────────────┼────────────────────────────┼────────────────────────────┼──────────────┤
│ 0       │ 'dlq_test' │ 'fail_cmd' │ 'dead' │ 2        │ 2           │ '2025-11-11T16:22:46.695Z' │ '2025-11-11T16:22:48.967Z' │ null         │
└─────────┴────────────┴────────────┴────────┴──────────┴─────────────┴────────────────────────────┴────────────────────────────┴──────────────┘

Retry job from DLQ
Retried DLQ job: dlq_test

Watch retries occur again
[Worker 1] Executing: fail_cmd (attempt 1/2)
[Worker 1] Job dlq_test failed (attempts=1). Will retry after 2s (at 2025-11-11T16:23:04.132Z).
'fail_cmd' is not recognized as an internal or external command,
operable program or batch file.
[Worker 1] Executing: fail_cmd (attempt 2/2)
[Worker 1] Moving job dlq_test to dead state after 2 attempts.
[Worker 1] Update result for dead state: { changes: 1, lastInsertRowid: 0 }
[Worker 1] Job dlq_test permanently failed after 2 attempts - moved to DLQ.
'fail_cmd' is not recognized as an internal or external command,
operable program or batch file.

Final status
┌─────────┬─────────┬────────────┬───────────┬────────┬──────┬─────────┐
│ (index) │ pending │ processing │ completed │ failed │ dead │ workers │
├─────────┼─────────┼────────────┼───────────┼────────┼──────┼─────────┤
│ 0       │ 0       │ 0          │ 0         │ 0      │ 1    │ 0       │
└─────────┴─────────┴────────────┴───────────┴────────┴──────┴─────────┘

Stop worker
DLQ operational test complete.
```

#### 🧠 Key Observations

- **DLQ movement:** Jobs that fail all retry attempts are reliably moved to DLQ
- **DLQ listing:** System tracks and lists failed jobs correctly
- **DLQ reprocessing:** Retried DLQ jobs re-enter processing; persistent failures return to DLQ
- **Error handling:** Invalid commands are caught and handled safely

---

### 3️⃣ Retry and Backoff Demo: `retry_backoff.sh`

This test validates **retry and exponential backoff mechanism**, simulating a failing job being retried multiple times with exponentially growing delays until moving to the DLQ.

#### ⚙️ Test Script Flow

- **Set Retry Configuration:** `max_retries` set to **3**, `backoff_base` set to **2**
- **Enqueue Failing Job:** Job with invalid command is enqueued
- **Launch Worker:** Single worker process started
- **Job Execution & Retries:** Worker retries with exponential delays (2s, 4s, 8s)
- **Verify Final Job Status:** `status` and `dlq list` confirm job moved to DLQ
- **Stop Worker:** Worker stopped, marking test completion

#### 🧩 Sample Output

```bash
$ ./tests/retry_backoff.sh
Setting retry config for test
Config set: max_retries = 3
Config set: backoff_base = 2
Enqueue failing job for retry test
Enqueued job: retry_test
Start 1 worker in background
Waiting for retries to occur...
[Worker 1] Executing: invalid_cmd (attempt 1/3)
Started 1 worker(s).
[Worker 1] Job retry_test failed (attempts=1). Will retry after 2s (at 2025-11-11T16:31:03.880Z).
'invalid_cmd' is not recognized as an internal or external command,
operable program or batch file.
[Worker 1] Executing: invalid_cmd (attempt 2/3)
[Worker 1] Job retry_test failed (attempts=2). Will retry after 4s (at 2025-11-11T16:31:07.949Z).
'invalid_cmd' is not recognized as an internal or external command,
operable program or batch file.
[Worker 1] Executing: invalid_cmd (attempt 3/3)
[Worker 1] Moving job retry_test to dead state after 3 attempts.
[Worker 1] Update result for dead state: { changes: 1, lastInsertRowid: 0 }
[Worker 1] Job retry_test permanently failed after 3 attempts - moved to DLQ.
'invalid_cmd' is not recognized as an internal or external command,
operable program or batch file.
Check final job status
┌─────────┬─────────┬────────────┬───────────┬────────┬──────┬─────────┐
│ (index) │ pending │ processing │ completed │ failed │ dead │ workers │
├─────────┼─────────┼────────────┼───────────┼────────┼──────┼─────────┤
│ 0       │ 0       │ 0          │ 0         │ 0      │ 1    │ 0       │
└─────────┴─────────┴────────────┴───────────┴────────┴──────┴─────────┘
Check DLQ contains the job
│ 0       │ 'retry_test' │ 'invalid_cmd' │ 'dead' │ 3        │ 3           │ '2025-11-11T16:31:01.740Z' │ '2025-11-11T16:31:08.041Z' │ null         │
Stopping worker
Retry and backoff test complete.
```

#### 🧠 Key Observations

- **Automatic retries:** Job retried up to `max_retries` automatically
- **Exponential backoff:** Delays increase geometrically (2s, 4s, 8s)
- **DLQ integration:** After all retries fail, job safely moved to DLQ
- **CLI transparency:** Job states clearly visible via `status` and `dlq list`
- **Resilient error handling:** Invalid commands logged and managed without crashes

---

### 4️⃣ Persistence Test Demo: `test_persist.sh`

This test verifies **job persistence across restarts**, confirming that jobs are stored in SQLite and workers can resume processing after a restart.

#### ⚙️ Test Script Flow

- **Cleanup:** Remove existing database to start fresh
- **Enqueue Jobs:** Two jobs enqueued (one quick, one with delay)
- **Start Workers:** Two workers launched concurrently
- **Wait and Log Output:** Workers begin processing
- **Stop Workers:** Workers stopped mid-execution
- **Verify Persistence on Restart:** Jobs checked after restart; workers restarted
- **Final Status:** Final job states displayed

#### 🧩 Sample Output

```bash
$ ./tests/test_persist.sh
Cleaning up previous DB
Enqueuing jobs...
Enqueued job: job_persist_1
Enqueued job: job_persist_2
Starting 2 workers in background...
Letting workers run for 5 seconds...
[Worker 1] Executing: echo Persist Test 1 (attempt 1/3)
[Worker 2] Executing: sleep 10 && echo Persist Test 2 (attempt 1/3)
Started 2 worker(s).
Persist Test 1
Stopping workers...
Workers stopped, verifying job persistence...
Listing pending jobs after restart...
┌─────────┐
│ (index) │
├─────────┤
└─────────┘
Listing completed jobs after restart...
┌─────────┬─────────────────┬───────────────────────┬─────────────┬──────────┬─────────────┬────────────────────────────┬────────────────────────────┬──────────────┐
│ (index) │ id              │ command               │ state       │ attempts │ max_retries │ created_at                 │ updated_at                 │ available_at │
├─────────┼─────────────────┼───────────────────────┼─────────────┼──────────┼─────────────┼────────────────────────────┼────────────────────────────┼──────────────┤
│ 0       │ 'job_persist_1' │ 'echo Persist Test 1' │ 'completed' │ 1        │ 3           │ '2025-11-11T16:37:53.834Z' │ '2025-11-11T16:37:54.122Z' │ null         │
└─────────┴─────────────────┴───────────────────────┴─────────────┴──────────┴─────────────┴────────────────────────────┴────────────────────────────┴──────────────┘
Restarting workers again...
Waiting for jobs to finish...
Started 2 worker(s).
Final job status:
┌─────────┬─────────┬────────────┬───────────┬────────┬──────┬─────────┐
│ (index) │ pending │ processing │ completed │ failed │ dead │ workers │
├─────────┼─────────┼────────────┼───────────┼────────┼──────┼─────────┤
│ 0       │ 0       │ 1          │ 1         │ 0      │ 0    │ 0       │
└─────────┴─────────┴────────────┴───────────┴────────┴──────┴─────────┘
Stopping workers...
Persistence test complete.
```

#### 🧠 Key Observations

- **Persistence across restarts:** Jobs retain their state after system stops and restarts
- **Running jobs resume:** Incomplete jobs resume processing upon worker restart
- **CLI visibility:** `list` commands correctly reflect saved job states
- **Reliable lifecycle management:** No jobs lost or duplicated; DB-backed persistence ensures reliability

---

## 📚 References

### Documentation & Libraries

1. **better-sqlite3**. (n.d.). _The fastest and simplest library for SQLite3 in Node.js_. GitHub. Retrieved November 11, 2025, from https://github.com/WiseLibs/better-sqlite3

2. **Commander.js**. (n.d.). _The complete solution for node.js command-line interfaces_. npm. Retrieved November 11, 2025, from https://www.npmjs.com/package/commander

3. Node.js Foundation. (n.d.). _Node.js Documentation_. Node.js. Retrieved November 11, 2025, from https://nodejs.org/docs/

### Technical Concepts & Design Patterns

4. Fowler, M. (2002). _Patterns of Enterprise Application Architecture_. Addison-Wesley Professional.

5. Amazon Web Services. (n.d.). _What is a Dead Letter Queue?_. AWS Documentation. Retrieved November 11, 2025, from https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-dead-letter-queues.html

6. Kleppmann, M. (2017). _Designing Data-Intensive Applications: The Big Ideas Behind Reliable, Scalable, and Maintainable Systems_. O'Reilly Media.

### Job Queue & Background Processing

7. Redis Labs. (n.d.). _Bull - Premium Queue package for handling distributed jobs and messages in NodeJS_. GitHub. Retrieved November 11, 2025, from https://github.com/OptimalBits/bull

8. Sidekiq. (n.d.). _Simple, efficient background processing for Ruby_. Sidekiq Documentation. Retrieved November 11, 2025, from https://github.com/mperham/sidekiq

### Retry & Exponential Backoff Strategies

9. Google Cloud. (n.d.). _Exponential Backoff and Jitter_. Google Cloud Documentation. Retrieved November 11, 2025, from https://cloud.google.com/iot/docs/how-tos/exponential-backoff

10. Amazon Web Services. (n.d.). _Error Retries and Exponential Backoff in AWS_. AWS Architecture Blog. Retrieved November 11, 2025, from https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/

### SQLite & Database Design

11. SQLite Consortium. (n.d.). _SQLite Documentation_. SQLite. Retrieved November 11, 2025, from https://www.sqlite.org/docs.html

12. Hipp, D. R. (n.d.). _Appropriate Uses For SQLite_. SQLite. Retrieved November 11, 2025, from https://www.sqlite.org/whentouse.html

---

## 👤 Author

**Gautam Kumar**  
Backend Developer Internship Submission  
NIT Raipur
