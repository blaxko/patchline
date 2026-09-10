-- CreateTable
CREATE TABLE "replay_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "regression_id" TEXT NOT NULL,
    "config_id" TEXT NOT NULL,
    "transcript" TEXT NOT NULL,
    "extracted_value" TEXT,
    "exact_match" BOOLEAN NOT NULL,
    "normalized_match" BOOLEAN NOT NULL,
    "latency_ms" INTEGER,
    "transcript_delta" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "ran_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
