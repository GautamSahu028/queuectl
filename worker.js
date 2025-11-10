const db = require("./db");
const { exec } = require("child_process");

let shouldStop = false;

function getConfigInt(key, defaultValue) {
  const row = db.prepare("SELECT value FROM config WHERE key = ?").get(key);
  if (!row) return defaultValue;
  const v = parseInt(row.value, 10);
  return Number.isNaN(v) ? defaultValue : v;
}

function requestShutdown() {
  shouldStop = true;
}

async function workerLoop(workerId) {
  process.on("SIGINT", requestShutdown);
  process.on("SIGTERM", requestShutdown);

  while (!shouldStop) {
    const now = new Date().toISOString();

    // Fetch one pending job ready for processing
    const jobRow = db
      .prepare(
        `SELECT * FROM jobs 
         WHERE state = 'pending' AND (available_at IS NULL OR available_at <= ?) 
         ORDER BY created_at ASC 
         LIMIT 1`
      )
      .get(now);

    if (!jobRow) {
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    // Attempt to claim job atomically
    const claim = db
      .prepare(
        `UPDATE jobs SET state = 'processing', updated_at = ? 
         WHERE id = ? AND state = 'pending'`
      )
      .run(now, jobRow.id);

    if (claim.changes === 0) {
      // Some other worker grabbed this job
      continue;
    }

    const maxRetries =
      jobRow.max_retries !== undefined
        ? jobRow.max_retries
        : getConfigInt("max_retries", 3);

    console.log(
      `[Worker ${workerId}] Executing: ${jobRow.command} (attempt ${
        jobRow.attempts + 1
      }/${maxRetries})`
    );

    try {
      const execPromise = () =>
        new Promise((resolve) => {
          exec(jobRow.command, (error, stdout, stderr) => {
            resolve({ error, stdout, stderr });
          });
        });

      const { error, stdout, stderr } = await execPromise();

      const newAttempts = jobRow.attempts + 1;
      const finishedAt = new Date().toISOString();

      if (!error) {
        // Success - mark completed
        db.prepare(
          `UPDATE jobs 
           SET state = 'completed', attempts = ?, updated_at = ?, available_at = NULL
           WHERE id = ?`
        ).run(newAttempts, finishedAt, jobRow.id);

        if (stdout && stdout.trim()) console.log(stdout.trim());
      } else {
        if (newAttempts >= maxRetries) {
          // Move to DLQ (dead state)
          console.error(
            `[Worker ${workerId}] Moving job ${jobRow.id} to dead state after ${newAttempts} attempts.`
          );
          const result = db
            .prepare(
              `UPDATE jobs 
             SET state = 'dead', attempts = ?, updated_at = ?, available_at = NULL
             WHERE id = ?`
            )
            .run(newAttempts, finishedAt, jobRow.id);
          console.log(
            `[Worker ${workerId}] Update result for dead state:`,
            result
          );

          console.error(
            `[Worker ${workerId}] Job ${jobRow.id} permanently failed after ${newAttempts} attempts - moved to DLQ.`
          );
          if (stderr && stderr.trim()) console.error(stderr.trim());
        } else {
          // Schedule retry with exponential backoff
          const base = getConfigInt("backoff_base", 2);
          const delaySeconds = Math.pow(base, newAttempts);
          const availableAt = new Date(
            Date.now() + delaySeconds * 1000
          ).toISOString();

          db.prepare(
            `UPDATE jobs 
                SET state = 'pending', attempts = ?, updated_at = ?, available_at = ?
                WHERE id = ?`
          ).run(newAttempts, finishedAt, availableAt, jobRow.id);

          console.error(
            `[Worker ${workerId}] Job ${jobRow.id} failed (attempts=${newAttempts}). Will retry after ${delaySeconds}s (at ${availableAt}).`
          );
          if (stderr && stderr.trim()) console.error(stderr.trim());
        }
      }
    } catch (ex) {
      console.error(
        `[Worker ${workerId}] Unexpected error processing job ${jobRow.id}:`,
        ex
      );
    }
  }

  console.log(`[Worker ${workerId}] Shutting down gracefully.`);
}

module.exports = { workerLoop, requestShutdown };
