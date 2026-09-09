import type { CriticalEntityType } from "schemas";

export interface LlmFallbackCandidate {
  entityType: CriticalEntityType;
  rawText: string;
  normalizedValue: string;
}

export type GroqToolCallFn = (text: string) => Promise<LlmFallbackCandidate[]>;

// Groq chat completions, JSON tool-call mode. Model per DECISIONS.md D5
// (openai/gpt-oss-120b, tool-calling); endpoint is Groq's OpenAI-compatible
// chat route, the same API family as the Orpheus TTS endpoint documented there.
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const FALLBACK_TIMEOUT_MS = Number(process.env.GROQ_FALLBACK_TIMEOUT_MS ?? 4000);

const EXTRACT_ENTITIES_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_entities",
    description:
      "Extract any of these critical entities the caller stated in this turn. Omit fields not present.",
    parameters: {
      type: "object",
      properties: {
        customer_name: { type: "string", description: "The caller's full name, as spoken." },
        shipping_address: { type: "string", description: "A full shipping address, as spoken." },
        refund_amount: { type: "number", description: "A dollar amount the caller stated, e.g. 'eighty dollars' -> 80." },
      },
    },
  },
};

export async function defaultGroqToolCall(text: string): Promise<LlmFallbackCandidate[]> {
  if (!process.env.GROQ_API_KEY) return []; // no key configured — skip rather than throw

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);

  try {
    const res = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          {
            role: "system",
            content: "You extract structured entities from a single turn of a customer support call transcript.",
          },
          { role: "user", content: text },
        ],
        tools: [EXTRACT_ENTITIES_TOOL],
        tool_choice: { type: "function", function: { name: "extract_entities" } },
      }),
      signal: controller.signal,
    });

    if (!res.ok) return [];

    const body = (await res.json()) as {
      choices: { message: { tool_calls?: { function: { arguments: string } }[] } }[];
    };
    const call = body.choices[0]?.message?.tool_calls?.[0];
    if (!call) return [];

    const args = JSON.parse(call.function.arguments) as Record<string, string | number>;
    const out: LlmFallbackCandidate[] = [];

    if (typeof args.customer_name === "string" && args.customer_name.trim()) {
      out.push({ entityType: "customer_name", rawText: args.customer_name, normalizedValue: args.customer_name });
    }
    if (typeof args.shipping_address === "string" && args.shipping_address.trim()) {
      out.push({
        entityType: "shipping_address",
        rawText: args.shipping_address,
        normalizedValue: args.shipping_address,
      });
    }
    if (typeof args.refund_amount === "number") {
      out.push({
        entityType: "refund_amount",
        rawText: String(args.refund_amount),
        normalizedValue: args.refund_amount.toFixed(2),
      });
    }

    return out;
  } catch {
    // Timeout or network error: skip this slot for this turn, no retry —
    // the later gate correctly blocks on LOW_EVIDENCE (PRD.md §9 Step 4).
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function extractLlmFallbackEntities(
  text: string,
  callGroq: GroqToolCallFn = defaultGroqToolCall,
): Promise<LlmFallbackCandidate[]> {
  try {
    return await callGroq(text);
  } catch {
    return [];
  }
}
