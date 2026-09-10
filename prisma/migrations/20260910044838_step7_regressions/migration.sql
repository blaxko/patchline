-- CreateTable
CREATE TABLE "regressions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source_session_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "expected_value" TEXT NOT NULL,
    "observed_value" TEXT NOT NULL,
    "audio_asset" TEXT NOT NULL,
    "audio_start_ms" INTEGER NOT NULL,
    "audio_end_ms" INTEGER NOT NULL,
    "context_before" TEXT NOT NULL,
    "context_after" TEXT NOT NULL,
    "baseline_config_id" TEXT NOT NULL,
    "repair_method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
