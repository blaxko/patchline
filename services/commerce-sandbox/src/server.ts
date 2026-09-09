import Fastify from "fastify";
import { z } from "zod";
import {
  lookupOrder,
  lookupOrderInput,
  lookupCustomer,
  lookupCustomerInput,
  checkTracking,
  checkTrackingInput,
  lookupProduct,
  lookupProductInput,
  requestRefund,
  requestRefundInput,
  updateShippingAddress,
  updateShippingAddressInput,
  createSupportCase,
  createSupportCaseInput,
  escalateToHuman,
  escalateToHumanInput,
} from "./index.js";

// Thin HTTP wrapper for direct manual testing (PRD.md §9 Step 2 APIs).
// The real backend (Step 3+) consumes these tool functions in-process, not over HTTP.

const TOOLS: Record<string, { input: z.ZodTypeAny; fn: (args: unknown) => Promise<unknown> }> = {
  lookup_order: { input: lookupOrderInput, fn: (a) => lookupOrder(a as never) },
  lookup_customer: { input: lookupCustomerInput, fn: (a) => lookupCustomer(a as never) },
  check_tracking: { input: checkTrackingInput, fn: (a) => checkTracking(a as never) },
  lookup_product: { input: lookupProductInput, fn: (a) => lookupProduct(a as never) },
  request_refund: { input: requestRefundInput, fn: (a) => requestRefund(a as never) },
  update_shipping_address: { input: updateShippingAddressInput, fn: (a) => updateShippingAddress(a as never) },
  create_support_case: { input: createSupportCaseInput, fn: (a) => createSupportCase(a as never) },
  escalate_to_human: { input: escalateToHumanInput, fn: (a) => escalateToHuman(a as never) },
};

export function buildServer() {
  const app = Fastify({ logger: true });

  app.post("/internal/tools/:name", async (request, reply) => {
    const { name } = request.params as { name: string };
    const tool = TOOLS[name];

    if (!tool) {
      return reply.code(404).send({ error: "UNKNOWN_TOOL", tool: name });
    }

    const parsed = tool.input.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "INVALID_ARGS", details: parsed.error.flatten() });
    }

    const result = await tool.fn(parsed.data);
    return reply.send(result);
  });

  return app;
}

const app = buildServer();
const port = Number(process.env.COMMERCE_SANDBOX_PORT ?? 8081);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
