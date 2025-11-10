const { Command } = require("commander");
const db = require("./db");
const Job = require("./job");
const program = new Command();

program
  .command("enqueue <jobJson>")
  .description("Add a new job to the queue")
  .action((jobJson) => {
    let jobData;
    try {
      jobData = JSON.parse(jobJson);
      if (!jobData.id || !jobData.command) {
        throw new Error('Job "id" and "command" are required.');
      }
    } catch (err) {
      console.error("Invalid job JSON:", err.message);
      process.exit(1);
    }

    // Use configured max_retries if job didn't explicitly set it
    const cfgRow = db
      .prepare(`SELECT value FROM config WHERE key = 'max_retries'`)
      .get();
    if (jobData.max_retries === undefined || jobData.max_retries === null) {
      if (cfgRow && cfgRow.value) {
        const cfgVal = parseInt(cfgRow.value, 10);
        if (!Number.isNaN(cfgVal)) jobData.max_retries = cfgVal;
      }
      // If still undefined, Job constructor will set its default (3)
    }

    const job = new Job(jobData);

    const stmt = db.prepare(
      `INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    try {
      stmt.run(
        job.id,
        job.command,
        job.state,
        job.attempts,
        job.max_retries,
        job.created_at,
        job.updated_at
      );
      console.log(`Enqueued job: ${job.id}`);
    } catch (err) {
      console.error(`Failed to enqueue job: ${err.message}`);
      process.exit(1);
    }
  });

program
  .command("list")
  .option("--state <state>", "Filter jobs by state")
  .description("List jobs by state")
  .action((opts) => {
    const { state } = opts;
    const whereClause = state ? "WHERE state = ?" : "";
    const stmt = db.prepare(`SELECT * FROM jobs ${whereClause}`);
    const jobs = state ? stmt.all(state) : stmt.all();
    console.table(jobs);
  });

program
  .command("status")
  .description("Show summary of job states and active workers")
  .action(() => {
    const states = ["pending", "processing", "completed", "failed", "dead"];
    const summary = {};
    states.forEach((state) => {
      const count = db
        .prepare("SELECT COUNT(*) as count FROM jobs WHERE state = ?")
        .get(state).count;
      summary[state] = count;
    });
    // Placeholder for future worker count if implemented
    summary.workers = 0;
    console.table([summary]);
  });

// Group worker commands under a single 'worker' command with subcommands
const worker = program.command("worker").description("Manage workers");

worker
  .command("start")
  .option("--count <count>", "Number of workers", "1")
  .description("Start worker processes")
  .action((opts) => {
    const { workerLoop } = require("./worker");
    const count = parseInt(opts.count);
    for (let i = 0; i < count; i++) {
      workerLoop(i + 1);
    }
    console.log(`Started ${count} worker(s).`);
  });

worker
  .command("stop")
  .description("Stop running workers gracefully (not implemented yet)")
  .action(() => {
    console.log("Worker stop functionality not implemented yet.");
  });

const dlq = program.command("dlq").description("Manage Dead Letter Queue");

dlq
  .command("list")
  .description("List jobs in Dead Letter Queue")
  .action(() => {
    const dlqJobs = db.prepare(`SELECT * FROM jobs WHERE state = 'dead'`).all();
    if (dlqJobs.length === 0) {
      console.log("No jobs in DLQ.");
    } else {
      console.table(dlqJobs);
    }
  });

dlq
  .command("retry <jobId>")
  .description("Retry a DLQ job by moving it to pending")
  .action((jobId) => {
    const job = db
      .prepare(`SELECT * FROM jobs WHERE id = ? AND state = 'dead'`)
      .get(jobId);
    if (!job) {
      console.error("Job not found in DLQ.");
      process.exit(1);
    }
    db.prepare(
      `UPDATE jobs SET state = 'pending', attempts = 0, updated_at = ?, available_at = NULL WHERE id = ?`
    ).run(new Date().toISOString(), jobId);
    console.log(`Retried DLQ job: ${jobId}`);
  });

// ---- config parent command with subcommands (FIX) ----
const config = program.command("config").description("Manage configuration");

config
  .command("set <key> <value>")
  .description("Set configuration value")
  .action((key, value) => {
    db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`).run(
      key,
      value
    );
    console.log(`Config set: ${key} = ${value}`);
  });

config
  .command("get <key>")
  .description("Get configuration value")
  .action((key) => {
    const row = db.prepare(`SELECT value FROM config WHERE key = ?`).get(key);
    if (!row) {
      console.log(`${key} not set`);
    } else {
      console.log(`${key} = ${row.value}`);
    }
  });

// Only parse args when executed directly (safer for requiring the file)
if (require.main === module) {
  program.parse(process.argv);
}

module.exports = { program };
