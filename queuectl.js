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

program.parse(process.argv);
