import { z } from "zod";
import { ulid } from "../lib/ulid.js";
import { writeToolCallAudit } from "../lib/audit.js";

export const createSupportCaseInput = z.object({
  order_id: z.string().min(1),
  summary: z.string().min(1),
});

export type CreateSupportCaseInput = z.infer<typeof createSupportCaseInput>;

export interface CreateSupportCaseResult {
  case_id: string;
  order_id: string;
  status: "open";
}

export async function createSupportCase(input: CreateSupportCaseInput): Promise<CreateSupportCaseResult> {
  const result: CreateSupportCaseResult = {
    case_id: ulid(),
    order_id: input.order_id.toUpperCase(),
    status: "open",
  };
  await writeToolCallAudit("create_support_case", input, result, false);
  return result;
}
