-- CreateTable
CREATE TABLE "promotions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "config_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previous_active_config_id" TEXT,
    "suite_results" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
