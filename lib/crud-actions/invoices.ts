"use server";

import { InvoiceResponse, OrderItem } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";
import { deleteData, insertData, updateData } from "./general-actions";

export const fetchInvoice = async (invoiceId: number): Promise<InvoiceResponse | null> => {
  if (!invoiceId) return null;

  const mongoDb = await getMongoDb();
  const invoice = await mongoDb.collection(mongoCollections.InvoicesTable).findOne({ id: invoiceId });
  if (!invoice) return null;

  const [order, items, user] = await Promise.all([
    mongoDb.collection(mongoCollections.ordersTable).findOne({ id: invoice.orderId }),
    mongoDb.collection(mongoCollections.orderItemsTable).find({ orderId: invoice.orderId }).sort({ id: 1 }).toArray(),
    invoice.generatedByUserId ? mongoDb.collection(mongoCollections.users).findOne({ id: invoice.generatedByUserId }) : null,
  ]);

  if (!order) return null;

  return {
    invoice: {
      ...invoice,
      paymentMethod: invoice.paymentMethod ?? "unpaid",
      discountType: invoice.discountType ?? "percentage",
      paymentSplits: invoice.paymentSplits ?? undefined,
      createdAt: new Date(invoice.createdAt ?? new Date()).toISOString(),
    },
    order: {
      ...order,
      tableId: order.tableId !== null && order.tableId !== undefined ? String(order.tableId) : "",
      waiterId: order.waiterId !== null && order.waiterId !== undefined ? String(order.waiterId) : "",
      createdAt: new Date(order.createdAt ?? new Date()).toISOString(),
    },
    items: items.map((item) => ({
      ...item,
      menuItemId: String(item.menuItemId ?? ""),
      menuItemOptionId: item.menuItemOptionId !== null && item.menuItemOptionId !== undefined ? String(item.menuItemOptionId) : null,
    })),
    generatedBy: user
      ? {
          id: user.id,
          name: user.name ?? "",
          email: user.email,
        }
      : null,
  } as unknown as InvoiceResponse;
};

export const getAllWaiters = async (roleName: string) => {
  if (!roleName) return null;

  const mongoDb = await getMongoDb();
  const role = await mongoDb.collection(mongoCollections.roles).findOne({ role: roleName });
  if (!role) return [];

  return mongoDb
    .collection(mongoCollections.users)
    .find({ role_id: role.id })
    .project({ id: 1, name: 1, email: 1, isActive: "$is_active", role: role.role })
    .toArray();
};

export async function upsertInvoiceOrderItemsTx(parsed: any, userId: number, mode: "insert" | "update"): Promise<{ invoiceId: number }> {
  if (!parsed) throw new Error("Data Fields is not provided");
  if (!userId) throw new Error("Please Provide The UserId");

  let orderId = Number(parsed.orderId);
  let invoiceId = Number(parsed.invoiceId);

  if (mode === "insert") {
    const orderResult = await insertData("ordersTable", {
      tableId: parsed.tableId ? Number(parsed.tableId) : null,
      waiterId: Number(userId),
      orderType: parsed.orderType.trim(),
      status: "completed",
      createdAt: parsed.orderCreatedAt,
    });
    orderId = orderResult.insertId;
  } else if (!orderId || !invoiceId) {
    throw new Error("Missing orderId or invoiceId for update mode");
  } else {
    await updateData("ordersTable", "id", orderId, {
      tableId: parsed.tableId ? Number(parsed.tableId) : null,
      orderType: parsed.orderType.trim(),
      createdAt: parsed.orderCreatedAt,
    });
    await deleteData("orderItemsTable", "orderId", orderId);
  }

  for (const item of parsed.orderItems ?? []) {
    const parsedOptionId = Number((item as OrderItem).menuItemOptionId);
    await insertData("orderItemsTable", {
      orderId,
      menuItemImage: item.menuItemImage || null,
      menuItemId: Number(item.menuItemId),
      menuItemName: item.menuItemName,
      menuItemOptionId: parsedOptionId > 0 ? parsedOptionId : null,
      menuItemOptionName: item.menuItemOptionName || null,
      quantity: item.quantity,
      price: item.price,
    });
  }

  const invoicePayload = {
    orderId,
    generatedByUserId: Number(userId),
    customerName: typeof parsed.customerName === "string" && parsed.customerName.trim() ? parsed.customerName.trim() : "random",
    subTotalAmount: parsed.subTotalAmount,
    discount: parsed.discount ?? "0.00",
    discountType: parsed.discountType ?? "percentage",
    totalAmount: parsed.totalAmount,
    advancePaid: parsed.advancePaid ?? "0.00",
    grandTotal: parseFloat(parsed.grandTotal) < 0 ? "0.00" : parseFloat(parsed.grandTotal).toFixed(2),
    isPaid: parsed.isPaid,
    paymentMethod: parsed.paymentMethod ?? "unpaid",
    paymentSplits: parsed.paymentSplits ?? null,
    createdAt: parsed.invoiceCreatedAt ?? new Date(),
  };

  if (mode === "insert") {
    invoiceId = (await insertData("InvoicesTable", invoicePayload)).insertId;
  } else {
    await updateData("InvoicesTable", "id", invoiceId, invoicePayload);
  }

  const mongoDb = await getMongoDb();
  await mongoDb.collection(mongoCollections.transactionsTable).deleteMany({ sourceType: "invoice", sourceId: invoiceId });
  if (parsed.isPaid) {
    await insertData("transactionsTable", {
      categoryId: 2,
      title: "Customer Invoice",
      amount: invoicePayload.grandTotal,
      type: "credit",
      sourceType: "invoice",
      sourceId: invoiceId,
      createdAt: new Date(),
    });
  }

  return { invoiceId };
}

export const deleteInvoiceWithTransaction = async (id: number): Promise<void> => {
  if (!id) throw new Error("Oops! No invoice ID was provided for deletion.");

  const mongoDb = await getMongoDb();
  const invoice = await mongoDb.collection(mongoCollections.InvoicesTable).findOne({ id });
  if (!invoice) throw new Error(`Invoice with ID ${id} not found.`);

  await Promise.all([
    deleteData("orderItemsTable", "orderId", invoice.orderId),
    deleteData("ordersTable", "id", invoice.orderId),
    deleteData("InvoicesTable", "id", id),
    mongoDb.collection(mongoCollections.transactionsTable).deleteMany({ sourceType: "invoice", sourceId: id }),
  ]);
};
