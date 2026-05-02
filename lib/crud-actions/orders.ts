"use server";

import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

export async function getAllOrdersByTable(tableId: number) {
  if (!tableId) return [];

  const mongoDb = await getMongoDb();
  const latestOrder = await mongoDb
    .collection(mongoCollections.ordersTable)
    .find({ tableId })
    .sort({ createdAt: -1, id: -1 })
    .limit(1)
    .next();

  if (!latestOrder) return [];

  const invoice = await mongoDb.collection(mongoCollections.InvoicesTable).findOne({ orderId: latestOrder.id });
  if (invoice?.isPaid) return [];

  const [items, booking] = await Promise.all([
    mongoDb.collection(mongoCollections.orderItemsTable).find({ orderId: latestOrder.id }).sort({ id: 1 }).toArray(),
    mongoDb
      .collection(mongoCollections.bookingsTables)
      .find({ tableId, status: "processing" })
      .sort({ bookingDate: -1, id: -1 })
      .limit(1)
      .next(),
  ]);

  return {
    order: latestOrder,
    items,
    booking: booking
      ? {
          customerName: booking.customerName,
          advancePaid: booking.advancePaid ?? "0.00",
        }
      : null,
  };
}
