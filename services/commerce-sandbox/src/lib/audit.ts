import { ulid } from "./ulid.js";
import { prisma } from "../db.js";

export async function writeToolCallAudit(
  toolName: string,
  args: unknown,
  result: unknown,
  simulated: boolean,
): Promise<void> {
  await prisma.toolCallAudit.create({
    data: {
      id: ulid(),
      toolName,
      args: JSON.stringify(args),
      result: JSON.stringify(result),
      simulated,
    },
  });
}
