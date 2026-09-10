-- CreateTable
CREATE TABLE "tool_calls" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "proposed_args" TEXT NOT NULL,
    "final_args" TEXT,
    "gate_result" TEXT NOT NULL,
    "gate_reason" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "executed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "validation_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entity_id" TEXT NOT NULL,
    "validator_name" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "candidates" TEXT,
    "ran_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
