"use server";

import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections, type MongoCollectionKey } from "@/lib/mongodb/collections";

type ColumnValue = string | number | boolean | Date | null;

async function getNextId(collectionName: string): Promise<number> {
  const mongoDb = await getMongoDb();
  const counters = mongoDb.collection<{ _id: string; seq: number }>("_counters");
  const result = await counters.findOneAndUpdate(
    { _id: collectionName },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  return result?.seq ?? 1;
}

function normalizeInsert<T extends Record<string, unknown>>(collectionName: string, data: T, id: number): T & { id: number } {
  return {
    ...data,
    id: typeof data.id === "number" ? data.id : id,
  };
}

export async function getAllData<T = Record<string, unknown>>(
  tableName: MongoCollectionKey,
  orderBy: "asc" | "desc" = "asc",
): Promise<T[]> {
  const mongoDb = await getMongoDb();
  return mongoDb
    .collection(mongoCollections[tableName])
    .find()
    .sort({ id: orderBy === "desc" ? -1 : 1 })
    .toArray() as Promise<T[]>;
}

export async function insertData<T extends Record<string, unknown>>(
  tableName: MongoCollectionKey,
  data: T,
  _tx?: unknown,
): Promise<{ insertId: number }> {
  const mongoDb = await getMongoDb();
  const collectionName = mongoCollections[tableName];
  const insertId = typeof data.id === "number" ? data.id : await getNextId(collectionName);
  const document = normalizeInsert(collectionName, data, insertId);

  await mongoDb.collection(collectionName).insertOne(document);

  return { insertId };
}

export async function updateData(
  tableName: MongoCollectionKey,
  columnName: string,
  columnValue: ColumnValue,
  values: Record<string, unknown>,
  _tx?: unknown,
): Promise<{ affectedRows: number }> {
  const mongoDb = await getMongoDb();
  const result = await mongoDb
    .collection(mongoCollections[tableName])
    .updateMany({ [columnName]: columnValue }, { $set: values });

  return { affectedRows: result.modifiedCount };
}

export async function deleteData(
  tableName: MongoCollectionKey,
  columnName: string,
  columnValue: ColumnValue,
  _tx?: unknown,
): Promise<void> {
  const mongoDb = await getMongoDb();
  await mongoDb.collection(mongoCollections[tableName]).deleteMany({ [columnName]: columnValue });
}

export async function checkDuplicate(
  tableName: MongoCollectionKey,
  columnName: string,
  value: ColumnValue,
  _tx?: unknown,
): Promise<boolean> {
  const mongoDb = await getMongoDb();
  const row = await mongoDb.collection(mongoCollections[tableName]).findOne({ [columnName]: value });
  return Boolean(row);
}
