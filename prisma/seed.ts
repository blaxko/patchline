import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

interface SeedOrder {
  id: string;
  orderId: string;
  status: string;
  trackingId: string | null;
  total: number;
  refundEligible: string;
  shippingAddress: string;
  placedAt: string;
  items: { productId: string; quantity: number }[];
}

interface SeedCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  orders: SeedOrder[];
}

interface SeedFile {
  products: { id: string; sku: string; name: string; price: number }[];
  customers: SeedCustomer[];
}

async function main() {
  const raw = readFileSync(join(__dirname, "..", "fixtures", "commerce", "seed.json"), "utf-8");
  const data: SeedFile = JSON.parse(raw);

  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.toolCallAudit.deleteMany();

  for (const p of data.products) {
    await prisma.product.create({ data: p });
  }

  for (const c of data.customers) {
    await prisma.customer.create({
      data: { id: c.id, name: c.name, email: c.email, phone: c.phone },
    });
    for (const o of c.orders) {
      await prisma.order.create({
        data: {
          id: o.id,
          orderId: o.orderId,
          customerId: c.id,
          status: o.status,
          trackingId: o.trackingId,
          total: o.total,
          refundEligible: o.refundEligible,
          shippingAddress: o.shippingAddress,
          placedAt: new Date(o.placedAt),
          items: {
            create: o.items.map((item, idx) => ({
              id: `${o.id}_item_${idx}`,
              productId: item.productId,
              quantity: item.quantity,
            })),
          },
        },
      });
    }
  }

  console.log(
    `Seeded ${data.customers.length} customers, ${data.customers.reduce((n, c) => n + c.orders.length, 0)} orders, ${data.products.length} products.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
