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

## 👤 Author

**Gautam Kumar**  
Backend Developer Internship Submission  
NIT Raipur
