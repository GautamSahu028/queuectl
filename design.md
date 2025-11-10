# 🧩 **QueueCTL – System Design Overview**

## 1. **High-Level Architecture**

```
+-----------------------+
|       queuectl        |
|     (CLI Interface)   |
+----------+------------+
           |
           v
+-----------------------+
|     Job Database      |
| (SQLite: queuectl.db) |
|  • jobs table         |
|  • config table       |
+----------+------------+
           |
           v
+-----------------------+
|     Worker Pool       |
|  (Concurrent Workers) |
+----------+------------+
           |
           v
+-----------------------+
|  Command Executor     |
| (Child Process runs   |
|  each job command)    |
+-----------------------+
```

**Core Idea:**  
`queuectl` is a CLI-based background job queue that schedules and executes shell commands reliably using worker processes, automatic retries with exponential backoff, and a **Dead Letter Queue (DLQ)** for failed jobs.  
All state is persisted in a **SQLite** database (`queuectl.db`) to survive restarts.

---

## 2. **Key Components**

### **1. CLI Interface (`queuectl.js`)**
Acts as the control surface of the system.  
Implements commands such as:
- `enqueue` — Add a new job.
- `worker start/stop` — Manage workers.
- `list` / `status` — Inspect job states.
- `dlq list` / `dlq retry` — DLQ operations.
- `config set/get` — Manage retry/backoff configuration.

**Design Choice:** Node.js `process.argv` parsing + SQLite access ensures low overhead and portability.

---

### **2. Persistence Layer (`db.js`)**
Backed by **SQLite**, chosen for simplicity and ACID compliance.

- **jobs table:** Stores all job metadata and states (`pending`, `processing`, `completed`, `dead`).
- **config table:** Stores system-level settings (`max_retries`, `backoff_base`).

**Why SQLite?**
- File-based persistence — survives restarts.
- No setup overhead (ideal for CLI tools).
- Atomic updates prevent race conditions between workers.

---

### **3. Worker System (`worker.js`)**
Handles job fetching, claiming, and execution.

- Each worker repeatedly:
  1. Claims a single `pending` job atomically.
  2. Updates its state to `processing`.
  3. Executes the command in a **child process**.
  4. Updates status → `completed` or schedules a retry.

**Retry Logic:**
```
delay = backoff_base ^ attempts
```
Jobs retry up to `max_retries` times before moving to DLQ (`state = 'dead'`).

**Graceful Shutdown:**  
Workers listen to `SIGINT` / `SIGTERM` and complete their current job before exiting.

---

### **4. Dead Letter Queue (DLQ)**
- Jobs that exceed their retry limit are marked `dead`.
- Accessible via:
  - `queuectl dlq list` — View DLQ jobs.
  - `queuectl dlq retry <job_id>` — Requeue a DLQ job back to `pending`.

---

## 3. **Concurrency Control**

To prevent **duplicate job execution**:
- Workers claim jobs using an **atomic UPDATE**:
  ```sql
  UPDATE jobs
  SET state = 'processing'
  WHERE id = ? AND state = 'pending';
  ```
- Only one worker can succeed; others skip that job.

---

## 4. **Job Lifecycle**

| **State** | **Meaning** |
|------------|-------------|
| `pending` | Job is queued and waiting. |
| `processing` | A worker is executing it. |
| `completed` | Execution succeeded. |
| `failed` | (Optional transient state; handled internally.) |
| `dead` | Job failed after all retries → DLQ. |

---

## 5. **Configuration System**

| **Key** | **Description** | **Default** |
|----------|----------------|--------------|
| `max_retries` | Max retry attempts before DLQ | 3 |
| `backoff_base` | Exponential backoff base | 2 |

Stored persistently in the `config` table and editable via:
```
queuectl config set max_retries 2
queuectl config get backoff_base
```

---

## 6. **Assumptions & Trade-offs**

- SQLite chosen over file-based JSON for concurrency safety.
- Workers are in-process threads, not OS-level daemons (simpler to manage for CLI usage).
- No priority queue or job scheduling (can be future enhancements).
- Commands execute as child processes — assumes OS supports `exec`.

---

## 7. **Possible Extensions**

| **Feature** | **Description** |
|--------------|----------------|
| **Job timeout** | Abort long-running jobs after a threshold. |
| **Priority Queue** | Execute higher-priority jobs first. |
| **Job output logging** | Save stdout/stderr to a logs folder. |
| **Metrics Dashboard** | Monitor job throughput, success rate. |

---

## 8. **Design Summary**

| **Aspect** | **Choice** |
|-------------|-------------|
| Language | Node.js |
| Persistence | SQLite (queuectl.db) |
| Concurrency | Multi-worker (atomic job claim) |
| Retry Strategy | Exponential backoff |
| Fault Tolerance | DLQ for failed jobs |
| Configurability | CLI `config set/get` |
| Testing | Shell scripts (`/tests/`) simulating end-to-end flow |
