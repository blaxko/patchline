-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "utterance_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "raw_text" TEXT NOT NULL,
    "normalized_value" TEXT NOT NULL,
    "verification_state" TEXT NOT NULL DEFAULT 'unverified',
    "verified_value" TEXT,
    "verified_by" TEXT,
    "start_ms" INTEGER NOT NULL,
    "end_ms" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "entities_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "entities_utterance_id_fkey" FOREIGN KEY ("utterance_id") REFERENCES "utterances" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
