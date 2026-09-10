import type { Config } from "@prisma/client";
import { prisma } from "../db.js";
import type { ConfigForAdapter } from "./assemblyaiAdapter.js";

export function configRowToAdapterConfig(config: Config): { id: string } & ConfigForAdapter {
  return {
    id: config.id,
    speechModel: config.speechModel,
    contextMode: config.contextMode,
    prompt: config.prompt,
    keytermsPrompt: config.keytermsPrompt,
    formatTurns: config.formatTurns,
    endOfTurnConfidenceThreshold: config.endOfTurnConfidenceThreshold,
  };
}

export async function getActiveConfig(): Promise<{ id: string } & ConfigForAdapter> {
  const config = await prisma.config.findFirst({ where: { status: "active" } });
  if (!config) {
    throw new Error("No active config found — did you run `pnpm prisma:seed`?");
  }
  return configRowToAdapterConfig(config);
}

export async function getConfigById(configId: string): Promise<{ id: string } & ConfigForAdapter> {
  const config = await prisma.config.findUniqueOrThrow({ where: { id: configId } });
  return configRowToAdapterConfig(config);
}
