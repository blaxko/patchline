-- CreateTable
CREATE TABLE "configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "speech_model" TEXT NOT NULL,
    "context_mode" TEXT NOT NULL,
    "prompt" TEXT,
    "keyterms_prompt" TEXT,
    "agent_context_enabled" BOOLEAN NOT NULL,
    "previous_context_n_turns" INTEGER NOT NULL,
    "end_of_turn_confidence_threshold" REAL NOT NULL,
    "format_turns" BOOLEAN NOT NULL,
    "notes" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "promoted_by" TEXT,
    "promoted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "status" TEXT NOT NULL,
    "active_config_id" TEXT NOT NULL,
    "caller_label" TEXT NOT NULL,
    "summary" TEXT,
    "mode" TEXT NOT NULL,
    CONSTRAINT "sessions_active_config_id_fkey" FOREIGN KEY ("active_config_id") REFERENCES "configs" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "utterances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "speaker" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "turn_order" INTEGER NOT NULL,
    "end_of_turn_confidence" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "utterances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "event_type" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "correlation_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "audit_events_correlation_id_idx" ON "audit_events"("correlation_id");
