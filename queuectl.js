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
    const job = new Job(jobData);

    // Insert job into DB
    const stmt =
      db.prepare(`INSERT INTO jobs (id, command, state, attempts, max_retries, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`);
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
    // Placeholder for workers
    summary.workers = 0;
    console.table([summary]);
  });

program
  .command("worker")
  .option("start", "Start worker processes")
  .option("--count <count>", "Number of workers", 1)
  .description("Start one or more workers")
  .action((opts) => {
    const workerLoop = require("./worker");
    const count = parseInt(opts.count) || 1;
    for (let i = 0; i < count; i++) {
      workerLoop(i + 1);
    }
    console.log(`Started ${count} worker(s).`);
  });

program
  .command("dlq list")
  .description("List jobs in Dead Letter Queue")
  .action(() => {
    const dlqJobs = db.prepare(`SELECT * FROM jobs WHERE state = 'dead'`).all();
    if (dlqJobs.length === 0) {
      console.log("No jobs in DLQ.");
    } else {
      console.table(dlqJobs);
    }
  });

program
  .command("dlq retry <jobId>")
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
      `UPDATE jobs SET state = 'pending', attempts = 0, updated_at = ? WHERE id = ?`
    ).run(new Date().toISOString(), jobId);
    console.log(`Retried DLQ job: ${jobId}`);
  });

program
  .command("config set <key> <value>")
  .description("Set configuration value")
  .action((key, value) => {
    db.prepare(`INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)`).run(
      key,
      value
    );
    console.log(`Config set: ${key} = ${value}`);
  });

program
  .command("config get <key>")
  .description("Get configuration value")
  .action((key) => {
    const row = db.prepare(`SELECT value FROM config WHERE key = ?`).get(key);
    if (!row) {
      console.log(`${key} not set`);
    } else {
      console.log(`${key} = ${row.value}`);
    }
  });

program.parse(process.argv);
