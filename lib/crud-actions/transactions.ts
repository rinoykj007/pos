"use server";

import { TransactionsTablesInterface } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

export const getAllTransactionsWithDetails = async (type: "debit" | "credit" | "all"): Promise<TransactionsTablesInterface[]> => {
  const mongoDb = await getMongoDb();
  const filter = type === "all" ? {} : { type };
  const [transactions, categories] = await Promise.all([
    mongoDb.collection(mongoCollections.transactionsTable).find(filter).sort({ id: -1 }).toArray(),
    mongoDb.collection(mongoCollections.transactionCategoriesTable).find().toArray(),
  ]);

  const categoriesById = new Map(categories.map((category) => [Number(category.id), category]));

  return transactions.map((transaction) => {
    const category = categoriesById.get(Number(transaction.categoryId));
    return {
      id: transaction.id,
      title: transaction.title,
      description: transaction.description ?? null,
      amount: transaction.amount,
      categoryId: transaction.categoryId,
      category: category?.category ?? null,
      categoryDescription: category?.description ?? null,
      type: transaction.type,
      sourceType: transaction.sourceType,
      sourceId: transaction.sourceId ?? null,
      createdAt: new Date(transaction.createdAt ?? new Date()).toISOString(),
    };
  });
};
