class Job {
  constructor({
    id,
    command,
    state = "pending",
    attempts = 0,
    max_retries = 3,
    created_at,
    updated_at,
  }) {
    this.id = id;
    this.command = command;
    this.state = state;
    this.attempts = attempts;
    this.max_retries = max_retries;
    this.created_at = created_at || new Date().toISOString();
    this.updated_at = updated_at || new Date().toISOString();
  }
}

module.exports = Job;
