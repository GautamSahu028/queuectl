const db = require("./db");
const { exec } = require("child_process");
let shouldStop = false;

function getConfig(key, defaultValue) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row ? parseInt(row.value) : defaultValue;
}

function requestShutdown() {
  shouldStop = true;
}

async function workerLoop(workerId) {
  process.on("SIGINT", requestShutdown); // Graceful exit on Ctrl+C
  process.on("SIGTERM", requestShutdown);
  while (!shouldStop) {
    // Atomically claim a pending job
    const job = db
      .prepare(
        `
      SELECT * FROM jobs 
      WHERE state = 'pending' 
      LIMIT 1
    `
      )
      .get();
    if (!job) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    // Attempt to lock (atomic state change)
    const res = db
      .prepare(
        `
      UPDATE jobs SET state = 'processing', updated_at = ?
      WHERE id = ? AND state = 'pending'
    `
      )
      .run(new Date().toISOString(), job.id);
    if (res.changes === 0) continue; // Already claimed

    // Execute job
    console.log(`[Worker ${workerId}] Executing: ${job.command}`);
    exec(job.command, async (error, stdout, stderr) => {
      let nextState;
      let attempts = job.attempts + 1;
      if (!error) {
        nextState = "completed";
        console.log(stdout);
      } else {
        nextState = attempts > job.max_retries ? "dead" : "failed";
        if (nextState === "failed") {
          const base = getConfig("backoff_base", 2);
          const delay = Math.pow(base, attempts);
          setTimeout(() => {
            db.prepare(
              `UPDATE jobs SET state = 'pending', attempts = ?, updated_at = ? WHERE id = ?`
            ).run(attempts, new Date().toISOString(), job.id);
          }, delay * 1000);
        }
      }
      db.prepare(
        `UPDATE jobs SET state = ?, attempts = ?, updated_at = ? WHERE id = ?`
      ).run(nextState, attempts, new Date().toISOString(), job.id);
    });
    // Wait a bit before looking for another job
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log(`[Worker ${workerId}] Shutting down gracefully.`);
}

module.exports = workerLoop;
module.exports.requestShutdown = requestShutdown;
