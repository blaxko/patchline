import { z } from "zod";
import { prisma } from "../db.js";
import { isValidSkuFormat } from "../lib/format.js";
import { levenshtein } from "../lib/levenshtein.js";

export const lookupProductInput = z.object({
  sku: z.string().min(1),
});

export type LookupProductInput = z.infer<typeof lookupProductInput>;

interface SkuCloseMatch {
  sku: string;
  distance: number;
}

export type LookupProductResult =
  | { found: true; sku: string; name: string; price: number }
  | { found: false; reason: "INVALID_FORMAT" }
  | { found: false; reason: "NOT_FOUND"; close_matches: SkuCloseMatch[] };

const CLOSE_MATCH_MAX_DISTANCE = 2;

export async function lookupProduct(input: LookupProductInput): Promise<LookupProductResult> {
  const sku = input.sku.toUpperCase();

  if (!isValidSkuFormat(sku)) {
    return { found: false, reason: "INVALID_FORMAT" };
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  if (product) {
    return { found: true, sku: product.sku, name: product.name, price: product.price };
  }

  const allProducts = await prisma.product.findMany({ select: { sku: true } });
  const closeMatches: SkuCloseMatch[] = allProducts
    .map((p) => ({ sku: p.sku, distance: levenshtein(sku, p.sku) }))
    .filter((m) => m.distance > 0 && m.distance <= CLOSE_MATCH_MAX_DISTANCE)
    .sort((a, b) => a.distance - b.distance);

  return { found: false, reason: "NOT_FOUND", close_matches: closeMatches };
}
