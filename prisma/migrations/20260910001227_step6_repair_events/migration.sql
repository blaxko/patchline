-- CreateTable
CREATE TABLE "repair_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "response" TEXT,
    "resolved_value" TEXT,
    "attempt_number" INTEGER NOT NULL,
    "turn_count" INTEGER NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
