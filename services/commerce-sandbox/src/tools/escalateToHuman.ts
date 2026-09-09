import { z } from "zod";
import { ulid } from "../lib/ulid.js";
import { writeToolCallAudit } from "../lib/audit.js";

export const escalateToHumanInput = z.object({
  reason: z.string().min(1),
  order_id: z.string().optional(),
});

export type EscalateToHumanInput = z.infer<typeof escalateToHumanInput>;

export interface EscalateToHumanResult {
  escalation_id: string;
  status: "escalated";
}

export async function escalateToHuman(input: EscalateToHumanInput): Promise<EscalateToHumanResult> {
  const result: EscalateToHumanResult = {
    escalation_id: ulid(),
    status: "escalated",
  };
  await writeToolCallAudit("escalate_to_human", input, result, false);
  return result;
}
