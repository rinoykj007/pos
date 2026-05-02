"use server";

import { RestaurantTablesInterface } from "@/lib/definations";
import { getMongoDb } from "@/lib/mongodb";
import { mongoCollections } from "@/lib/mongodb/collections";
import { updateData } from "./general-actions";

export const getAllActiveTable = async (): Promise<RestaurantTablesInterface[]> => {
  const mongoDb = await getMongoDb();
  return mongoDb
    .collection<RestaurantTablesInterface & { isDeleted?: boolean }>(mongoCollections.restaurantTables)
    .find({ isDeleted: { $ne: true } })
    .sort({ id: 1 })
    .project<RestaurantTablesInterface>({ id: 1, table_number: 1, status: 1 })
    .toArray();
};

export const deleteRestaurantTable = async (id: number): Promise<{ success: boolean; message: string }> => {
  try {
    const mongoDb = await getMongoDb();
    const blockingBooking = await mongoDb.collection(mongoCollections.bookingsTables).findOne({
      tableId: id,
      status: { $in: ["scheduled", "booked", "processing"] },
    });

    if (blockingBooking?.status === "processing") {
      return { success: false, message: "This table is currently in use. Please complete the booking before deleting." };
    }

    if (blockingBooking) {
      return { success: false, message: "This table has an active booking. Please cancel the booking first." };
    }

    await updateData("restaurantTables", "id", id, { isDeleted: true });
    return { success: true, message: "Table deleted successfully!" };
  } catch {
    return { success: false, message: "An error occurred while trying to delete the table." };
  }
};
