"use server";

import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";

export const deleteTheTransactionCategory = async (categoryId: number): Promise<boolean> => {
  if (!categoryId) throw new Error("Category ID is required");

  const mongoDb = await getMongoDb();
  const othersCategory = await mongoDb.collection(mongoCollections.transactionCategoriesTable).findOne({
    category: { $regex: /^others$/i },
  });

  if (!othersCategory) {
    throw new Error("Default 'Others' category not found. Please seed it first.");
  }

  if (Number(categoryId) === Number(othersCategory.id)) {
    throw new Error("The default 'Others' category cannot be deleted.");
  }

  await mongoDb.collection(mongoCollections.transactionsTable).updateMany(
    { categoryId },
    { $set: { categoryId: othersCategory.id } }
  );
  await mongoDb.collection(mongoCollections.transactionCategoriesTable).deleteOne({ id: categoryId });

  return true;
};
