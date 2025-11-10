const db = require("./db");
const { exec } = require("child_process");

function getConfig(key, defaultValue) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  return row ? parseInt(row.value) : defaultValue;
}

// Worker loop to pick up jobs and process them
async function workerLoop(workerId) {
  while (true) {
    // Find a pending job and lock it for processing
    const job = db
      .prepare("SELECT * FROM jobs WHERE state = ? LIMIT 1")
      .get("pending");
    if (!job) {
      await new Promise((r) => setTimeout(r, 1000)); // Wait before trying again
      continue;
    }
    // Lock (mark as processing)
    db.prepare("UPDATE jobs SET state = ?, updated_at = ? WHERE id = ?").run(
      "processing",
      new Date().toISOString(),
      job.id
    );

    // Execute command
    console.log(`[Worker ${workerId}] Executing: ${job.command}`);
    exec(job.command, (error, stdout, stderr) => {
      let state,
        attempts = job.attempts + 1;
      if (!error) {
        state = "completed";
        console.log(stdout);
      } else {
        // Retry logic
        const max_retries = job.max_retries;
        if (attempts > max_retries) {
          state = "dead";
          console.error(`[Worker ${workerId}] Job ${job.id} moved to DLQ.`);
        } else {
          state = "failed";
          // Exponential backoff
          const base = getConfig("backoff_base", 2);
          const delay = Math.pow(base, attempts);
          setTimeout(() => {
            db.prepare(
              "UPDATE jobs SET state = ?, attempts = ?, updated_at = ? WHERE id = ?"
            ).run("pending", attempts, new Date().toISOString(), job.id);
          }, delay * 1000);
        }
      }
      db.prepare(
        "UPDATE jobs SET state = ?, attempts = ?, updated_at = ? WHERE id = ?"
      ).run(state, attempts, new Date().toISOString(), job.id);
    });
    // Wait for current job to finish before proceeding
    await new Promise((r) => setTimeout(r, 2000));
  }
}

module.exports = workerLoop;
